/** 画板通用控件。 */

import React from "react";
import { Icon } from "./icons.jsx";
import { translate } from "./i18n.js";

/** 带悬浮提示的图标按钮。 */
export function IconButton({
  icon,
  label,
  tip,
  tipAlign = "center",
  active = false,
  busy = false,
  size = 16,
  className = "",
  ...buttonProps
}) {
  return (
    <button
      {...buttonProps}
      type="button"
      aria-label={label}
      data-tip={tip ?? label}
      data-tip-align={tipAlign}
      className={`echo-sketch-iconbtn echo-sketch-tool${active ? " is-active" : ""}${busy ? " is-busy" : ""} ${className}`.trim()}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

/** 每轮自动绘图开关。 */
export function AutoToggle({ enabled, onChange, disabled = false, t }) {
  const tr = typeof t === "function" ? t : translate;
  const label = tr(enabled ? "auto.on" : "auto.off");
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      data-tip={label}
      data-tip-align="end"
      disabled={disabled}
      className={`echo-sketch-autotoggle echo-sketch-tool${enabled ? " is-on" : ""}`}
      onClick={() => onChange(!enabled)}
    >
      <Icon name="wand" size={15} />
      <span className="echo-sketch-switch" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}

/**
 * 带图标的提示条。
 * @param {{ tone?: string, icon?: string, children?: any, onClose?: () => void, t?: (key: string) => string }} props
 */
export function Notice({
  tone = "info",
  icon = "alert",
  children,
  onClose,
  t,
}) {
  const tr = typeof t === "function" ? t : translate;
  return (
    <div
      className={`echo-sketch-notice is-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon name={icon} size={14} />
      <div className="echo-sketch-notice-text">{children}</div>
      {onClose === undefined ? null : (
        <button
          type="button"
          className="echo-sketch-notice-close echo-sketch-tool"
          aria-label={tr("closeNotice")}
          data-tip={tr("close")}
          data-tip-align="end"
          onClick={onClose}
        >
          <Icon name="close" size={13} />
        </button>
      )}
    </div>
  );
}
