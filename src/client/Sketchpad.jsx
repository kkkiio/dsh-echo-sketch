/** 双画板 tab 正文。 */

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { AgentCanvas } from './AgentCanvas.jsx';
import { UserCanvas } from './UserCanvas.jsx';
import { Icon } from './icons.jsx';
import { getSketchpadStore } from './session-store.js';
import { Notice } from './ui.jsx';

/** 双画板组件。 */
export function Sketchpad({ ctx, sessionId, useTabInfo }) {
  const store = getSketchpadStore(sessionId, ctx);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const info = typeof useTabInfo === 'function' ? useTabInfo() : undefined;
  const visible = info?.tab?.visible ?? true;
  const [note, setNote] = useState('');

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
    setNote('');
  };

  const status = visualStatus(state.visual);

  return (
    <div className="echo-sketch-root">
      <header className="echo-sketch-topbar">
        <div className="echo-sketch-brand">
          <span className="echo-sketch-logo" aria-hidden="true"><Icon name="brand" size={19} /></span>
          <div className="echo-sketch-brand-text">
            <div className="echo-sketch-brand-title">
              双画板
              {status.busy || status.error ? (
                <span
                  className={`echo-sketch-dot${status.busy ? ' is-busy' : ' is-error'}`}
                  role="status"
                  aria-label={`Agent 图示：${status.label}`}
                  data-tip={`Agent 图示：${status.label}`}
                  data-tip-align="start"
                />
              ) : null}
            </div>
            <div className="echo-sketch-brand-sub">画给 Agent 看，也看 Agent 画</div>
          </div>
        </div>
        <div className="echo-sketch-segment" role="tablist" aria-label="切换画板">
          {viewTab(store, state, 'user', '我的草图', 'pencil')}
          {viewTab(store, state, 'agent', 'Agent 图示', 'sparkles')}
        </div>
      </header>

      <main className="echo-sketch-main">
        {state.status === 'loading'
          ? <Loading />
          : state.viewMode === 'agent'
            ? <AgentCanvas store={store} sessionId={sessionId} />
            : <UserCanvas store={store} sessionId={sessionId} />}
      </main>

      <div className="echo-sketch-composer">
        <input
          className="echo-sketch-input"
          value={note}
          placeholder="补充一句，或直接发送画板…"
          maxLength={500}
          aria-label="补充说明"
          onChange={event => setNote(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="button"
          className="echo-sketch-send echo-sketch-tool"
          disabled={state.sending}
          aria-label="发送给 Agent"
          data-tip="把当前画板发给 Agent（Enter）"
          data-tip-align="end"
          onClick={() => { void send(); }}
        >
          {state.sending
            ? <span className="echo-sketch-spinner is-small" aria-hidden="true" />
            : <Icon name="send" size={15} />}
          <span>{state.sending ? '发送中…' : '发给 Agent'}</span>
        </button>
      </div>

      {state.error === '' ? null : (
        <Notice tone="error" icon="alert">{state.error}</Notice>
      )}
    </div>
  );
}

function viewTab(store, state, mode, label, icon) {
  const active = state.viewMode === mode;
  const hasUpdate = mode === 'agent'
    && !active
    && state.agent.svg.length > 0
    && state.agent.revision > state.agentSeenRevision;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`echo-sketch-tab${active ? ' is-active' : ''}`}
      onClick={() => store.setViewMode(mode)}
    >
      <Icon name={icon} size={15} />
      <span>{label}</span>
      {hasUpdate ? <span className="echo-sketch-new" aria-label="有新图示" /> : null}
    </button>
  );
}

function visualStatus(visual) {
  if (visual.status === 'drawing') return { label: '正在绘制', busy: true, error: false };
  if (visual.status === 'error') return { label: '绘制失败', busy: false, error: true };
  if (visual.status === 'skipped') return { label: '本轮未绘制', busy: false, error: false };
  return { label: '就绪', busy: false, error: false };
}

function Loading() {
  return (
    <div className="echo-sketch-loading" aria-live="polite">
      <span className="echo-sketch-spinner" aria-hidden="true" />
      <span>正在打开画板…</span>
    </div>
  );
}
