/** Agent 图示画板。 */

import React, { useState, useSyncExternalStore } from "react";
import { Icon } from "./icons.jsx";
import { AutoToggle, IconButton, Notice } from "./ui.jsx";
import { translate } from "./i18n.js";
import {
  downloadPng,
  downloadSvg,
  renderAgentPng,
  svgDataUrl,
} from "./raster.js";

/** Agent 画板组件。 */
export function AgentCanvas({ store, sessionId, t }) {
  const tr = typeof t === "function" ? t : translate;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const { agent, settings, visual, imageSupport } = state;
  const drawing = visual.status === "drawing";
  const hasSvg = agent.svg.length > 0;
  const error = agent.error || visual.error;
  const [actionError, setActionError] = useState("");

  const downloadAgentPng = async () => {
    try {
      setActionError("");
      const rendered = await renderAgentPng(agent.svg);
      downloadPng(`echo-sketch-agent-${sessionId}.png`, rendered.png);
    } catch (cause) {
      setActionError(String(cause?.message ?? cause));
    }
  };

  const clear = () => {
    if (hasSvg && !window.confirm(tr("agent.confirm.clear"))) return;
    void store.clearAgent();
  };

  const meta =
    agent.revision > 0
      ? tr(agent.source === "main" ? "agent.meta.main" : "agent.meta.auto", {
          turn: agent.sourceTurn || "?",
        })
      : tr("agent.meta.waiting");

  return (
    <section
      className="echo-sketch-panel echo-sketch-agent"
      aria-busy={drawing}
    >
      <div className="echo-sketch-panel-head">
        <div className="echo-sketch-heading-block">
          <div
            className="echo-sketch-panel-title"
            title={agent.title || tr("agent.title")}
          >
            <span
              className="echo-sketch-panel-icon is-agent"
              aria-hidden="true"
            >
              <Icon name="sparkles" size={15} />
            </span>
            <span className="echo-sketch-panel-name">
              {agent.title || tr("agent.title")}
            </span>
          </div>
          <div className="echo-sketch-panel-meta">{meta}</div>
        </div>
        <div className="echo-sketch-actions">
          <AutoToggle
            enabled={settings.autoDraw}
            t={tr}
            onChange={(value) => {
              void store.setAutoDraw(value);
            }}
          />
          <span className="echo-sketch-divider" aria-hidden="true" />
          <IconButton
            icon="refresh"
            label={drawing ? tr("agent.redraw.busy") : tr("agent.redraw")}
            tip={drawing ? tr("agent.redraw.busy") : tr("agent.redraw.tip")}
            busy={drawing}
            disabled={drawing}
            onClick={() => {
              void store.redraw();
            }}
          />
          <IconButton
            icon="trash"
            label={tr("agent.clear")}
            tip={hasSvg ? tr("agent.clear.tip") : tr("agent.clear.empty")}
            disabled={!hasSvg || drawing}
            onClick={clear}
          />
          <IconButton
            icon="code"
            label={tr("agent.download.svg")}
            tip={
              hasSvg ? tr("agent.download.svg.tip") : tr("agent.download.empty")
            }
            disabled={!hasSvg}
            onClick={() =>
              downloadSvg(`echo-sketch-agent-${sessionId}.svg`, agent.svg)
            }
          />
          <IconButton
            icon="image"
            label={tr("agent.download.png")}
            tip={
              hasSvg ? tr("agent.download.png.tip") : tr("agent.download.empty")
            }
            disabled={!hasSvg}
            onClick={() => {
              void downloadAgentPng();
            }}
          />
        </div>
      </div>

      {imageSupport === false ? (
        <Notice tone="warn" icon="alert" t={tr}>
          {tr("agent.imageSupport")}
        </Notice>
      ) : null}

      {drawing ? (
        <div className="echo-sketch-progress" role="status">
          <span className="echo-sketch-spinner is-small" aria-hidden="true" />
          <span>{tr("agent.progress")}</span>
        </div>
      ) : null}

      {visual.status === "skipped" ? (
        <Notice tone="info" icon="check" t={tr}>
          {tr("agent.skipped")}
        </Notice>
      ) : null}

      {error === "" ? null : (
        <Notice tone="error" icon="alert" t={tr}>
          {error}
        </Notice>
      )}
      {actionError === "" ? null : (
        <Notice
          tone="error"
          icon="alert"
          t={tr}
          onClose={() => setActionError("")}
        >
          {actionError}
        </Notice>
      )}

      {hasSvg ? (
        <div className="echo-sketch-agent-view">
          <img
            className="echo-sketch-agent-image"
            src={svgDataUrl(agent.svg)}
            alt={agent.title || tr("agent.title")}
            draggable={false}
          />
        </div>
      ) : (
        <EmptyAgent
          drawing={drawing}
          onDraw={() => {
            void store.redraw();
          }}
          t={tr}
        />
      )}
    </section>
  );
}

function EmptyAgent({ drawing, onDraw, t }) {
  return (
    <div className="echo-sketch-empty" aria-live="polite">
      <div
        className={`echo-sketch-empty-art${drawing ? " is-busy" : ""}`}
        aria-hidden="true"
      >
        {drawing ? (
          <span className="echo-sketch-spinner" />
        ) : (
          <Icon name="sparkles" size={26} />
        )}
      </div>
      <strong>
        {t(drawing ? "agent.empty.drawingTitle" : "agent.empty.title")}
      </strong>
      <span>{t(drawing ? "agent.empty.drawingBody" : "agent.empty.body")}</span>
      {drawing ? null : (
        <button
          type="button"
          className="echo-sketch-textaction echo-sketch-tool"
          data-tip={t("agent.empty.tip")}
          onClick={onDraw}
        >
          <Icon name="refresh" size={14} />
          <span>{t("agent.empty.draw")}</span>
        </button>
      )}
    </div>
  );
}
