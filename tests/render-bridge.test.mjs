import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderBridge } from '../src/host/render-bridge.js';

function fixture({ timeoutMs = 1000 } = {}) {
  const state = {
    user: { revision: 1 },
    agent: { revision: 1 },
  };
  const refs = [];
  const attachments = {
    saveImage: async input => {
      const ref = {
        attachmentId: `a-${refs.length + 1}`,
        mediaType: 'image/png',
        bytes: input.data.byteLength,
        width: 100,
        height: 50,
        name: input.name,
      };
      refs.push(ref);
      return ref;
    },
  };
  const ctx = { get: name => (name === 'attachments' ? attachments : undefined) };
  const store = { get: async () => state };
  return { bridge: new RenderBridge({ ctx, store, timeoutMs }), state, refs };
}

const PNG = Buffer.from('png').toString('base64');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('request waits for a client response and caches the attachment', async () => {
  const { bridge, refs } = fixture();
  const pending = bridge.request('s1', 'user', undefined);
  await tick();
  const request = bridge.currentRequest('s1');
  assert.equal(request.target, 'user');
  assert.equal(await bridge.accept('s1', request.requestId, [{ kind: 'user', revision: 1, png: PNG, width: 100, height: 50 }]), true);
  const result = await pending;
  assert.equal(result.images.length, 1);
  assert.equal(refs.length, 1);
  assert.equal(bridge.currentRequest('s1'), null);
  const cached = await bridge.request('s1', 'user', undefined);
  assert.equal(cached.images[0].ref.attachmentId, refs[0].attachmentId);
  assert.equal(refs.length, 1);
});

test('stale revision is rejected', async () => {
  const { bridge } = fixture();
  const pending = bridge.request('s2', 'user', undefined);
  await tick();
  const request = bridge.currentRequest('s2');
  await bridge.accept('s2', request.requestId, [{ kind: 'user', revision: 0, png: PNG }]);
  const result = await pending;
  assert.equal(result.images.length, 0);
  assert.match(result.note, /revision/);
});

test('timeout returns a note without throwing', async () => {
  const { bridge } = fixture({ timeoutMs: 20 });
  const result = await bridge.request('s3', 'agent', undefined);
  assert.equal(result.images.length, 0);
  assert.match(result.note, /8 秒|响应/);
});

test('abort resolves without throwing', async () => {
  const { bridge } = fixture();
  const controller = new AbortController();
  const pending = bridge.request('s4', 'agent', controller.signal);
  controller.abort();
  const result = await pending;
  assert.equal(result.images.length, 0);
  assert.match(result.note, /取消/);
});

test('imageBlocks maps refs to model blocks', () => {
  const blocks = RenderBridge.imageBlocks([{ ref: { attachmentId: 'x' } }, { ref: undefined }]);
  assert.deepEqual(blocks, [{ type: 'image', attachment: { attachmentId: 'x' } }]);
});
