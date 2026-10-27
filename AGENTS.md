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

- **Main Agent** — 处理用户正常对话主循环的宿主会话 Agent。
- **Visual Agent** — 每个主会话绑定的 durable visual subagent（sidecar），负责在主对话轮次结束后生成或更新视觉图示。
- **User Canvas** — 用户专属的手绘涂鸦画板，供用户绘制草图并作为多模态图像输入传给 Agent。
- **Agent Canvas** — 展示 Visual Agent 所生成 SVG 视觉图示的独立画板。

## Policies & Mandatory Rules

### Less Comment

不写实现注释.
API Doc Comments 写:

- 一句话用途
- 参数含义
- 返回值含义
- 边界情况

### Client Copy

客户端 UI 文案统一放在 `src/client/locales.js` 的 `echoSketch` namespace，通过 DSH `ctx.locale.register` / `ctx.locale.bind` 使用；必须同时提供 `zh` 与 `en`。组件内不写死中文。

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
