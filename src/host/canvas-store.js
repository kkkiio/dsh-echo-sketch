/** 每会话只保留最新画板状态的持久化存储。 */

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  normalizeStrokes,
  sameStrokes,
  strokesToSvg,
} from "./canvas-strokes.js";

/**
 * 创建/读取画板状态，并按会话串行落盘。
 */
export class CanvasStore {
  /** @param {{ dir?: string, logger?: any }} [options] */
  constructor({ dir, logger } = {}) {
    if (typeof dir !== "string" || dir.length === 0)
      throw new Error("CanvasStore 需要 dir");
    this.dir = dir;
    this.logger = logger;
    this.states = new Map();
    this.loads = new Map();
    this.writes = new Map();
    this.mkdirPromise = undefined;
  }

  /** 读取一个会话的当前状态；首次访问时懒加载。 */
  async get(sessionId) {
    const key = String(sessionId);
    const cached = this.states.get(key);
    if (cached !== undefined) return cached;
    const pending = this.loads.get(key);
    if (pending !== undefined) return pending;
    const load = this.load(key).finally(() => {
      this.loads.delete(key);
    });
    this.loads.set(key, load);
    return load;
  }

  /** 保存用户笔画；内容未变时不升 revision。 */
  async saveUserStrokes(sessionId, input) {
    const state = await this.get(sessionId);
    const { strokes } = normalizeStrokes(input);
    if (sameStrokes(state.user.strokes, strokes)) return state;
    state.user = {
      strokes,
      svg: strokesToSvg(strokes),
      revision: state.user.revision + 1,
      updatedAt: Date.now(),
    };
    this.scheduleWrite(sessionId);
    return state;
  }

  /** 清空用户画板。 */
  async clearUserCanvas(sessionId) {
    return this.saveUserStrokes(sessionId, []);
  }

  /** 写入 Agent 画板 SVG。 */
  async setAgentCanvas(sessionId, { svg, title, source, sourceTurn }) {
    const state = await this.get(sessionId);
    state.agent = {
      svg: String(svg ?? ""),
      title: String(title ?? ""),
      revision: state.agent.revision + 1,
      updatedAt: Date.now(),
      sourceTurn: Number.isFinite(Number(sourceTurn)) ? Number(sourceTurn) : 0,
      source: source === "main" ? "main" : "auto",
      error: "",
    };
    state.visual = { status: "ready", error: "", startedAt: 0 };
    this.scheduleWrite(sessionId);
    return state;
  }

  /** 清空 Agent 画板。 */
  async clearAgentCanvas(sessionId) {
    const state = await this.get(sessionId);
    if (
      state.agent.svg === "" &&
      state.agent.title === "" &&
      state.agent.error === ""
    )
      return state;
    state.agent = {
      svg: "",
      title: "",
      revision: state.agent.revision + 1,
      updatedAt: Date.now(),
      sourceTurn: 0,
      source: "auto",
      error: "",
    };
    state.visual = { status: "idle", error: "", startedAt: 0 };
    this.scheduleWrite(sessionId);
    return state;
  }

  /** 记录 Agent 画板错误；保留旧图。 */
  async setAgentError(sessionId, message) {
    const state = await this.get(sessionId);
    const error = String(message ?? "").slice(0, 2000);
    state.agent = { ...state.agent, error };
    state.visual = {
      status: "error",
      error,
      startedAt: state.visual.startedAt,
    };
    this.scheduleWrite(sessionId);
    return state;
  }

  /** 更新内存中的视觉运行状态（不落盘）。 */
  async setVisual(sessionId, status, error = "") {
    const state = await this.get(sessionId);
    state.visual = {
      status,
      error: String(error ?? "").slice(0, 2000),
      startedAt: status === "drawing" ? Date.now() : 0,
    };
    if (status === "drawing" || status === "skipped")
      state.agent = { ...state.agent, error: "" };
    return state;
  }

  /** 更新设置。 */
  async setSettings(sessionId, patch) {
    const state = await this.get(sessionId);
    if (typeof patch?.autoDraw === "boolean")
      state.settings.autoDraw = patch.autoDraw;
    this.scheduleWrite(sessionId);
    return state;
  }

  /** 记录 sidecar child id，供宿主重启后 cold-resume。 */
  async setSidecarChildId(sessionId, childId) {
    const state = await this.get(sessionId);
    state.sidecarChildId = String(childId ?? "");
    this.scheduleWrite(sessionId);
    return state;
  }

  /** 在 child 自己的状态里记录主会话 id，供路由把 sidecar 视图解析回主会话。 */
  async setMainSessionId(sessionId, mainSessionId) {
    const state = await this.get(sessionId);
    const value = String(mainSessionId ?? "");
    if (state.mainSessionId === value) return state;
    state.mainSessionId = value;
    this.scheduleWrite(sessionId);
    return state;
  }

  /** 更新主 transcript 的 push cursor。 */
  async setPushCursor(sessionId, seq) {
    const state = await this.get(sessionId);
    state.pushCursorSeq = Math.max(0, Math.floor(Number(seq) || 0));
    this.scheduleWrite(sessionId);
    return state;
  }

  /** 返回给客户端的公开状态；不含内部 id/cursor。 */
  async publicState(sessionId) {
    const state = await this.get(sessionId);
    return {
      user: {
        strokes: state.user.strokes,
        revision: state.user.revision,
        updatedAt: state.user.updatedAt,
      },
      agent: {
        svg: state.agent.svg,
        title: state.agent.title,
        revision: state.agent.revision,
        updatedAt: state.agent.updatedAt,
        sourceTurn: state.agent.sourceTurn,
        source: state.agent.source,
        error: state.agent.error,
      },
      settings: { autoDraw: state.settings.autoDraw },
      visual: { ...state.visual },
    };
  }

  /** 等待某会话的落盘完成。 */
  async flush(sessionId) {
    const key = String(sessionId);
    while (this.writes.has(key)) {
      const pending = this.writes.get(key);
      if (pending === undefined) break;
      await pending.catch(() => undefined);
    }
  }

  /** 等待所有落盘完成。 */
  async flushAll() {
    while (this.writes.size > 0) {
      await Promise.all(
        [...this.writes.values()].map((promise) =>
          promise.catch(() => undefined),
        ),
      );
    }
  }

  /** 丢弃内存缓存（已落盘内容仍保留）。 */
  forget(sessionId) {
    const key = String(sessionId);
    this.states.delete(key);
    this.loads.delete(key);
  }

  /** 读取文件并恢复为内存状态。 */
  async load(sessionId) {
    const empty = emptyState(sessionId);
    try {
      const text = await readFile(this.pathFor(sessionId), "utf8");
      const parsed = JSON.parse(text);
      this.states.set(sessionId, restoreState(sessionId, parsed));
    } catch (error) {
      if (error?.code !== "ENOENT")
        this.logger?.warn?.(`[echo-sketch] 读取画板状态失败: ${String(error)}`);
      this.states.set(sessionId, empty);
    }
    return this.states.get(sessionId);
  }

  /** 排队写入；同会话写串行。 */
  scheduleWrite(sessionId) {
    const key = String(sessionId);
    const previous = this.writes.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => this.writeNow(key));
    this.writes.set(key, next);
    void next
      .catch((error) =>
        this.logger?.warn?.(`[echo-sketch] 写入画板状态失败: ${String(error)}`),
      )
      .finally(() => {
        if (this.writes.get(key) === next) this.writes.delete(key);
      });
  }

  /** 原子写入当前状态。 */
  async writeNow(sessionId) {
    const state = this.states.get(sessionId);
    if (state === undefined) return;
    this.mkdirPromise ??= mkdir(this.dir, { recursive: true });
    await this.mkdirPromise;
    const path = this.pathFor(sessionId);
    const temp = `${path}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(persistedState(state)), "utf8");
    await rename(temp, path);
  }

  /** 会话对应的 JSON 文件路径。 */
  pathFor(sessionId) {
    const digest = createHash("sha256")
      .update(String(sessionId))
      .digest("hex")
      .slice(0, 32);
    return join(this.dir, `${digest}.json`);
  }
}

function emptyState(sessionId) {
  return {
    version: 1,
    sessionId: String(sessionId),
    user: { strokes: [], svg: "", revision: 0, updatedAt: 0 },
    agent: {
      svg: "",
      title: "",
      revision: 0,
      updatedAt: 0,
      sourceTurn: 0,
      source: "auto",
      error: "",
    },
    settings: { autoDraw: false },
    sidecarChildId: "",
    mainSessionId: "",
    pushCursorSeq: 0,
    visual: { status: "idle", error: "", startedAt: 0 },
  };
}

function restoreState(sessionId, parsed) {
  const state = emptyState(sessionId);
  if (parsed === null || typeof parsed !== "object") return state;
  const { strokes } = normalizeStrokes(parsed.user?.strokes);
  state.user = {
    strokes,
    svg: strokesToSvg(strokes),
    revision: positiveInt(parsed.user?.revision),
    updatedAt: positiveInt(parsed.user?.updatedAt),
  };
  state.agent = {
    svg: typeof parsed.agent?.svg === "string" ? parsed.agent.svg : "",
    title: typeof parsed.agent?.title === "string" ? parsed.agent.title : "",
    revision: positiveInt(parsed.agent?.revision),
    updatedAt: positiveInt(parsed.agent?.updatedAt),
    sourceTurn: positiveInt(parsed.agent?.sourceTurn),
    source: parsed.agent?.source === "main" ? "main" : "auto",
    error: typeof parsed.agent?.error === "string" ? parsed.agent.error : "",
  };
  state.settings.autoDraw = parsed.settings?.autoDraw === true;
  state.sidecarChildId =
    typeof parsed.sidecarChildId === "string" ? parsed.sidecarChildId : "";
  state.mainSessionId =
    typeof parsed.mainSessionId === "string" ? parsed.mainSessionId : "";
  state.pushCursorSeq = positiveInt(parsed.pushCursorSeq);
  return state;
}

function persistedState(state) {
  return {
    version: 1,
    sessionId: state.sessionId,
    user: {
      strokes: state.user.strokes,
      revision: state.user.revision,
      updatedAt: state.user.updatedAt,
    },
    agent: { ...state.agent },
    settings: { ...state.settings },
    sidecarChildId: state.sidecarChildId,
    mainSessionId: state.mainSessionId,
    pushCursorSeq: state.pushCursorSeq,
  };
}

function positiveInt(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}
