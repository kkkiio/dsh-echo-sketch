/** Web Client：右侧栏双画板入口。 */

import React from 'react';
import { Sketchpad } from './Sketchpad.jsx';
import { Icon } from './icons.jsx';
import { CSS } from './styles.js';

const ID = 'dsh-echo-sketch';
const KIND = 'echo-sketch';

export const name = 'echo-sketch';
export const inject = ['slots', 'sidebarRightTabs', 'sidebarRight', 'sessions'];

/** 注册 tab、header action 与样式。 */
export function apply(ctx) {
  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = ID;
    style.textContent = CSS;
    document.head.append(style);
    return () => style.remove();
  }, 'echo-sketch: styles');

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: ID,
    kind: KIND,
    title: () => '双画板',
    keepMounted: true,
    guide: [{
      order: 40,
      title: () => '双画板',
      description: () => '画给 Agent 看，也看 Agent 画。你的草图和 Agent 的图示都在这里。',
    }],
  }), 'echo-sketch: tab type');

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: ID },
    props => React.createElement(Boundary, null, React.createElement(Sketchpad, { ...props, ctx })),
  )), 'echo-sketch: tab body');

  ctx.effect(() => ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register(
    {
      name: 'conversation.session.header.actions',
      id: ID,
      order: 15,
      inject: () => ({ open: () => ctx.sidebarRight.openTab(KIND) }),
    },
    HeaderButton,
  )), 'echo-sketch: header action');
}

/** 会话头部打开画板的按钮。 */
export function HeaderButton({ open }) {
  return React.createElement('button', {
    type: 'button',
    className: 'echo-sketch-header-action echo-sketch-tool echo-sketch-tip-bottom',
    'aria-label': '打开双画板',
    'data-tip': '打开双画板',
    onClick: open,
  }, React.createElement(Icon, { name: 'brand', size: 17 }));
}

class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error !== null) {
      return React.createElement('div', { className: 'echo-sketch-fatal' }, `画板加载失败：${String(this.state.error?.message ?? this.state.error)}`);
    }
    return this.props.children;
  }
}
