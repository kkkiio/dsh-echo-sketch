/** 双画板 tab 正文。 */

import React, { useEffect, useSyncExternalStore } from "react";
import { AgentCanvas } from "./AgentCanvas.jsx";
import { UserCanvas } from "./UserCanvas.jsx";
import { Icon } from "./icons.jsx";
import { getSketchpadStore } from "./session-store.js";
import { translate } from "./i18n.js";
import { Notice } from "./ui.jsx";

/** 双画板组件。 */
export function Sketchpad({ ctx, sessionId, useTabInfo, inputActions, t }) {
  const tr = typeof t === "function" ? t : translate;
  const store = getSketchpadStore(sessionId, ctx);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const info = typeof useTabInfo === "function" ? useTabInfo() : undefined;
  const visible = info?.tab?.visible ?? true;

  useEffect(() => {
    let cancelled = false;
    let timer;
    const tick = async () => {
      await store.refresh();
      if (cancelled) return;
      timer = setTimeout(tick, visible ? 1000 : 2500);
    };
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [store, visible]);

  const status = visualStatus(state.visual);
  const statusLabel = tr(`status.${status.key}`);

  return (
    <div className="echo-sketch-root">
      <header className="echo-sketch-topbar">
        <div
          className="echo-sketch-segment"
          role="tablist"
          aria-label={tr("tab.list")}
        >
          {viewTab(store, state, "user", "tab.user", "pencil", tr)}
          {viewTab(
            store,
            state,
            "agent",
            "tab.agent",
            "sparkles",
            tr,
            status.busy || status.error
              ? `echo-sketch-dot${status.busy ? " is-busy" : " is-error"}`
              : "",
            tr("status.label", { status: statusLabel }),
          )}
        </div>
      </header>

      <main className="echo-sketch-main">
        {state.status === "loading" ? (
          <Loading t={tr} />
        ) : state.viewMode === "agent" ? (
          <AgentCanvas store={store} sessionId={sessionId} t={tr} />
        ) : (
          <UserCanvas
            store={store}
            sessionId={sessionId}
            inputActions={inputActions}
            t={tr}
          />
        )}
      </main>

      {state.error === "" ? null : (
        <Notice tone="error" icon="alert" t={tr}>
          {state.error}
        </Notice>
      )}
    </div>
  );
}

function viewTab(store, state, mode, labelKey, icon, t, dotClass, dotLabel) {
  const active = state.viewMode === mode;
  const hasUpdate =
    mode === "agent" &&
    !active &&
    state.agent.svg.length > 0 &&
    state.agent.revision > state.agentSeenRevision;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`echo-sketch-tab${active ? " is-active" : ""}`}
      onClick={() => store.setViewMode(mode)}
    >
      <Icon name={icon} size={15} />
      <span>{t(labelKey)}</span>
      {dotClass ? (
        <span
          className={dotClass}
          role="status"
          aria-label={dotLabel}
          data-tip={dotLabel}
          data-tip-align="start"
        />
      ) : hasUpdate ? (
        <span className="echo-sketch-new" aria-label={t("tab.new")} />
      ) : null}
    </button>
  );
}

function visualStatus(visual) {
  if (visual.status === "drawing")
    return { key: "drawing", busy: true, error: false };
  if (visual.status === "error")
    return { key: "error", busy: false, error: true };
  if (visual.status === "skipped")
    return { key: "skipped", busy: false, error: false };
  return { key: "ready", busy: false, error: false };
}

function Loading({ t }) {
  return (
    <div className="echo-sketch-loading" aria-live="polite">
      <span className="echo-sketch-spinner" aria-hidden="true" />
      <span>{t("loading")}</span>
    </div>
  );
}
