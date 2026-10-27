# ADR 0002: 为 Visual Agent 使用独立 preset

- Status: Accepted
- Date: 2026-10-28
- Scope: `dsh-echo-sketch` 的 sidecar 组合与 compaction
- Related: [ADR 0001: Durable Sub Agent](0001-durable-sub-agent.md)

## Context

ADR 0001 的 visual sidecar 默认继承父会话的 agent preset。在 shipped `standard` preset 下：

- context window 为 1,048,576
- `compaction-basic` 默认 thresholdRatio 0.8
- 当前 request 的 maxTokens 为 256,000
- 实际 compaction 阈值约 727,040 tokens

视觉 sidecar 只需要保留最近的主对话增量与图示，不需要接近 1M 的上下文。把它的压缩阈值降到约 256k，可以减少无意义的保留量。

但 preset 决定 compaction 组合，`AgentOptions` 不包含 compaction；直接改全局 preset 会影响所有 standard agent。

## Decision

在插件 bundle 的 `cordis.patch.yml` 中声明一个独立 preset：

```yaml
- id: preset-echo-sketch-visual
  name: '@deepseek-ai/dsh-agent-preset'
  config:
    id: echo-sketch-visual
    name: Sketchpad Visual (sidecar)
    description: Visual-only preset for the dsh-echo-sketch sidecar. Not intended for normal chat.
    order: 50
    plugins:
      - id: compaction
        name: cordis:group
        group: true
        isolate:
          compaction: true
        config:
          - id: compaction-basic
            name: '@deepseek-ai/dsh-compaction-basic'
            config:
              thresholdRatio: 0.24
              retainTokens: 32768
```

visual sidecar 使用：

```js
ctx.subagents.startActivation({
  provider: 'spawn',
  delivery: 'caller',
  childId: 'echo-sketch-sidecar-<uuid>',
  request: {
    parent,
    prompt,
    agentPreset: 'echo-sketch-visual',
    agentOptions,
  },
});
```

该 preset 只提供 sidecar 需要的 compaction；工具仍由 host 的 `tools` 注册表提供，并由 `tools.restrict({ allow: ['sketchpad_draw'] })` 限制。

## Consequences

### Positive

- visual sidecar 在约 251k tokens 时触发 compaction，只保留约 32k verbatim tail（能覆盖最近 delta + 最近一次 `sketchpad_draw` 的完整 SVG），不再按 1M context 的 0.8 阈值运行。
- 不再继承用户当前选择的 standard/PTC/minimal preset；sidecar 组合稳定。
- 只影响 sidecar，不改变普通会话的 compaction。

### Negative

- 新 preset 会作为 **Custom** preset 出现在 DSH 的 Settings / 新会话选择器中；DSH 没有 hidden preset 字段。
- 它的 name/description 明确标注为 sidecar-only，但用户仍可能误选；误选后没有普通聊天工具。
- 新增 preset 是 bundle patch 的一部分，不再只是插件运行时行为；安装/升级需要 profile 重新组合。
- preset 的 `plugins` 是完整组合，不继承 standard；如果 sidecar 将来需要 persona、tool-result pruner 等，需要显式加入。

## Alternatives considered

### 改全局 `compaction-basic` 配置

会影响所有 standard agent，不只是 sidecar，拒绝。

### 保持继承 standard preset

不需要新 preset，也不需要用户可见的 Custom 模式；但 sidecar 会在约 727k 才压缩，且会随用户选择的 preset 改变。当前 sidecar 约 74k，短期可用，但不是本 ADR 的目标。

### 在插件里手动调用 compaction

需要自己追踪 sidecar token、选择 range 和 summary，绕过 DSH 的 preset 组合；复杂度高，且无法保证与 DSH compaction 行为一致。

## References

- [ADR 0001: Durable Sub Agent](0001-durable-sub-agent.md)
- [cordis.patch.yml](../../cordis.patch.yml)
- [src/host/sidecar.js](../../src/host/sidecar.js)
