/** 主会话 → visual sidecar 的增量上下文渲染（纯函数）。 */

const MAX_DELTA_CHARS = 20_000;
const MAX_TEXT_PART = 3_000;
const MAX_TOOL_ARGS = 500;
const MAX_TOOL_RESULT = 1_500;

/**
 * 渲染自 fromSeq 以来新的主会话 delta。
 * 只包含 user/assistant 文本、tool call/result 与轮次标记；不包含 reasoning。
 * @param {{ snapshotEvents?: () => Array<{ type: string, data?: any }> }} session
 * @param {number} fromSeq
 * @param {{includeReasoning?: boolean}} [options]
 * @returns {{text: string, nextSeq: number, hasAssistantText: boolean, compacted: boolean, images: Array<object>}}
 */
export function renderDelta(session, fromSeq, options = {}) {
  const events =
    typeof session?.snapshotEvents === "function"
      ? session.snapshotEvents()
      : [];
  const start = clampIndex(fromSeq, events.length);
  const parts = [];
  const images = [];
  const imageIds = new Set();
  const callNames = new Map();
  let hasAssistantText = false;
  let compacted = false;
  for (const event of events.slice(start)) {
    switch (event.type) {
      case "user/message":
        appendUserMessage(parts, event.data, images, imageIds);
        break;
      case "assistant/message":
        hasAssistantText =
          appendAssistantMessage(
            parts,
            event.data?.message,
            options.includeReasoning === true,
            callNames,
            images,
            imageIds,
          ) || hasAssistantText;
        break;
      case "tool/result":
        appendToolResult(parts, event.data?.message, callNames);
        break;
      case "turn/start":
        parts.push(`［turn ${event.data?.turn ?? "?"} start］`);
        break;
      case "turn/end":
        parts.push(`［turn ${event.data?.turn ?? "?"} end］`);
        break;
      case "compaction/start":
      case "compaction/summary":
      case "compaction/end":
        compacted = true;
        break;
      default:
        break;
    }
  }
  const text = capText(parts.filter((part) => part.length > 0).join("\n\n"));
  return { text, nextSeq: events.length, hasAssistantText, compacted, images };
}

/**
 * 取自上次 cursor 以来新增事件的末尾 seq；用于 compaction 后 reset。
 * @param {{ snapshotEvents?: () => Array<{ type: string, data?: any }> }} session
 * @returns {number}
 */
export function endSeqOf(session) {
  return typeof session?.snapshotEvents === "function"
    ? session.snapshotEvents().length
    : 0;
}

/**
 * 当前 turn 的起点 seq；首次创建 sidecar 时用它避免回放整段历史。
 * @param {{ snapshotEvents?: () => Array<{ type: string, data?: any }> }} session
 * @returns {number}
 */
export function firstTurnStartSeq(session) {
  const events =
    typeof session?.snapshotEvents === "function"
      ? session.snapshotEvents()
      : [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].type === "turn/start") return index;
  }
  return 0;
}

/**
 * 最后一条非空 assistant 文本；用于判断本轮是否值得绘图。
 * @param {{ snapshotEvents?: () => Array<{ type: string, data?: any }> }} session
 * @returns {string}
 */
export function lastAssistantText(session) {
  const events =
    typeof session?.snapshotEvents === "function"
      ? session.snapshotEvents()
      : [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type !== "assistant/message") continue;
    const text = textOfBlocks(event.data?.message?.content);
    if (text.trim().length > 0) return text.trim();
  }
  return "";
}

function appendUserMessage(parts, message, images, imageIds) {
  if (message?.source?.kind !== "user") return;
  const text = textOfBlocks(message.content).trim();
  const blocks = [];
  if (text.length > 0) blocks.push(truncate(text, MAX_TEXT_PART));
  for (const block of Array.isArray(message.content) ? message.content : []) {
    if (block?.type !== "image" || block.attachment === undefined) continue;
    const id = String(block.attachment.attachmentId ?? "");
    if (id.length > 0 && !imageIds.has(id)) {
      imageIds.add(id);
      images.push(block.attachment);
    }
    blocks.push("[image]");
  }
  if (blocks.length > 0) parts.push(`user:\n${blocks.join("\n")}`);
}

function appendAssistantMessage(
  parts,
  message,
  includeReasoning,
  callNames,
  images,
  imageIds,
) {
  if (message === undefined || !Array.isArray(message.content)) return false;
  const blocks = [];
  let hasText = false;
  for (const block of message.content) {
    if (
      block?.type === "text" &&
      typeof block.text === "string" &&
      block.text.trim().length > 0
    ) {
      blocks.push(truncate(block.text.trim(), MAX_TEXT_PART));
      hasText = true;
    } else if (
      block?.type === "reasoning" &&
      includeReasoning &&
      typeof block.text === "string"
    ) {
      blocks.push(
        `<reasoning>${truncate(block.text.trim(), MAX_TEXT_PART)}</reasoning>`,
      );
    } else if (block?.type === "tool-call") {
      const id = String(block.id ?? "");
      if (id.length > 0) callNames.set(id, String(block.name ?? ""));
      blocks.push(
        `tool-call ${String(block.name ?? "")}: ${truncate(String(block.arguments ?? ""), MAX_TOOL_ARGS)}`,
      );
    } else if (block?.type === "image" && block.attachment !== undefined) {
      const id = String(block.attachment.attachmentId ?? "");
      if (id.length > 0 && !imageIds.has(id)) {
        imageIds.add(id);
        images.push(block.attachment);
      }
      blocks.push("[image]");
    }
  }
  if (blocks.length > 0) parts.push(`assistant:\n${blocks.join("\n")}`);
  return hasText;
}

function appendToolResult(parts, message, callNames) {
  if (message === undefined) return;
  const text = textOfBlocks(message.content).trim();
  if (text.length === 0) return;
  const callId = String(message.toolCallId ?? message.source?.callId ?? "");
  const name = callNames.get(callId) ?? "tool";
  parts.push(`tool-result ${name}:\n${truncate(text, MAX_TOOL_RESULT)}`);
}

function textOfBlocks(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
}

function truncate(value, max) {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function capText(text) {
  if (text.length <= MAX_DELTA_CHARS) return text;
  return `…earlier delta omitted…\n${text.slice(text.length - MAX_DELTA_CHARS)}`;
}

function clampIndex(value, length) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(Math.floor(number), length);
}

/**
 * 判断一个 turn 是否有值得绘制的模型可见内容。
 * @param {{ snapshotEvents?: () => Array<{ type: string, data?: any }> }} session
 * @param {number} turn
 * @param {(source: { kind?: string, senderSessionId?: any }) => boolean} [isSuppressedSource] 判定应忽略的 notice 来源
 * @returns {boolean} 仅被抑制的 notice、或完全没有用户/assistant 内容时为 false
 */
export function isVisualizableTurn(
  session,
  turn,
  isSuppressedSource = (source) => source?.kind === "subagent-settled",
) {
  const events =
    typeof session?.snapshotEvents === "function"
      ? session.snapshotEvents()
      : [];
  let start = -1;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (
      events[index].type === "turn/start" &&
      events[index].data?.turn === turn
    ) {
      start = index;
      break;
    }
  }
  if (start < 0) return true;
  const kinds = [];
  let hasAssistant = false;
  for (let index = start; index < events.length; index += 1) {
    const event = events[index];
    if (event.type === "turn/end" && event.data?.turn === turn) break;
    if (event.type === "assistant/message") {
      hasAssistant = true;
      continue;
    }
    if (event.type !== "user/message") continue;
    const kind = event.data?.source?.kind;
    if (typeof kind === "string" && kind !== "runtime-context")
      kinds.push(kind);
  }
  if (kinds.length > 0)
    return !kinds.every((kind) => isSuppressedSource({ kind }));
  return hasAssistant;
}
