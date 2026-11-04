/** sketchpad_draw / sketchpad_read 工具定义。 */

import { defineTool } from "@deepseek-ai/dsh-tools";
import { normalizeAgentSvg } from "./canvas-svg.js";

/**
 * 创建并注册两个工具。
 * @param {any} ctx
 * @param {{ store: any, bridge: any, sidecar: any }} deps
 * @returns {Array<() => void>}
 */
export function registerSketchpadTools(ctx, { store, bridge, sidecar }) {
  const draw = defineTool({
    name: "sketchpad_draw",
    description:
      "更新 Agent 视觉画板：传入一张独立 SVG。自动视觉 sidecar 会调用它；主 Agent 也可在用户明确要求改图时调用。",
    parameters: {
      svg: {
        type: "string",
        required: true,
        description:
          "完整、独立的 SVG 文档，必须包含 xmlns 与竖版 viewBox（如 0 0 600 900，自上而下布局以适配窄侧栏）；每个 <text> 元素最多 4 个字/词。",
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", required: true },
          revision: { type: "integer", required: true },
        },
      },
      render: (_args, value) => [
        {
          type: "text",
          text: `已更新画板：${value.title}（revision ${value.revision}）`,
        },
      ],
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const normalized = normalizeAgentSvg(args.svg);
      if (normalized.ok === false) throw new Error(normalized.error);
      const mainSessionId = sidecar.isSidecar(exec.agent.id)
        ? sidecar.mainSessionOf(exec.agent.id)
        : String(exec.agent.id);
      if (mainSessionId === undefined)
        throw new Error("找不到这个 sidecar 对应的主会话");
      const mainAgent = ctx.agents.get(mainSessionId);
      const turn = mainAgent === undefined ? 0 : turnOf(ctx, mainAgent);
      const title = normalized.title || "Agent 图示";
      const state = await store.setAgentCanvas(mainSessionId, {
        svg: normalized.svg,
        title,
        source: sidecar.isSidecar(exec.agent.id) ? "auto" : "main",
        sourceTurn: turn,
      });
      return { title, revision: state.agent.revision };
    },
  });

  const read = defineTool({
    name: "sketchpad_read",
    description:
      "读取用户画板或 Agent 画板，返回图片。用户提到草图/画板/图示，或需要对比两张画板时调用。",
    parameters: {
      target: {
        type: "string",
        required: true,
        enum: ["user", "agent"],
        description: "user=用户草图；agent=Agent 图示。",
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          note: { type: "string", required: true },
          images: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: {
                  type: "string",
                  required: true,
                  enum: ["user", "agent"],
                },
                revision: { type: "integer", required: true },
                attachmentId: { type: "string", required: true },
                mediaType: { type: "string", required: true },
                bytes: { type: "integer", required: true },
                width: { type: "integer", required: true },
                height: { type: "integer", required: true },
                name: { type: "string" },
              },
            },
          },
        },
      },
      render: (_args, value) => {
        /** @type {any[]} */
        const blocks = [{ type: "text", text: value.note || "画板图片如下。" }];
        for (const image of value.images) {
          blocks.push({
            type: "image",
            attachment: {
              attachmentId: image.attachmentId,
              mediaType: image.mediaType,
              bytes: image.bytes,
              width: image.width,
              height: image.height,
              ...(image.name === undefined ? {} : { name: image.name }),
            },
          });
        }
        return blocks;
      },
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const mainSessionId = sidecar.isSidecar(exec.agent.id)
        ? sidecar.mainSessionOf(exec.agent.id)
        : String(exec.agent.id);
      if (mainSessionId === undefined)
        throw new Error("找不到这个 sidecar 对应的主会话");
      const result = await bridge.request(
        mainSessionId,
        args.target,
        exec.signal,
      );
      const images = result.images.map((entry) => ({
        kind: args.target,
        revision: entry.revision,
        attachmentId: String(entry.ref.attachmentId),
        mediaType: String(entry.ref.mediaType),
        bytes: Number(entry.ref.bytes),
        width: Number(entry.ref.width),
        height: Number(entry.ref.height),
        ...(entry.ref.name === undefined
          ? {}
          : { name: String(entry.ref.name) }),
      }));
      return {
        note:
          result.note ||
          (images.length > 0 ? "画板图片如下。" : "画板暂时没有可用图片。"),
        images,
      };
    },
  });

  return [ctx.tools.register(draw), ctx.tools.register(read)];
}

function turnOf(ctx, agent) {
  try {
    return Number(ctx.agents.turnBoundaryOf(agent.session).lastTurn) || 0;
  } catch {
    return 0;
  }
}
