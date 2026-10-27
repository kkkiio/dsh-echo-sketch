/** Agent 图示画板。 */

import React, { useState, useSyncExternalStore } from 'react';
import { Icon } from './icons.jsx';
import { AutoToggle, IconButton, Notice } from './ui.jsx';
import { downloadPng, downloadSvg, renderAgentPng, svgDataUrl } from './raster.js';

/** Agent 画板组件。 */
export function AgentCanvas({ store, sessionId }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const { agent, settings, visual, imageSupport } = state;
  const drawing = visual.status === 'drawing';
  const hasSvg = agent.svg.length > 0;
  const error = agent.error || visual.error;
  const [actionError, setActionError] = useState('');

  const downloadAgentPng = async () => {
    try {
      setActionError('');
      const rendered = await renderAgentPng(agent.svg);
      downloadPng(`echo-sketch-agent-${sessionId}.png`, rendered.png);
    } catch (cause) {
      setActionError(String(cause?.message ?? cause));
    }
  };

  const clear = () => {
    if (hasSvg && !window.confirm('清空 Agent 图示？此操作不可撤销。')) return;
    void store.clearAgent();
  };

  const meta = agent.revision > 0
    ? `${agent.source === 'main' ? '主 Agent 更新' : '自动绘制'} · 第 ${agent.sourceTurn || '?'} 轮`
    : '等待第一张图';

  return (
    <section className="echo-sketch-panel echo-sketch-agent" aria-busy={drawing}>
      <div className="echo-sketch-panel-head">
        <div className="echo-sketch-heading-block">
          <div className="echo-sketch-panel-title" title={agent.title || 'Agent 图示'}>
            <span className="echo-sketch-panel-icon is-agent" aria-hidden="true"><Icon name="sparkles" size={15} /></span>
            <span className="echo-sketch-panel-name">{agent.title || 'Agent 图示'}</span>
          </div>
          <div className="echo-sketch-panel-meta">{meta}</div>
        </div>
        <div className="echo-sketch-actions">
          <AutoToggle
            enabled={settings.autoDraw}
            onChange={value => { void store.setAutoDraw(value); }}
          />
          <span className="echo-sketch-divider" aria-hidden="true" />
          <IconButton
            icon="refresh"
            label={drawing ? '正在绘制' : '重新绘制'}
            tip={drawing ? '正在绘制…' : '让 Agent 重新画一张'}
            busy={drawing}
            disabled={drawing}
            onClick={() => { void store.redraw(); }}
          />
          <IconButton
            icon="trash"
            label="清空 Agent 图示"
            tip={hasSvg ? '清空 Agent 图示' : '还没有可清空的图示'}
            disabled={!hasSvg || drawing}
            onClick={clear}
          />
          <IconButton
            icon="code"
            label="下载 SVG"
            tip={hasSvg ? '下载 SVG（矢量）' : '还没有可下载的图示'}
            disabled={!hasSvg}
            onClick={() => downloadSvg(`echo-sketch-agent-${sessionId}.svg`, agent.svg)}
          />
          <IconButton
            icon="image"
            label="下载 PNG"
            tip={hasSvg ? '下载 PNG（图片）' : '还没有可下载的图示'}
            disabled={!hasSvg}
            onClick={() => { void downloadAgentPng(); }}
          />
        </div>
      </div>

      {imageSupport === false ? (
        <Notice tone="warn" icon="alert">当前模型不支持图片输入，画板图片无法被 Agent 看见；图示仍会保存在本机。</Notice>
      ) : null}

      {drawing ? (
        <div className="echo-sketch-progress" role="status">
          <span className="echo-sketch-spinner is-small" aria-hidden="true" />
          <span>正在把这一轮回答画成图示…</span>
        </div>
      ) : null}

      {visual.status === 'skipped' ? (
        <Notice tone="info" icon="check">本轮没有新的图示更新，保留上一张。</Notice>
      ) : null}

      {error === '' ? null : <Notice tone="error" icon="alert">{error}</Notice>}
      {actionError === '' ? null : <Notice tone="error" icon="alert" onClose={() => setActionError('')}>{actionError}</Notice>}

      {hasSvg
        ? (
          <div className="echo-sketch-agent-view">
            <img
              className="echo-sketch-agent-image"
              src={svgDataUrl(agent.svg)}
              alt={agent.title || 'Agent 图示'}
              draggable={false}
            />
          </div>
        )
        : <EmptyAgent drawing={drawing} onDraw={() => { void store.redraw(); }} />}
    </section>
  );
}

function EmptyAgent({ drawing, onDraw }) {
  return (
    <div className="echo-sketch-empty" aria-live="polite">
      <div className={`echo-sketch-empty-art${drawing ? ' is-busy' : ''}`} aria-hidden="true">
        {drawing ? <span className="echo-sketch-spinner" /> : <Icon name="sparkles" size={26} />}
      </div>
      <strong>{drawing ? '正在画第一张图' : '第一张图还在路上'}</strong>
      <span>{drawing ? '正在从这一轮回答里提炼要点…' : '结束一轮对话后，Agent 会把要点画在这里。'}</span>
      {drawing ? null : (
        <button
          type="button"
          className="echo-sketch-textaction echo-sketch-tool"
          data-tip="基于最近对话立即画一张"
          onClick={onDraw}
        >
          <Icon name="refresh" size={14} />
          <span>现在画一张</span>
        </button>
      )}
    </div>
  );
}
