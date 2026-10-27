import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutes, ROUTE_PREFIX } from '../src/host/routes.js';

function setup() {
  const calls = [];
  const state = {
    user: { strokes: [], revision: 0, updatedAt: 0 },
    agent: { svg: '', title: '', revision: 0, updatedAt: 0, sourceTurn: 0, source: 'auto', error: '' },
    settings: { autoDraw: true },
    visual: { status: 'idle', error: '', startedAt: 0 },
  };
  const store = {
    publicState: async () => state,
    saveUserStrokes: async (_id, strokes) => { calls.push(['saveUserStrokes', strokes]); },
    clearUserCanvas: async () => { calls.push(['clearUser']); },
    clearAgentCanvas: async () => { calls.push(['clearAgent']); },
    setSettings: async (_id, patch) => { calls.push(['setSettings', patch]); },
  };
  const bridge = {
    currentRequest: () => ({ requestId: 'r1', target: 'user' }),
    accept: async (_id, requestId) => requestId === 'r1',
  };
  const ctx = {
    agents: { get: id => (id === 'live' ? { id } : undefined) },
    llm: { resolveModelInfo: async () => ({ inputModalities: ['text', 'image'] }) },
  };
  const routes = createRoutes({
    ctx,
    store,
    bridge,
    triggerVisual: async () => { calls.push(['trigger']); },
  });
  const route = (path, method) => routes.find(item => item.path === `${ROUTE_PREFIX}${path}` && item.methods.includes(method));
  return { calls, state, route };
}

const headers = { 'content-type': 'application/json' };

test('GET state returns public state, support and render request', async () => {
  const { route } = setup();
  const response = await route('/state', 'GET').fetch(new Request('http://host/api/plugins/dsh-echo-sketch/state?sessionId=live'));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.imageSupport, true);
  assert.deepEqual(payload.renderRequest, { requestId: 'r1', target: 'user' });
});

test('POST canvas saves user strokes and clears agent', async () => {
  const { route, calls } = setup();
  const save = await route('/canvas', 'POST').fetch(new Request('http://host/api/plugins/dsh-echo-sketch/canvas', {
    method: 'POST', headers, body: JSON.stringify({ sessionId: 'live', kind: 'user', strokes: [] }),
  }));
  assert.equal(save.status, 200);
  assert.deepEqual(calls[0], ['saveUserStrokes', []]);
  const clear = await route('/canvas', 'POST').fetch(new Request('http://host/api/plugins/dsh-echo-sketch/canvas', {
    method: 'POST', headers, body: JSON.stringify({ sessionId: 'live', kind: 'agent', clear: true }),
  }));
  assert.equal(clear.status, 200);
  assert.deepEqual(calls[1], ['clearAgent']);
});

test('POST settings and redraw validate input', async () => {
  const { route, calls } = setup();
  const settings = await route('/settings', 'POST').fetch(new Request('http://host/api/plugins/dsh-echo-sketch/settings', {
    method: 'POST', headers, body: JSON.stringify({ sessionId: 'live', autoDraw: false }),
  }));
  assert.equal(settings.status, 200);
  assert.deepEqual(calls[0], ['setSettings', { autoDraw: false }]);
  const redraw = await route('/redraw', 'POST').fetch(new Request('http://host/api/plugins/dsh-echo-sketch/redraw', {
    method: 'POST', headers, body: JSON.stringify({ sessionId: 'live' }),
  }));
  assert.equal(redraw.status, 200);
  assert.deepEqual(calls[1], ['trigger']);
  const missing = await route('/redraw', 'POST').fetch(new Request('http://host/api/plugins/dsh-echo-sketch/redraw', {
    method: 'POST', headers, body: JSON.stringify({ sessionId: 'missing' }),
  }));
  assert.equal(missing.status, 409);
});

test('POST render-result accepts only the current request', async () => {
  const { route } = setup();
  const ok = await route('/render-result', 'POST').fetch(new Request('http://host/api/plugins/dsh-echo-sketch/render-result', {
    method: 'POST', headers, body: JSON.stringify({ sessionId: 'live', requestId: 'r1', images: [] }),
  }));
  assert.equal(ok.status, 200);
  const stale = await route('/render-result', 'POST').fetch(new Request('http://host/api/plugins/dsh-echo-sketch/render-result', {
    method: 'POST', headers, body: JSON.stringify({ sessionId: 'live', requestId: 'old', images: [] }),
  }));
  assert.equal(stale.status, 409);
});

test('oversized body is rejected', async () => {
  const { route } = setup();
  const body = JSON.stringify({ sessionId: 'live', kind: 'user', strokes: [], pad: 'x'.repeat(3 * 1024 * 1024) });
  const response = await route('/canvas', 'POST').fetch(new Request('http://host/api/plugins/dsh-echo-sketch/canvas', {
    method: 'POST', headers, body,
  }));
  assert.equal(response.status, 400);
});
