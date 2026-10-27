# dsh-echo-sketch AGENTS.md

## Project Structure Guide

`dsh-echo-sketch` 是 DeepSeek Harness (DSH) 的双画板视觉交流插件。

### Repo Structure & Important Files

```text
.
├── README.md                   # 面向用户的插件简介与安装说明
├── AGENTS.md                   # 面向开发 Agent 的架构、规范与操作指南
├── package.json                # pnpm 包配置与脚本声明
├── cordis.patch.yml            # DSH bundle 插件挂载声明
├── justfile                    # 常用开发任务命令入口
├── src/                        # 全部手写源码
│   ├── host/                   # 宿主端源码（Node ESM）
│   └── client/                 # 浏览器端源码（React 画板组件与样式）
├── dist/                       # 构建产物（dist/index.js, dist/client.js），由构建脚本统一生成
├── scripts/
│   └── build.mjs               # 构建脚本（src/ -> dist/）
├── tests/                      # 自动化单元测试（node:test）
└── docs/
    ├── design.md               # 设计文档
    └── adr/                    # 架构决策记录
```

## Domain Language

- **Main Agent** — 处理用户正常对话主循环的宿主会话 Agent，其上下文中不包含画图提示词。
- **Visual Agent** — 每个主会话一个的 durable visual subagent（sidecar）；主 Agent 轮次结束后，宿主把增量 transcript delta（不含 reasoning）push 给它，由它自己的 agent loop 调用 `sketchpad_draw`。
- **User Canvas** — 用户专属的手绘涂鸦画板，供用户绘制草图并作为多模态图像输入传给 Agent。
- **Agent Canvas** — 展示 Visual Agent 在每轮对话结束后所生成视觉图示的独立画板。

## Sidecar Constraints

- 用 `ctx.subagents.startActivation({ provider:'spawn', childId, delivery:'caller', ... })` 创建；child 是合法 subagent，会出现在父级 subagent 目录/lineage。
- 后续 push 用 `ctx.subagents.sendMessage(mainAgent, childId, content, { signal })`；不要用 `startActivation` 复用同一个 childId（会 `DUPLICATE_CHILD`）。
- `agent/created` 在 create 与 cold resume 都会触发；在这里挂 visual prompt 和 `tools.restrict({ allow:['sketchpad_draw'] })`。不要轻易用 `complete:true`。
- sidecar 的 `origin` 是 `subagent`；主 `turn/end` 必须过滤，避免递归。cold resume 后 `delivery: 'caller'` 不再生效，`subagent-settled` notice 会唤醒父会话：主 Agent 的 `agent/pre-step` 首步若只领取到本 sidecar 的 notice，就清空 messages，不跑模型；`delta.isVisualizableTurn` 在 `turn/end` 兜底跳过空 turn / 纯 notice turn。
- push 的 delta 不含 reasoning；首次创建从当前 turn 起点开始，避免回放全部历史。
- raw SVG 只保留最新一份在 CanvasStore；sidecar transcript 中的历史 SVG 由 DSH compaction 管理。
- `sketchpad_read` 的 PNG 只走按需渲染桥；不要自动上传每一笔/每一轮图片。

## Policies & Mandatory Rules

### Less Comment

不写实现注释.
API Doc Comments 写:

- 一句话用途
- 参数含义
- 返回值含义
- 边界情况

### Compatibility Policy

本项目处于 `0.x` 早期迭代阶段，优先保持代码简洁直接，不为未发布的旧内部接口保留兼容层。

## Operation Guide

安装依赖：

```bash
pnpm install
```

构建产物（从 `src/` 生成 `dist/`）：

```bash
pnpm run build
```

运行语法检查与单元测试：

```bash
pnpm run check && pnpm test
```
