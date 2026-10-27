/** Web Client：右侧栏双画板入口。 */

import React from "react";
import { Sketchpad } from "./Sketchpad.jsx";
import { Icon } from "./icons.jsx";
import { en, NS, zh } from "./locales.js";
import { setTranslator, translate } from "./i18n.js";
import { CSS } from "./styles.js";

const ID = "dsh-echo-sketch";
const KIND = "echo-sketch";

export const name = "echo-sketch";
export const inject = [
  "slots",
  "sidebarRightTabs",
  "sidebarRight",
  "sessions",
  "locale",
];

/** 注册 tab、header action 与样式。 */
export function apply(ctx) {
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en }),
    "echo-sketch: dictionaries",
  );
  const t = ctx.locale.bind(NS);
  setTranslator(t);

  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = ID;
    style.textContent = CSS;
    document.head.append(style);
    return () => style.remove();
  }, "echo-sketch: styles");

  ctx.effect(
    () =>
      ctx.sidebarRightTabs.register({
        id: ID,
        kind: KIND,
        title: () => t("tab.title"),
        keepMounted: true,
        guide: [
          {
            order: 40,
            title: () => t("tab.title"),
            description: () => t("tab.description"),
          },
        ],
      }),
    "echo-sketch: tab type",
  );

  ctx.effect(
    () =>
      ctx.slots.inject("sidebar.right.pane.tab", () =>
        ctx.slots.register(
          { name: "sidebar.right.pane.tab", key: ID, locale: NS },
          (props) =>
            React.createElement(
              Boundary,
              { t: props.t },
              React.createElement(Sketchpad, { ...props, ctx }),
            ),
        ),
      ),
    "echo-sketch: tab body",
  );

  ctx.effect(
    () =>
      ctx.slots.inject("conversation.session.header.actions", () =>
        ctx.slots.register(
          {
            name: "conversation.session.header.actions",
            id: ID,
            order: 15,
            locale: NS,
            inject: () => ({ open: () => ctx.sidebarRight.openTab(KIND) }),
          },
          HeaderButton,
        ),
      ),
    "echo-sketch: header action",
  );
}

/** 会话头部打开画板的按钮。 */
export function HeaderButton({ open, t }) {
  const tr = typeof t === "function" ? t : translate;
  const label = tr("header.open");
  return React.createElement(
    "button",
    {
      type: "button",
      className:
        "echo-sketch-header-action echo-sketch-tool echo-sketch-tip-bottom",
      "aria-label": label,
      "data-tip": label,
      onClick: open,
    },
    React.createElement(Icon, { name: "brand", size: 17 }),
  );
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
      const tr = typeof this.props.t === "function" ? this.props.t : translate;
      return React.createElement(
        "div",
        { className: "echo-sketch-fatal" },
        tr("fatal.detail", {
          message: String(this.state.error?.message ?? this.state.error),
        }),
      );
    }
    return this.props.children;
  }
}
