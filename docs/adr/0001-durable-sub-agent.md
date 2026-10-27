# ADR 0001: 使用 Durable Sub Agent 作为 Visual Agent

- Status: Accepted
- Date: 2026-10-27
- Scope: `dsh-echo-sketch` 的 Agent 图示生成链路
- Related: [Design](../design.md)

## Context

`dsh-echo-sketch` 需要在一轮主对话结束后，把主 Agent 的回答画成一张 SVG 图示，同时满足：

- 不把画图提示词和画图过程塞进主 Agent 的上下文；
- 画图方有真正的 DSH agent loop，能调用工具、接收工具错误并自行修正；
- 能复用上一轮的视觉上下文，避免每轮从零开始；
- 只使用 DSH 的公开插件 API。

DSH `0.2.1-rc.3` 的 shipped Web/Desktop 组合不提供“真 agent loop + 无 durable Session + 不进入 session/subagent 列表”的临时 fork。`ReactLoopAgent` 必须绑定 `Session`；公开的 fork subagent 仍会创建 durable child Session，并写入 subagent catalog；`dispose()` 也不会删除持久化会话。这是本 ADR 的约束前提。

因此临时 fork 方案不可行；手写一个 `ctx.llm.stream` 循环虽然能避免 Session，但那是自维护的 loop，不是 DSH 的 agent loop，工具执行、错误回传、hooks、compaction 都要自己承担，维护成本过高。

## Decision

每个主 Session 使用一个 **durable visual sidecar**，按需创建并跨轮复用。

### 创建与复用

- 首次需要绘图时调用：

  ```js
  ctx.subagents.startActivation({
    provider: 'spawn',
    childId: 'echo-sketch-sidecar-<uuid>',
    label: '画板 Sidecar',
    delivery: 'caller',
    request: {
      parent: mainAgent,
      prompt: content,
      agentOptions: { provider, model, reasoningEffort: 'low', maxTokens: 8192 },
    },
  });
  ```

  `reasoningEffort` 仅在模型支持 `low` 时设置。

- 后续轮次使用 `ctx.subagents.sendMessage(mainAgent, childId, content, { signal })`，不重复 `startActivation`，避免 `DUPLICATE_CHILD`。
- 如果 child 不在内存中，DSH 会从持久化 Session cold resume；`agent/created` 在 create 与 cold resume 都会触发，用于重新挂载 visual prompt 和工具限制。

### 输入上下文

- 主 Session 保存 `pushCursorSeq`；每次只把该 cursor 之后的新事件渲染成 delta。
- delta 只包含 user/assistant 文本、tool call、tool result 与用户图片；**不包含 reasoning**。
- 首次创建从当前 turn 起点开始，避免回放全部历史。
- sidecar 的 raw SVG 留在它自己的 transcript 中；DSH compaction 负责增长控制。

### 工具与输出

- sidecar 只允许 `sketchpad_draw`：通过 `tools.restrict({ allow: ['sketchpad_draw'] })` 和 guard 双重限制。
- `sketchpad_draw({ title, svg })` 校验并保存 SVG；校验失败作为 tool error 返回，sidecar 可以在自己的 loop 中修正后重试。
- 允许 **skip**：本轮没有值得画的新内容时，sidecar 可以不调用任何工具直接结束。host 记录 `skipped`，保留上一张图，不视为失败。
- 手动“重新绘制”仍未产出新图时，记录可读错误，便于用户知道没有更新。

### 防止递归

sidecar 的 `origin` 是 `subagent`，主 `turn/end` 会过滤 sidecar 自己的 turn。

此外，DSH 的 `delivery: 'caller'` 只对当前 activation 生效；cold resume 后可能回退为 `parent`，并通过 `subagent-settled` notice 唤醒父会话。

host 在 `agent/pre-step` 的第一 step 拦截：如果本批消息全部是本 sidecar 的 `subagent-settled` notice，就返回空的 `messages`。该 turn 不进入模型调用，主 Agent 不产生回复，也不会再次触发视觉调度。真实用户消息、其他子代理的 notice 或混合批次都保持原样。

`turn/end` 再用 `isVisualizableTurn` 兜底：纯 settlement turn 和没有用户/assistant 内容的空 turn 不触发绘图。

## Consequences

### Positive

- 使用真正的 DSH agent loop，具备工具调用、错误回传、重试、hooks 与 compaction。
- 主 Agent 上下文不含画图提示词，画图失败也不会打断主回答。
- sidecar 跨轮复用，保留视觉上下文，图示风格更连续。
- 只依赖公开插件 API；不需要维护 DSH 内部补丁。
- 允许 skip，避免为了“必须调用工具”而生成低价值图示。

### Negative

- sidecar 是一个合法的 durable child Session，会出现在父会话的 subagent 目录/lineage。
- 常驻期间占用一个 `maxActiveSubagents` 槽位。
- raw SVG 会进入 sidecar transcript，长期会话依赖 compaction。
- cold resume 后的 `delivery` 行为不受插件控制，必须依赖 host 侧的 `agent/pre-step` 拦截与 `turn/end` 判断。
- 每个主 Session 一个 sidecar，不能在同一 Session 内并行生成多张图。

### Operational notes

- `sketchpad_read` 的 PNG 渲染依赖浏览器画板 tab 处于 mounted 状态；否则返回提示而不是图片。
- CanvasStore 只保留最新用户笔画与最新 Agent SVG，不保存历史。
- 图示生成失败时保留上一张图，并记录错误；下一轮成功绘制会清除旧错误。

## Alternatives considered

### Fork temporary agent

不可行。DSH 的 shipped profile 中不存在“真 agent loop + 无 durable Session + 不进 session/subagent 列表”的临时 fork；fork subagent 仍是 durable child Session。

### 手写 `ctx.llm.stream` loop

能避免 Session，但不再是 DSH 的 agent loop；工具调度、错误回传、compaction、hooks 都要自己实现，维护成本高，且容易与 DSH 行为漂移。

### 主 Agent 直接调用 `sketchpad_draw`

会污染主 Agent 上下文，并且把“回答”和“画图”绑在同一轮里；画图失败会影响主回答，无法独立重试。

### 每轮新建一个 subagent

仍然是 durable child Session，且每轮都要创建/销毁 activation，成本更高；无法保留视觉上下文。

## References

- [Design](../design.md)
- [DSH Discussion #9291: delivery caller is not persisted](https://github.com/deepseek-ai/deepseek-harness/discussions/9291)
