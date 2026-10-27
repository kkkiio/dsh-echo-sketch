/** 主 Agent 读取画板时的按需渲染桥。 */

import { randomUUID } from "node:crypto";

const MAX_PNG_BYTES = 8 * 1024 * 1024;

/**
 * 维护每个会话的 PNG 渲染请求；客户端轮询到请求后回传 base64。
 */
export class RenderBridge {
  /** @param {{ ctx?: any, store?: any, logger?: any, timeoutMs?: number }} [options] */
  constructor({ ctx, store, logger, timeoutMs = 8000 } = {}) {
    this.ctx = ctx;
    this.store = store;
    this.logger = logger;
    this.timeoutMs = timeoutMs;
    this.cache = new Map();
    this.pending = new Map();
    this.queues = new Map();
  }

  /** 当前待渲染请求（供 state 路由返回）。 */
  currentRequest(sessionId) {
    const pending = this.pending.get(String(sessionId));
    if (pending === undefined) return null;
    return { requestId: pending.requestId, target: pending.target };
  }

  /**
   * 请求客户端渲染 user/agent 画板，并返回已保存的附件引用。
   * 同会话请求串行；超时/取消返回空结果而不抛穿工具。
   */
  async request(sessionId, target, signal) {
    const key = String(sessionId);
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => this.requestNow(key, target, signal));
    this.queues.set(key, next);
    void next.finally(() => {
      if (this.queues.get(key) === next) this.queues.delete(key);
    });
    return next;
  }

  /** 接收客户端回传；返回是否接受。 */
  async accept(sessionId, requestId, images, errors = []) {
    const key = String(sessionId);
    const pending = this.pending.get(key);
    if (pending === undefined || pending.requestId !== requestId) return false;
    clearTimeout(pending.timer);
    this.pending.delete(key);
    const accepted = [];
    const failures = [...(Array.isArray(errors) ? errors : [])];
    const state = await this.store.get(key);
    for (const image of Array.isArray(images) ? images : []) {
      const saved = await this.saveImage(key, state, pending.target, image);
      if (saved.ok) accepted.push(saved.value);
      else failures.push(saved.error);
    }
    pending.resolve({
      images: accepted,
      note:
        accepted.length > 0 ? "" : (failures[0] ?? "画板没有返回可用的图片"),
      errors: failures,
    });
    return true;
  }

  /** 清理会话缓存/请求。 */
  clear(sessionId) {
    const key = String(sessionId);
    const pending = this.pending.get(key);
    if (pending !== undefined) {
      clearTimeout(pending.timer);
      pending.resolve({ images: [], note: "会话已结束", errors: [] });
    }
    this.pending.delete(key);
    this.cache.delete(key);
    this.queues.delete(key);
  }

  /** 单次请求实现：缓存命中直接返回，否则挂起等待客户端。 */
  async requestNow(sessionId, target, signal) {
    const normalizedTarget = target === "user" ? "user" : "agent";
    const state = await this.store.get(sessionId);
    const revision = state[normalizedTarget].revision;
    const cached = this.cache.get(sessionId)?.[normalizedTarget];
    if (cached?.revision === revision) {
      return { images: [cached], note: "", errors: [] };
    }
    if (signal?.aborted) return { images: [], note: "请求已取消", errors: [] };
    const attachments = this.ctx.get("attachments");
    if (attachments === undefined) {
      return {
        images: [],
        note: "当前部署没有附件服务，无法把画板转成图片",
        errors: [],
      };
    }
    const existing = this.pending.get(sessionId);
    if (existing !== undefined) {
      return { images: [], note: "画板正在渲染中，请稍后重试", errors: [] };
    }
    const requestId = randomUUID();
    const promise = new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(sessionId);
        resolve({
          images: [],
          note: "画板未在 8 秒内响应；请打开双画板后重试",
          errors: [],
        });
      }, this.timeoutMs);
      const onAbort = () => {
        clearTimeout(timer);
        this.pending.delete(sessionId);
        resolve({ images: [], note: "请求已取消", errors: [] });
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      this.pending.set(sessionId, {
        requestId,
        target: normalizedTarget,
        timer,
        resolve: (value) => {
          signal?.removeEventListener("abort", onAbort);
          resolve(value);
        },
      });
    });
    return promise;
  }

  /** 校验并保存客户端回传的一张 PNG。 */
  async saveImage(sessionId, state, target, image) {
    if (image?.kind !== target)
      return { ok: false, error: `渲染结果类型不匹配: ${String(image?.kind)}` };
    const revision = Number(image.revision);
    if (revision !== state[target].revision)
      return { ok: false, error: "画板 revision 已变化，丢弃旧渲染结果" };
    if (typeof image.png !== "string" || image.png.length === 0)
      return { ok: false, error: "PNG 为空" };
    const data = Buffer.from(image.png, "base64");
    if (data.byteLength === 0) return { ok: false, error: "PNG 解码为空" };
    if (data.byteLength > MAX_PNG_BYTES)
      return { ok: false, error: `PNG 过大（${data.byteLength} 字节）` };
    const attachments = this.ctx.get("attachments");
    if (attachments === undefined)
      return { ok: false, error: "当前部署没有附件服务" };
    try {
      const ref = await attachments.saveImage({
        data: new Uint8Array(data),
        mediaType: "image/png",
        name: `echo-sketch-${target}-${revision}.png`,
      });
      const entry = { revision, ref };
      const cached = this.cache.get(sessionId) ?? {};
      cached[target] = entry;
      this.cache.set(sessionId, cached);
      return { ok: true, value: entry };
    } catch (error) {
      return {
        ok: false,
        error: `保存图片失败: ${String(error?.message ?? error)}`,
      };
    }
  }

  /** 把附件引用转为模型可见的 image blocks。 */
  static imageBlocks(images) {
    return (Array.isArray(images) ? images : [])
      .map((image) => image?.ref)
      .filter((ref) => ref !== undefined)
      .map((ref) => ({ type: "image", attachment: ref }));
  }
}
