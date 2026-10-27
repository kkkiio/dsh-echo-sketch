/** 每会话画板客户端状态。 */

import { fetchState, postCanvas, postRedraw, postRenderResult, postSettings } from './api.js';
import { translate } from './i18n.js';
import { renderAgentPng, renderUserPng } from './raster.js';

const stores = new Map();

/** 取得（或创建）会话画板 store。 */
export function getSketchpadStore(sessionId, ctx) {
  const key = String(sessionId);
  let store = stores.get(key);
  if (!store) {
    store = createStore(key, ctx);
    stores.set(key, store);
  }
  return store;
}

function createStore(sessionId, ctx) {
  let state = initialState();
  const listeners = new Set();
  const handled = new Set();
  let inflight;
  let saveSeq = 0;
  let savePromise = Promise.resolve();

  const emit = () => { for (const listener of listeners) listener(); };
  const set = patch => { state = { ...state, ...patch }; emit(); };

  const applyServer = payload => {
    const next = payload.state;
    const keepLocalUser = state.dirty && next.user.revision < state.user.revision + 1;
    const agentSeenRevision = state.viewMode === 'agent'
      ? next.agent.revision
      : Math.min(state.agentSeenRevision, next.agent.revision);
    state = {
      ...state,
      status: 'ready',
      error: '',
      user: keepLocalUser ? state.user : next.user,
      agent: next.agent,
      agentSeenRevision,
      settings: next.settings,
      visual: next.visual,
      imageSupport: payload.imageSupport,
      renderRequest: payload.renderRequest ?? null,
    };
    emit();
    if (payload.renderRequest != null) {
      void handleRenderRequest(payload.renderRequest);
    }
  };

  const refresh = async () => {
    if (inflight !== undefined) return inflight;
    inflight = fetchState(sessionId)
      .then(payload => applyServer(payload))
      .catch(error => set({
        status: state.status === 'loading' ? 'error' : state.status,
        error: messageOf(error),
      }))
      .finally(() => { inflight = undefined; });
    return inflight;
  };

  const saveUser = strokes => {
    const seq = ++saveSeq;
    state = { ...state, user: { ...state.user, strokes }, dirty: true, saving: true, error: '' };
    emit();
    savePromise = postCanvas({ sessionId, kind: 'user', strokes })
      .then(payload => {
        if (seq !== saveSeq) return;
        applyServer({ ...payload, renderRequest: null });
        state = { ...state, dirty: false, saving: false };
        emit();
      })
      .catch(error => {
        if (seq !== saveSeq) return;
        state = { ...state, saving: false, error: messageOf(error) };
        emit();
      });
    return savePromise;
  };

  const flush = async () => {
    while (state.saving || state.dirty) {
      if (state.saving) await savePromise;
      else await saveUser(state.user.strokes);
    }
  };

  const handleRenderRequest = async request => {
    const requestId = String(request?.requestId ?? '');
    if (requestId === '' || handled.has(requestId)) return;
    handled.add(requestId);
    const target = request?.target === 'user' ? 'user' : 'agent';
    try {
      if (target === 'user') await flush();
      const rendered = target === 'user'
        ? renderUserPng(state.user.strokes)
        : await renderAgentPng(state.agent.svg);
      const revision = target === 'user' ? state.user.revision : state.agent.revision;
      await postRenderResult({
        sessionId,
        requestId,
        images: [{ kind: target, revision, png: rendered.png, width: rendered.width, height: rendered.height }],
        errors: [],
      });
    } catch (error) {
      await postRenderResult({
        sessionId,
        requestId,
        images: [],
        errors: [messageOf(error)],
      }).catch(() => undefined);
    }
  };

  const sendToAgent = async note => {
    set({ sending: true, error: '' });
    try {
      await flush();
      const content = [{ type: 'text', text: String(note ?? '').trim() || translate('prompt.fallback') }];
      if (state.user.strokes.length > 0) {
        const rendered = renderUserPng(state.user.strokes);
        content.push({ type: 'image', mediaType: 'image/png', data: rendered.png, name: translate('file.user') });
      }
      if (state.agent.svg.length > 0) {
        try {
          const rendered = await renderAgentPng(state.agent.svg);
          content.push({ type: 'image', mediaType: 'image/png', data: rendered.png, name: translate('file.agent') });
        } catch {
        }
      }
      await ctx.sessions.using(sessionId, { source: 'echo-sketch' }, async reference => {
        const result = await reference.binding.session.prompt(content, 'queue');
        if (!result.ok) throw new Error(result.error?.message ?? translate('error.send'));
      });
    } catch (error) {
      set({ error: messageOf(error) });
    } finally {
      set({ sending: false });
    }
  };

  const setAutoDraw = async value => {
    set({ settings: { ...state.settings, autoDraw: value } });
    try {
      const payload = await postSettings({ sessionId, autoDraw: value });
      applyServer({ ...payload, renderRequest: null });
    } catch (error) {
      set({ error: messageOf(error) });
      await refresh();
    }
  };

  const redraw = async () => {
    set({ visual: { ...state.visual, status: 'drawing', error: '' } });
    try {
      await postRedraw({ sessionId });
    } catch (error) {
      set({ error: messageOf(error), visual: { ...state.visual, status: 'error' } });
    }
  };

  const clearAgent = async () => {
    try {
      const payload = await postCanvas({ sessionId, kind: 'agent', clear: true });
      applyServer({ ...payload, renderRequest: null });
    } catch (error) {
      set({ error: messageOf(error) });
    }
  };

  return {
    getSnapshot: () => state,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh,
    saveUser,
    flush,
    sendToAgent,
    setAutoDraw,
    redraw,
    clearAgent,
    setViewMode: viewMode => set({
      viewMode,
      ...(viewMode === 'agent' ? { agentSeenRevision: state.agent.revision } : {}),
    }),
  };
}

function initialState() {
  return {
    status: 'loading',
    error: '',
    user: { strokes: [], revision: 0, updatedAt: 0 },
    agent: {
      svg: '', title: '', revision: 0, updatedAt: 0,
      sourceTurn: 0, source: 'auto', error: '',
    },
    settings: { autoDraw: true },
    visual: { status: 'idle', error: '', startedAt: 0 },
    imageSupport: null,
    renderRequest: null,
    viewMode: 'agent',
    agentSeenRevision: 0,
    saving: false,
    sending: false,
    dirty: false,
  };
}

function messageOf(error) {
  return String(error?.message ?? error);
}
