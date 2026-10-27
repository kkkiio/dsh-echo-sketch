/** 双画板 tab 正文。 */

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { AgentCanvas } from "./AgentCanvas.jsx";
import { UserCanvas } from "./UserCanvas.jsx";
import { Icon } from "./icons.jsx";
import { getSketchpadStore } from "./session-store.js";
import { translate } from "./i18n.js";
import { Notice } from "./ui.jsx";

/** 双画板组件。 */
export function Sketchpad({ ctx, sessionId, useTabInfo, t }) {
  const tr = typeof t === "function" ? t : translate;
  const store = getSketchpadStore(sessionId, ctx);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const info = typeof useTabInfo === "function" ? useTabInfo() : undefined;
  const visible = info?.tab?.visible ?? true;
  const [note, setNote] = useState("");

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

  const send = async () => {
    await store.sendToAgent(note);
    setNote("");
  };

  const status = visualStatus(state.visual);
  const statusLabel = tr(`status.${status.key}`);

  return (
    <div className="echo-sketch-root">
      <header className="echo-sketch-topbar">
        <div className="echo-sketch-brand">
          <span className="echo-sketch-logo" aria-hidden="true">
            <Icon name="brand" size={19} />
          </span>
          <div className="echo-sketch-brand-text">
            <div className="echo-sketch-brand-title">
              {tr("tab.title")}
              {status.busy || status.error ? (
                <span
                  className={`echo-sketch-dot${status.busy ? " is-busy" : " is-error"}`}
                  role="status"
                  aria-label={tr("status.label", { status: statusLabel })}
                  data-tip={tr("status.label", { status: statusLabel })}
                  data-tip-align="start"
                />
              ) : null}
            </div>
            <div className="echo-sketch-brand-sub">{tr("brand.subtitle")}</div>
          </div>
        </div>
        <div
          className="echo-sketch-segment"
          role="tablist"
          aria-label={tr("tab.list")}
        >
          {viewTab(store, state, "user", "tab.user", "pencil", tr)}
          {viewTab(store, state, "agent", "tab.agent", "sparkles", tr)}
        </div>
      </header>

      <main className="echo-sketch-main">
        {state.status === "loading" ? (
          <Loading t={tr} />
        ) : state.viewMode === "agent" ? (
          <AgentCanvas store={store} sessionId={sessionId} t={tr} />
        ) : (
          <UserCanvas store={store} sessionId={sessionId} t={tr} />
        )}
      </main>

      <div className="echo-sketch-composer">
        <input
          className="echo-sketch-input"
          value={note}
          placeholder={tr("prompt.placeholder")}
          maxLength={500}
          aria-label={tr("prompt.aria")}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="button"
          className="echo-sketch-send echo-sketch-tool"
          disabled={state.sending}
          aria-label={tr("send.aria")}
          data-tip={tr("send.tip")}
          data-tip-align="end"
          onClick={() => {
            void send();
          }}
        >
          {state.sending ? (
            <span className="echo-sketch-spinner is-small" aria-hidden="true" />
          ) : (
            <Icon name="send" size={15} />
          )}
          <span>{state.sending ? tr("send.sending") : tr("send")}</span>
        </button>
      </div>

      {state.error === "" ? null : (
        <Notice tone="error" icon="alert" t={tr}>
          {state.error}
        </Notice>
      )}
    </div>
  );
}

function viewTab(store, state, mode, labelKey, icon, t) {
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
      {hasUpdate ? (
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
