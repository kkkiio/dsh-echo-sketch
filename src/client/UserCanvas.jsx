/** 用户手绘草图板。 */

import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Icon } from "./icons.jsx";
import { IconButton, Notice } from "./ui.jsx";
import { translate } from "./i18n.js";
import { downloadPng, renderUserPng } from "./raster.js";
import { drawStrokes, isEditableElement, pointFromEvent } from "./strokes.js";

const COLORS = [
  { value: "#1f2329", key: "color.ink" },
  { value: "#2f6fed", key: "color.blue" },
  { value: "#1f9d55", key: "color.green" },
  { value: "#d97706", key: "color.amber" },
  { value: "#dc2626", key: "color.red" },
  { value: "#7c3aed", key: "color.violet" },
];
const WIDTHS = [
  { value: 3, key: "width.thin", size: 4 },
  { value: 6, key: "width.medium", size: 7 },
  { value: 12, key: "width.thick", size: 10 },
];

/** 用户画板组件。 */
export function UserCanvas({ store, sessionId, t }) {
  const tr = typeof t === "function" ? t : translate;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const strokesRef = useRef(state.user.strokes);
  const activeRef = useRef(null);
  const frameRef = useRef(0);
  const [color, setColor] = useState(COLORS[0].value);
  const [width, setWidth] = useState(WIDTHS[0].value);
  const [eraser, setEraser] = useState(false);
  const [hasInk, setHasInk] = useState(state.user.strokes.length > 0);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (state.dirty) return;
    strokesRef.current = state.user.strokes;
    setHasInk(state.user.strokes.length > 0);
    redraw();
  }, [state.user.revision, state.dirty]);

  useEffect(
    () => () => {
      if (frameRef.current !== 0) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const redraw = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (context === null || context === undefined) return;
    const strokes = [...strokesRef.current];
    if (activeRef.current !== null) strokes.push(activeRef.current.stroke);
    drawStrokes(context, strokes);
  };

  const scheduleDraw = () => {
    if (frameRef.current !== 0) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      redraw();
    });
  };

  const commit = () => {
    const active = activeRef.current;
    activeRef.current = null;
    if (active === null) return;
    const stroke = active.stroke;
    if (stroke.erase === true && strokesRef.current.length === 0) {
      redraw();
      return;
    }
    if (stroke.points.length === 1)
      stroke.points.push([
        stroke.points[0][0] + 0.1,
        stroke.points[0][1] + 0.1,
      ]);
    strokesRef.current = [...strokesRef.current, stroke];
    setHasInk(true);
    redraw();
    void store.saveUser(strokesRef.current);
  };

  const onPointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (activeRef.current !== null) return;
    rootRef.current?.focus();
    event.preventDefault();
    const point = pointFromEvent(event, event.currentTarget);
    if (!eraser) setHasInk(true);
    activeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      captured: false,
      stroke: {
        color,
        width,
        erase: eraser,
        points: [point],
      },
    };
    scheduleDraw();
  };

  const onPointerMove = (event) => {
    const active = activeRef.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    if (
      !active.captured &&
      Math.hypot(event.clientX - active.startX, event.clientY - active.startY) >
        3
    ) {
      active.captured = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    const events = event.nativeEvent?.getCoalescedEvents?.() ?? [];
    const samples = events.length > 0 ? events : [event.nativeEvent];
    for (const sample of samples) {
      const point = pointFromEvent(sample, event.currentTarget);
      const previous = active.stroke.points.at(-1);
      if (
        previous === undefined ||
        previous[0] !== point[0] ||
        previous[1] !== point[1]
      ) {
        active.stroke.points.push(point);
      }
    }
    scheduleDraw();
  };

  const finish = (event) => {
    const active = activeRef.current;
    if (
      active === null ||
      (event !== undefined && active.pointerId !== event.pointerId)
    )
      return;
    const target = event?.currentTarget;
    if (target?.hasPointerCapture?.(active.pointerId) === true)
      target.releasePointerCapture(active.pointerId);
    commit();
  };

  const undo = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    setHasInk(strokesRef.current.length > 0);
    redraw();
    void store.saveUser(strokesRef.current);
  };

  const clear = () => {
    if (hasInk && !window.confirm(tr("user.confirm.clear"))) return;
    strokesRef.current = [];
    setHasInk(false);
    redraw();
    void store.saveUser([]);
  };

  const download = () => {
    try {
      setActionError("");
      const rendered = renderUserPng(strokesRef.current);
      downloadPng(`echo-sketch-user-${sessionId}.png`, rendered.png);
    } catch (error) {
      setActionError(String(error?.message ?? error));
    }
  };

  const onKeyDown = (event) => {
    if (isEditableElement(document.activeElement)) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    }
  };

  const count = state.user.strokes.length;
  const saveLabel = tr(
    state.saving
      ? "user.save.saving"
      : state.dirty
        ? "user.save.dirty"
        : "user.save.saved",
  );
  const strokeLabel =
    count === 1
      ? tr("user.meta.strokeOne")
      : tr("user.meta.strokeOther", { count });
  const meta =
    count === 0 ? tr("user.meta.empty") : `${strokeLabel} · ${saveLabel}`;

  return (
    <section
      className="echo-sketch-panel echo-sketch-user"
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={tr("user.title")}
    >
      <div className="echo-sketch-panel-head">
        <div className="echo-sketch-heading-block">
          <div className="echo-sketch-panel-title">
            <span className="echo-sketch-panel-icon" aria-hidden="true">
              <Icon name="pencil" size={15} />
            </span>
            <span className="echo-sketch-panel-name">{tr("user.title")}</span>
          </div>
          <div className="echo-sketch-panel-meta">{meta}</div>
        </div>
        <div className="echo-sketch-actions">
          <IconButton
            icon="undo"
            label={tr("user.undo")}
            tip={hasInk ? tr("user.undo.tip") : tr("user.undo.empty")}
            disabled={!hasInk}
            onClick={undo}
          />
          <IconButton
            icon="trash"
            label={tr("user.clear")}
            tip={hasInk ? tr("user.clear.tip") : tr("user.clear.empty")}
            disabled={!hasInk}
            onClick={clear}
          />
          <span className="echo-sketch-divider" aria-hidden="true" />
          <IconButton
            icon="download"
            label={tr("user.download")}
            tip={hasInk ? tr("user.download.tip") : tr("user.download.empty")}
            disabled={!hasInk}
            onClick={download}
          />
        </div>
      </div>

      <div className="echo-sketch-drawbar">
        <div
          className="echo-sketch-colors"
          role="group"
          aria-label={tr("user.colors")}
        >
          {COLORS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`echo-sketch-swatch echo-sketch-tool${!eraser && color === item.value ? " is-active" : ""}`}
              style={{ backgroundColor: item.value }}
              aria-label={tr("color.tip", { name: tr(item.key) })}
              data-tip={tr("color.tip", { name: tr(item.key) })}
              aria-pressed={!eraser && color === item.value}
              onClick={() => {
                setColor(item.value);
                setEraser(false);
              }}
            >
              {!eraser && color === item.value ? (
                <Icon name="check" size={11} />
              ) : null}
            </button>
          ))}
        </div>
        <span className="echo-sketch-divider" aria-hidden="true" />
        <div
          className="echo-sketch-widths"
          role="group"
          aria-label={tr("user.widths")}
        >
          {WIDTHS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`echo-sketch-width echo-sketch-tool${!eraser && width === item.value ? " is-active" : ""}`}
              aria-label={tr("width.aria", { width: tr(item.key) })}
              data-tip={tr("width.tip", { width: tr(item.key) })}
              aria-pressed={!eraser && width === item.value}
              onClick={() => {
                setWidth(item.value);
                setEraser(false);
              }}
            >
              <i
                style={{ width: item.size, height: item.size }}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
        <span className="echo-sketch-divider" aria-hidden="true" />
        <IconButton
          icon="eraser"
          label={tr("user.eraser")}
          tip={eraser ? tr("user.eraser.exit") : tr("user.eraser")}
          active={eraser}
          aria-pressed={eraser}
          onClick={() => setEraser((value) => !value)}
        />
      </div>

      <div className="echo-sketch-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="echo-sketch-canvas"
          width={1200}
          height={800}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          aria-label={tr("user.canvas")}
        />
        {hasInk ? null : (
          <div className="echo-sketch-canvas-hint" aria-hidden="true">
            <span className="echo-sketch-canvas-hint-icon">
              <Icon name="pencil" size={20} />
            </span>
            <strong>{tr("user.hint.title")}</strong>
            <span>{tr("user.hint.body")}</span>
          </div>
        )}
      </div>

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

      <div className="echo-sketch-canvas-foot">
        <span>{tr("user.footer.save")}</span>
        <span className="echo-sketch-shortcut">{tr("user.footer.undo")}</span>
      </div>
    </section>
  );
}
