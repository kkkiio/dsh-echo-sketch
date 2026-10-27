# dsh-echo-sketch

Ideas deserve a visual language.

**dsh-echo-sketch** is a DeepSeek Harness plugin that bridges human-agent communication through a dual-canvas sketchpad — turning obscure agent responses into intuitive visual representations while giving you a dedicated canvas to sketch and share your own ideas.

## Features

- **Agent Sketchpad**: Automatically visualizes the agent's final response into an image after each turn, without polluting the main conversation context.
- **User Sketchpad**: Provides a dedicated drawing canvas for you to sketch ideas and share them visually with the agent (great with a tablet or stylus!).
- **Compact Dual-View**: Easily toggle between your canvas and the agent's canvas in a single view while the agent sees both.

## Requirements

- DeepSeek Harness `0.2.1-rc.3` (Web or Desktop profile).
- Node.js `>=22.19`.
- For the main agent to actually see canvas images, use an image-capable model.

## Installation

```bash
# web
dsh plugin --profile web add dsh-echo-sketch

# desktop
dsh plugin --profile desktop add dsh-echo-sketch
```

## Usage

TODO
