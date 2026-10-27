/** Durable visual subagent 的创建、复用与 delta push。 */

import { randomUUID } from 'node:crypto';

export const SIDECAR_PREFIX = 'echo-sketch-sidecar-';
export const VISUAL_PRESET_ID = 'echo-sketch-visual';

const VISUAL_PROMPT = [
  'You are the visual sidecar agent for the main conversation.',
  'Each input is an incremental transcript delta since the last turn (excluding reasoning).',
  '',
  '## When to Draw',
  '- If the latest assistant response contains ideas, structures, workflows, comparisons, or states worth visualizing, draw a clear, self-contained SVG diagram by calling `sketchpad_draw({ title, svg })`.',
  '- If the turn is only greetings, brief acknowledgments, repetitions, or the current diagram remains accurate, do not call any tool and finish immediately.',
  '- You may call `sketchpad_draw` multiple times; if the tool returns an error, fix the SVG and retry.',
  '',
  '## Visual-First Principles (Show, Do Not Write)',
  '- Communicate through visual elements: shapes, icons, spatial layout, containment, directional arrows, timelines, scales, and color coding.',
  '- Do NOT turn the SVG into a text slide, markdown card, or bulleted list.',
  '- Keep `<text>` strictly to short labels (1-4 words per label). Never write full sentences, paragraphs, or code blocks inside the SVG.',
  '- Whenever a concept can be represented by a visual metaphor, path, icon, or structural relationship instead of words, always prefer the visual form.',
].join('\n');

const PUSH_TIMEOUT_MS = 120_000;
const CHILD_TIMEOUT_MS = 15_000;

/**
 * 管理每个主会话一个的 visual sidecar。
 */
export class SidecarManager {
  constructor({ ctx, store, logger }) {
    this.ctx = ctx;
    this.store = store;
    this.logger = logger;
    this.childToMain = new Map();
    this.routes = new Map();
    this.activations = new Map();
    this.waiters = new Map();
  }

  /** 是否为 visual sidecar child。 */
  isSidecar(id) {
    return String(id ?? '').startsWith(SIDECAR_PREFIX);
  }

  /** sidecar child 对应的主会话 id。 */
  mainSessionOf(id) {
    return this.childToMain.get(String(id ?? ''));
  }

  /** 处理 agent/created：创建与 cold resume 都会调用。 */
  configureChild(agent) {
    if (!this.isSidecar(agent.id)) return;
    const childId = String(agent.id);
    const mainSessionId = this.mainSessionOf(childId);
    if (mainSessionId !== undefined) {
      this.store.setVisual(mainSessionId, 'drawing').catch(() => undefined);
    }
    agent.ctx.systemPrompt.context({
      name: 'echo-sketch:visual',
      order: 130,
      text: VISUAL_PROMPT,
    });
    agent.ctx.tools.restrict({ allow: ['sketchpad_draw'] });
    agent.ctx.tools.guard(exec => (exec.name === 'sketchpad_draw' ? undefined : 'visual sidecar 只允许调用 sketchpad_draw'));
    const route = this.routes.get(childId);
    if (route !== undefined) this.selectRoute(agent, route);
    this.resolveWaiter(childId, agent);
  }

  /**
   * 向 sidecar push 一段上下文；首次调用会创建 child。
   * 返回 childId。
   */
  async push(mainAgent, content, { signal, retry = true } = {}) {
    const state = await this.store.get(mainAgent.id);
    let childId = state.sidecarChildId;
    if (childId === '') {
      childId = `${SIDECAR_PREFIX}${randomUUID()}`;
      this.childToMain.set(childId, String(mainAgent.id));
      await this.store.setSidecarChildId(mainAgent.id, childId);
      const route = await this.prepareRoute(childId, mainAgent);
      const activation = await this.ctx.subagents.startActivation({
        provider: 'spawn',
        childId,
        label: '画板 Sidecar',
        delivery: 'caller',
        signal,
        request: {
          parent: mainAgent,
          prompt: content,
          agentPreset: VISUAL_PRESET_ID,
          agentOptions: this.agentOptions(route),
        },
      });
      this.activations.set(String(mainAgent.id), { childId, activation });
      const child = await this.waitForChild(childId);
      if (child === undefined) throw new Error('visual sidecar 启动超时');
      await this.awaitIdle(child, signal);
      return childId;
    }
    this.childToMain.set(childId, String(mainAgent.id));
    const route = await this.prepareRoute(childId, mainAgent);
    const live = this.ctx.agents.get(childId);
    if (live !== undefined) this.selectRoute(live, route);
    const waiter = live === undefined ? this.waitForChild(childId) : undefined;
    try {
      await this.ctx.subagents.sendMessage(mainAgent, childId, content, { signal });
    } catch (error) {
      if (!retry || signal?.aborted) throw error;
      this.childToMain.delete(childId);
      await this.store.setSidecarChildId(mainAgent.id, '');
      return this.push(mainAgent, content, { signal, retry: false });
    }
    const child = live ?? await waiter;
    if (child === undefined) throw new Error('visual sidecar 未能恢复');
    this.selectRoute(child, route);
    await this.awaitIdle(child, signal);
    return childId;
  }

  /** 释放主会话对应的 activation；child Session 保留以便 cold resume。 */
  async dispose(mainSessionId) {
    const key = String(mainSessionId);
    const record = this.activations.get(key);
    this.activations.delete(key);
    this.store.setVisual(key, 'idle').catch(() => undefined);
    if (record === undefined) return;
    await record.activation.dispose().catch(error => {
      this.logger?.warn?.(`[echo-sketch] sidecar dispose failed: ${String(error)}`);
    });
  }

  /** 释放所有 activation。 */
  async disposeAll() {
    const keys = [...this.activations.keys()];
    await Promise.all(keys.map(key => this.dispose(key)));
  }

  /** 解析主 Agent 当前路由，并决定 sidecar 的 reasoning effort。 */
  async prepareRoute(childId, mainAgent) {
    const config = mainAgent.session?.requestHeader?.()?.config ?? mainAgent.options ?? {};
    const route = {
      provider: config.provider,
      model: config.model,
    };
    if (typeof route.provider !== 'string' || typeof route.model !== 'string') {
      throw new Error('主 Agent 当前没有可用的 provider/model');
    }
    try {
      const info = await this.ctx.llm.resolveModelInfo(route.provider, route.model);
      const efforts = Array.isArray(info?.reasoning?.efforts) ? info.reasoning.efforts : [];
      if (efforts.some(effort => effort?.id === 'low')) route.reasoningEffort = 'low';
    } catch {
    }
    this.routes.set(String(childId), route);
    return route;
  }

  /** 将路由应用到 live child；失败时回退到 provider/model。 */
  selectRoute(agent, route) {
    try {
      agent.model.select({
        provider: route.provider,
        model: route.model,
        ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort }),
      });
    } catch (error) {
      this.logger?.warn?.(`[echo-sketch] sidecar model select failed: ${String(error)}`);
    }
  }

  /** 构造 sidecar 的 AgentOptions。 */
  agentOptions(route) {
    return {
      provider: route.provider,
      model: route.model,
      ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort }),
      maxTokens: 8192,
    };
  }

  /** 等待 child 出现在 agent registry（cold resume 时用）。 */
  waitForChild(childId) {
    const live = this.ctx.agents.get(childId);
    if (live !== undefined) return Promise.resolve(live);
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.waiters.delete(childId);
        resolve(undefined);
      }, CHILD_TIMEOUT_MS);
      this.waiters.set(childId, agent => {
        clearTimeout(timer);
        resolve(agent);
      });
    });
  }

  /** 唤醒等待者。 */
  resolveWaiter(childId, agent) {
    const waiter = this.waiters.get(childId);
    if (waiter === undefined) return;
    this.waiters.delete(childId);
    waiter(agent);
  }

  /** 等待 child idle；超时或 abort 抛错。 */
  async awaitIdle(child, signal) {
    if (signal?.aborted) throw new Error('visual sidecar 请求已取消');
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('visual sidecar 绘制超时')), PUSH_TIMEOUT_MS);
    });
    const aborted = new Promise((_, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason ?? new Error('请求已取消')), { once: true });
    });
    try {
      await Promise.race([child.whenIdle(), timeout, aborted]);
    } finally {
      clearTimeout(timer);
    }
  }
}
