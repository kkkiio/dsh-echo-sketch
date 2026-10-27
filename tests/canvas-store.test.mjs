import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CanvasStore } from '../src/host/canvas-store.js';

async function withStore(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'echo-sketch-store-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('store persists latest user and agent canvases', async () => withStore(async dir => {
  const store = new CanvasStore({ dir });
  const first = await store.saveUserStrokes('s1', [{ color: '#123456', width: 4, points: [[1, 2], [3, 4]] }]);
  assert.equal(first.user.revision, 1);
  const same = await store.saveUserStrokes('s1', first.user.strokes);
  assert.equal(same.user.revision, 1);
  const agent = await store.setAgentCanvas('s1', { svg: '<svg/>', title: '流程', source: 'auto', sourceTurn: 3 });
  assert.equal(agent.agent.revision, 1);
  await store.setSettings('s1', { autoDraw: false });
  await store.setSidecarChildId('s1', 'echo-sketch-sidecar-x');
  await store.setPushCursor('s1', 9);
  await store.flush('s1');
  const restored = new CanvasStore({ dir });
  const state = await restored.get('s1');
  assert.equal(state.user.revision, 1);
  assert.equal(state.agent.title, '流程');
  assert.equal(state.agent.sourceTurn, 3);
  assert.equal(state.settings.autoDraw, false);
  assert.equal(state.sidecarChildId, 'echo-sketch-sidecar-x');
  assert.equal(state.pushCursorSeq, 9);
}));

test('publicState hides internal cursor and sidecar id', async () => withStore(async dir => {
  const store = new CanvasStore({ dir });
  await store.setSidecarChildId('s2', 'echo-sketch-sidecar-y');
  await store.setPushCursor('s2', 7);
  const state = await store.publicState('s2');
  assert.equal('sidecarChildId' in state, false);
  assert.equal('pushCursorSeq' in state, false);
  assert.deepEqual(state.settings, { autoDraw: true });
  await store.flush('s2');
}));

test('corrupt JSON falls back to an empty state', async () => withStore(async dir => {
  const store = new CanvasStore({ dir });
  const path = store.pathFor('s3');
  await writeFile(path, '{not json', 'utf8');
  const restored = new CanvasStore({ dir });
  const state = await restored.get('s3');
  assert.equal(state.user.revision, 0);
  assert.equal(state.agent.svg, '');
}));

test('clearAgentCanvas increments revision and clears content', async () => withStore(async dir => {
  const store = new CanvasStore({ dir });
  await store.setAgentCanvas('s4', { svg: '<svg/>', title: 'x', source: 'auto', sourceTurn: 1 });
  const cleared = await store.clearAgentCanvas('s4');
  assert.equal(cleared.agent.svg, '');
  assert.equal(cleared.agent.revision, 2);
  await store.flush('s4');
  const text = await readFile(store.pathFor('s4'), 'utf8');
  assert.match(text, /"sidecarChildId":""/);
}));
