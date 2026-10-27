/** dsh-echo-sketch 宿主入口。 */

import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { firstTurnStartSeq, isVisualizableTurn, renderDelta } from './delta.js';
import { CanvasStore } from './canvas-store.js';
import { RenderBridge } from './render-bridge.js';
import { SidecarManager } from './sidecar.js';
import { registerSketchpadTools } from './tools.js';
import { createRoutes } from './routes.js';

export const name = 'echo-sketch';
export const inject = ['agents', 'llm', 'connection', 'tools', 'subagents'];

/**
 * 挂载画板存储、sidecar、工具和 HTTP 路由。
 * @param {object} ctx
 */
export function apply(ctx) {
  const store = new CanvasStore({
    dir: dshHomePath('plugins', 'dsh-echo-sketch', 'sessions'),
    logger: ctx.logger,
  });
  const sidecar = new SidecarManager({ ctx, store, logger: ctx.logger });
  const bridge = new RenderBridge({ ctx, store, logger: ctx.logger });
  const controllers = new Map();
  const queues = new Map();

  ctx.on('agent/created', ({ agent }) => sidecar.configureChild(agent));

  ctx.effect(() => {
    const disposers = registerSketchpadTools(ctx, { store, bridge, sidecar });
    return () => { for (const dispose of disposers) dispose(); };
  }, 'echo-sketch: tools');
  for (const route of createRoutes({
    ctx,
    store,
    bridge,
    triggerVisual: (sessionId, options) => triggerVisual(sessionId, options),
  })) {
    ctx.effect(() => ctx.connection.fetch.register(route), `echo-sketch: ${route.path}`);
  }

  ctx.on('agent/pre-step', async ({ agent, messages, step }, next) => {
    if (step !== 1 || sidecar.isSidecar(agent.id)) return next();
    const actionable = messages.filter(message => message.source?.kind !== 'runtime-context');
    if (actionable.length === 0) return next();
    const ownSettlement = actionable.every(message => {
      const source = message?.source;
      return source?.kind === 'subagent-settled'
        && typeof source.senderSessionId === 'string'
        && sidecar.isSidecar(source.senderSessionId);
    });
    if (!ownSettlement) return next();
    const decision = await next();
    if (decision.kind === 'reject') return decision;
    return { ...decision, messages: [] };
  }, { prepend: true });

  ctx.on('session/event', (session, event) => {
    if (event.type !== 'turn/end' || event.data?.reason?.kind !== 'completed') return;
    if (!isMainSession(session, sidecar)) return;
    if (!isVisualizableTurn(session, event.data.turn, source => source.kind === 'subagent-settled' && sidecar.isSidecar(source.senderSessionId))) return;
    scheduleVisual(session.id, event.data.turn, false);
  });

  ctx.on('session/disposed', session => {
    if (!isMainSession(session, sidecar)) return;
    const controller = controllers.get(String(session.id));
    controller?.abort(new Error('session disposed'));
    void sidecar.dispose(session.id);
    void store.flush(session.id).finally(() => store.forget(session.id));
  });

  ctx.effect(() => () => {
    for (const controller of controllers.values()) controller.abort(new Error('plugin disposed'));
    void sidecar.disposeAll();
    void store.flushAll();
  }, 'echo-sketch: dispose');

  async function triggerVisual(sessionId, { force = false } = {}) {
    const agent = ctx.agents.get(sessionId);
    if (agent === undefined) throw new Error('session is not live');
    const state = await store.get(sessionId);
    if (!force && state.settings.autoDraw !== true) return { scheduled: false };
    const turn = currentTurn(ctx, agent);
    scheduleVisual(sessionId, turn, force);
    return { scheduled: true };
  }

  function scheduleVisual(sessionId, turn, force) {
    const key = String(sessionId);
    const queue = queues.get(key) ?? { running: false, pending: null };
    queue.pending = { turn, force };
    queues.set(key, queue);
    if (queue.running) return;
    queue.running = true;
    void (async () => {
      try {
        while (queue.pending !== null) {
          const job = queue.pending;
          queue.pending = null;
          const controller = new AbortController();
          controllers.set(key, controller);
          try {
            await runVisual(key, job, controller.signal);
          } finally {
            controllers.delete(key);
          }
        }
      } finally {
        queue.running = false;
        queues.delete(key);
      }
    })().catch(error => ctx.logger?.warn?.(`[echo-sketch] visual queue failed: ${String(error)}`));
  }

  async function runVisual(sessionId, { turn, force }, signal) {
    const agent = ctx.agents.get(sessionId);
    if (agent === undefined) return;
    const state = await store.get(sessionId);
    if (!force && state.settings.autoDraw !== true) return;
    if (!force && state.agent.source === 'main' && state.agent.sourceTurn === turn) return;
    const fromSeq = state.sidecarChildId !== '' && state.pushCursorSeq > 0
      ? state.pushCursorSeq
      : firstTurnStartSeq(agent.session);
    const delta = renderDelta(agent.session, fromSeq, { includeReasoning: false });
    if (!force && !delta.hasAssistantText) {
      await store.setVisual(sessionId, 'skipped');
      if (delta.nextSeq !== fromSeq) await store.setPushCursor(sessionId, delta.nextSeq);
      return;
    }
    const before = state.agent.revision;
    await store.setVisual(sessionId, 'drawing');
    const text = buildPushText({ turn, delta, force });
    const content = [
      { type: 'text', text },
      ...delta.images.map(attachment => ({ type: 'image', attachment })),
    ];
    try {
      await sidecar.push(agent, content, { signal });
      await store.setPushCursor(sessionId, delta.nextSeq);
      const after = await store.get(sessionId);
      if (after.agent.revision === before) {
        if (force) await store.setAgentError(sessionId, '这次没有生成新图示');
        else await store.setVisual(sessionId, 'skipped');
      }
    } catch (error) {
      await store.setAgentError(sessionId, String(error?.message ?? error));
    }
  }
}

function isMainSession(session, sidecar) {
  if (sidecar.isSidecar(session.id)) return false;
  return session.header?.origin !== 'subagent';
}

function currentTurn(ctx, agent) {
  try {
    return Number(ctx.agents.turnBoundaryOf(agent.session).lastTurn) || 0;
  } catch {
    return 0;
  }
}

function buildPushText({ turn, delta, force }) {
  const parts = [];
  if (force) parts.push('请基于你已收到的最近主对话上下文，重新绘制当前图示。');
  if (delta.text.length > 0) {
    parts.push(`<primary-delta turn="${turn}">\n${delta.text}\n</primary-delta>`);
  }
  if (delta.compacted) parts.push('主 transcript 已发生压缩；以最新的 delta 为准继续。');
  parts.push('如果本轮有值得画的新内容，调用 sketchpad_draw 更新图示；如果没有，可以不调用任何工具，直接结束。工具报错时修正 SVG 后重试。不要提问。');
  return parts.join('\n\n');
}

