/** 双画板样式。 */

export const CSS = `
.echo-sketch-root{
  --es-ink:var(--dsw-alias-label-primary,#1f2329);
  --es-muted:var(--dsw-alias-label-secondary,#5b6573);
  --es-faint:var(--dsw-alias-label-tertiary,#8a94a3);
  --es-border:var(--dsw-alias-border-l2,rgba(20,26,38,.10));
  --es-border-strong:var(--dsw-alias-border-l3,rgba(20,26,38,.17));
  --es-surface:var(--dsw-alias-bg-layer-1,#fff);
  --es-subtle:var(--dsw-alias-bg-layer-2,#f5f6f8);
  --es-hover:var(--dsw-alias-interactive-bg-hover,rgba(20,26,38,.06));
  --es-accent:var(--dsw-alias-state-business-primary,#2f6fed);
  --es-danger:var(--dsw-alias-state-error-primary,#dc2626);
  --es-warn:var(--dsw-alias-state-warn-primary,#d97706);
  --es-shadow:0 1px 2px rgba(16,24,40,.04),0 3px 10px rgba(16,24,40,.04);
  display:flex;flex-direction:column;height:100%;min-height:0;gap:10px;padding:12px;box-sizing:border-box;
  color:var(--es-ink);font:inherit;-webkit-tap-highlight-color:transparent;
}
.echo-sketch-topbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;flex:none}
.echo-sketch-dot{width:7px;height:7px;flex:none;border-radius:50%;background:var(--es-accent);cursor:help;transition:background .15s}
.echo-sketch-dot.is-busy{background:var(--es-warn);animation:echo-sketch-pulse 1s ease-in-out infinite}
.echo-sketch-dot.is-error{background:var(--es-danger)}
.echo-sketch-segment{display:inline-flex;gap:2px;padding:2px;border-radius:10px;background:var(--es-subtle);flex:none}
.echo-sketch-tab{
  appearance:none;border:0;background:transparent;color:var(--es-muted);font:inherit;font-size:12px;line-height:18px;
  padding:5px 9px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;
  transition:background .15s,color .15s,box-shadow .15s;
}
.echo-sketch-tab:hover{color:var(--es-ink)}
.echo-sketch-tab.is-active{background:var(--es-surface);color:var(--es-ink);box-shadow:0 1px 2px rgba(16,24,40,.09)}
.echo-sketch-new{width:6px;height:6px;flex:none;border-radius:50%;background:var(--es-accent);margin-left:-1px}
.echo-sketch-main{display:flex;flex:1;min-height:0;overflow:visible}
.echo-sketch-panel{display:flex;flex-direction:column;gap:9px;flex:1;min-height:0}
.echo-sketch-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;flex:none}
.echo-sketch-heading-block{min-width:0;flex:1 1 auto}
.echo-sketch-panel-title{display:flex;align-items:center;gap:7px;min-width:0;font-size:13px;font-weight:650;line-height:18px}
.echo-sketch-panel-icon{
  width:24px;height:24px;flex:none;display:inline-flex;align-items:center;justify-content:center;
  border-radius:7px;background:var(--es-subtle);color:var(--es-muted);
}
.echo-sketch-panel-icon.is-agent{color:var(--es-accent)}
.echo-sketch-panel-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.echo-sketch-panel-meta{font-size:11px;line-height:16px;color:var(--es-faint);margin-top:2px;padding-left:31px;overflow-wrap:anywhere}
.echo-sketch-actions{display:flex;align-items:center;gap:2px;flex:none;margin-left:auto}
.echo-sketch-divider{width:1px;height:16px;flex:none;background:var(--es-border);margin:0 3px}
.echo-sketch-iconbtn{
  width:28px;height:28px;padding:0;border:1px solid transparent;border-radius:8px;background:transparent;
  color:var(--es-muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;
  transition:background .15s,color .15s,border-color .15s,opacity .15s;
}
.echo-sketch-iconbtn:hover{background:var(--es-hover);color:var(--es-ink)}
.echo-sketch-iconbtn.is-active{background:var(--es-subtle);border-color:var(--es-border);color:var(--es-accent)}
.echo-sketch-iconbtn.is-busy svg{animation:echo-sketch-spin 1s linear infinite}
.echo-sketch-iconbtn:disabled{opacity:.32;cursor:not-allowed;background:transparent;color:var(--es-muted)}
.echo-sketch-autotoggle{
  height:28px;padding:0 6px;border:1px solid var(--es-border);border-radius:8px;background:transparent;
  color:var(--es-muted);display:inline-flex;align-items:center;gap:6px;cursor:pointer;
  transition:background .15s,color .15s,border-color .15s;
}
.echo-sketch-autotoggle:hover{background:var(--es-hover);color:var(--es-ink)}
.echo-sketch-autotoggle.is-on{color:var(--es-accent);border-color:var(--es-border);background:var(--es-subtle)}
.echo-sketch-autotoggle:disabled{opacity:.4;cursor:not-allowed}
.echo-sketch-switch{width:26px;height:14px;flex:none;position:relative;border-radius:999px;background:var(--es-border-strong);transition:background .18s}
.echo-sketch-switch span{position:absolute;top:2px;left:2px;width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.22);transition:transform .18s}
.echo-sketch-autotoggle.is-on .echo-sketch-switch{background:var(--es-accent)}
.echo-sketch-autotoggle.is-on .echo-sketch-switch span{transform:translateX(12px)}
.echo-sketch-drawbar{
  display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:none;padding:6px 7px;
  border:1px solid var(--es-border);border-radius:11px;background:var(--es-subtle);
}
.echo-sketch-colors,.echo-sketch-widths{display:inline-flex;align-items:center;gap:4px}
.echo-sketch-swatch{
  width:19px;height:19px;padding:0;border:1px solid rgba(0,0,0,.14);border-radius:50%;
  display:inline-flex;align-items:center;justify-content:center;color:#fff;
  cursor:pointer;appearance:none;transition:transform .12s,outline-color .12s;
}
.echo-sketch-swatch:hover{transform:translateY(-1px)}
.echo-sketch-swatch.is-active{outline:2px solid var(--es-border-strong);outline-offset:2px}
.echo-sketch-swatch svg{filter:drop-shadow(0 1px 1px rgba(0,0,0,.28))}
.echo-sketch-width{
  width:28px;height:24px;padding:0;border:1px solid transparent;border-radius:7px;background:transparent;
  color:var(--es-muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;
  transition:background .15s,color .15s,border-color .15s;
}
.echo-sketch-width:hover{background:var(--es-hover);color:var(--es-ink)}
.echo-sketch-width.is-active{background:var(--es-surface);border-color:var(--es-border);color:var(--es-ink)}
.echo-sketch-width i{display:block;border-radius:50%;background:currentColor}
.echo-sketch-canvas-wrap{
  position:relative;flex:none;overflow:hidden;border:1px solid var(--es-border);border-radius:14px;
  background:#fff;box-shadow:var(--es-shadow);
}
.echo-sketch-canvas{display:block;width:100%;height:auto;aspect-ratio:3 / 2;touch-action:none;cursor:crosshair;background:#fff}
.echo-sketch-canvas-hint{
  position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  text-align:center;pointer-events:none;color:var(--es-faint);padding:18px;box-sizing:border-box;
}
.echo-sketch-canvas-hint-icon{
  width:38px;height:38px;margin-bottom:3px;border:1px solid var(--es-border);border-radius:12px;
  display:inline-flex;align-items:center;justify-content:center;color:var(--es-muted);background:rgba(255,255,255,.82);
  box-shadow:0 1px 2px rgba(16,24,40,.04);
}
.echo-sketch-canvas-hint strong{font-size:12px;font-weight:600;line-height:18px;color:var(--es-muted)}
.echo-sketch-canvas-hint span:last-child{font-size:11px;line-height:16px}
.echo-sketch-canvas-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;padding:0 2px;font-size:10.5px;line-height:15px;color:var(--es-faint)}
.echo-sketch-shortcut{white-space:nowrap}
.echo-sketch-agent-view{
  flex:1;min-height:180px;overflow:auto;padding:12px;border:1px solid var(--es-border);border-radius:14px;
  background-color:#fff;background-image:radial-gradient(rgba(20,26,38,.06) 1px,transparent 1px);background-size:16px 16px;
}
.echo-sketch-agent-image{display:block;max-width:100%;height:auto;margin:0 auto;border-radius:8px;background:#fff}
.echo-sketch-empty{
  flex:1;min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;
  padding:22px 18px;box-sizing:border-box;text-align:center;border:1px dashed var(--es-border-strong);
  border-radius:14px;background:linear-gradient(180deg,var(--es-subtle),var(--es-surface));
}
.echo-sketch-empty-art{
  width:46px;height:46px;margin-bottom:3px;display:inline-flex;align-items:center;justify-content:center;
  border:1px solid var(--es-border);border-radius:14px;background:var(--es-surface);color:var(--es-accent);
  box-shadow:var(--es-shadow);
}
.echo-sketch-empty-art.is-busy{animation:echo-sketch-breathe 1.6s ease-in-out infinite}
.echo-sketch-empty strong{font-size:13px;font-weight:650;line-height:19px;color:var(--es-ink)}
.echo-sketch-empty > span{max-width:250px;font-size:11.5px;line-height:18px;color:var(--es-faint)}
.echo-sketch-textaction{
  margin-top:5px;display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border:1px solid var(--es-border);
  border-radius:8px;background:var(--es-surface);color:var(--es-ink);font:inherit;font-size:11.5px;line-height:16px;
  cursor:pointer;box-shadow:0 1px 1px rgba(16,24,40,.03);transition:background .15s,border-color .15s;
}
.echo-sketch-textaction:hover{background:var(--es-subtle);border-color:var(--es-border-strong)}
.echo-sketch-progress{display:flex;align-items:center;gap:7px;flex:none;padding:7px 9px;border-radius:9px;background:var(--es-subtle);color:var(--es-muted);font-size:11.5px;line-height:17px}
.echo-sketch-spinner{
  width:14px;height:14px;flex:none;display:inline-block;border-radius:50%;
  border:2px solid var(--es-border-strong);border-top-color:var(--es-accent);animation:echo-sketch-spin .8s linear infinite;
}
.echo-sketch-spinner.is-small{width:11px;height:11px;border-width:1.6px}
.echo-sketch-notice{
  display:flex;align-items:flex-start;gap:7px;flex:none;padding:7px 9px;border:1px solid transparent;border-radius:9px;
  background:var(--es-subtle);color:var(--es-muted);font-size:11.5px;line-height:17px;
}
.echo-sketch-notice > svg{flex:none;margin-top:1px}
.echo-sketch-notice.is-error{color:var(--es-danger);background:rgba(220,38,38,.07);border-color:rgba(220,38,38,.16)}
.echo-sketch-notice.is-warn{color:var(--es-warn);background:rgba(217,119,6,.08);border-color:rgba(217,119,6,.18)}
.echo-sketch-notice-text{flex:1;min-width:0;overflow-wrap:anywhere}
.echo-sketch-notice-close{
  width:20px;height:20px;flex:none;margin:-2px -4px 0 0;padding:0;border:0;border-radius:6px;background:transparent;
  color:currentColor;opacity:.55;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;
}
.echo-sketch-notice-close:hover{opacity:.9;background:rgba(0,0,0,.05)}
.echo-sketch-add{
  display:inline-flex;align-items:center;justify-content:center;gap:4px;height:28px;padding:0 9px;border:0;border-radius:8px;
  background:var(--dsw-alias-button-primary-fill,#1f2329);color:var(--dsw-alias-label-primary-foreground,#fff);
  font:inherit;font-size:11.5px;font-weight:600;line-height:16px;white-space:nowrap;cursor:pointer;
  transition:filter .15s,opacity .15s;
}
.echo-sketch-add:hover{filter:brightness(.96)}
.echo-sketch-add:disabled{opacity:.38;cursor:not-allowed}
.echo-sketch-loading{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;color:var(--es-faint);font-size:12px}
.echo-sketch-header-action{
  width:28px;height:28px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--es-muted);
  display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,color .15s;
}
.echo-sketch-header-action:hover{background:var(--es-hover);color:var(--es-ink)}
.echo-sketch-fatal{
  margin:12px;padding:9px 11px;border:1px solid rgba(220,38,38,.18);border-radius:9px;
  background:rgba(220,38,38,.06);color:var(--es-danger);font-size:12px;line-height:18px;overflow-wrap:anywhere;
}
.echo-sketch-tool{position:relative}
.echo-sketch-tool::after{
  content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 7px);z-index:80;
  transform:translate(-50%,4px);width:max-content;max-width:220px;padding:5px 8px;border-radius:7px;
  background:var(--dsw-alias-tooltip-bg,#1f2329);color:#fff;font-size:11px;font-weight:500;line-height:15px;
  text-align:center;white-space:normal;box-shadow:0 6px 18px rgba(0,0,0,.18);
  opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s ease,transform .12s ease,visibility .12s;
}
.echo-sketch-tool:hover::after,.echo-sketch-tool:focus-visible::after{opacity:1;visibility:visible;transform:translate(-50%,0)}
.echo-sketch-tool[data-tip-align="start"]::after{left:0;transform:translate(0,4px)}
.echo-sketch-tool[data-tip-align="start"]:hover::after,.echo-sketch-tool[data-tip-align="start"]:focus-visible::after{transform:translate(0,0)}
.echo-sketch-tool[data-tip-align="end"]::after{left:auto;right:0;transform:translate(0,4px)}
.echo-sketch-tool[data-tip-align="end"]:hover::after,.echo-sketch-tool[data-tip-align="end"]:focus-visible::after{transform:translate(0,0)}
.echo-sketch-tip-bottom::after{bottom:auto;top:calc(100% + 7px)}
.echo-sketch-tab:focus-visible,.echo-sketch-iconbtn:focus-visible,.echo-sketch-swatch:focus-visible,.echo-sketch-width:focus-visible,
.echo-sketch-autotoggle:focus-visible,.echo-sketch-add:focus-visible,.echo-sketch-header-action:focus-visible,
.echo-sketch-textaction:focus-visible,.echo-sketch-notice-close:focus-visible{
  outline:2px solid var(--dsw-focus-ring-color,var(--es-accent));outline-offset:2px;
}
@keyframes echo-sketch-spin{to{transform:rotate(360deg)}}
@keyframes echo-sketch-pulse{0%,100%{opacity:1}50%{opacity:.38}}
@keyframes echo-sketch-breathe{0%,100%{transform:translateY(0);opacity:1}50%{transform:translateY(-2px);opacity:.75}}
@media (max-width:420px){
  .echo-sketch-root{padding:10px;gap:9px}
  .echo-sketch-panel-meta{padding-left:0}
  .echo-sketch-actions{gap:1px}
}
@media (max-width:360px){
  .echo-sketch-topbar{gap:8px}
  .echo-sketch-segment{width:100%;padding:1px}
  .echo-sketch-tab{flex:1;justify-content:center;padding:5px 7px;gap:4px}
  .echo-sketch-divider{margin:0 1px}
}
@media (hover:none){.echo-sketch-tool::after{display:none}}
@media (prefers-reduced-motion:reduce){
  .echo-sketch-spinner,.echo-sketch-iconbtn.is-busy svg,.echo-sketch-dot.is-busy,.echo-sketch-empty-art.is-busy{animation:none}
}
`;
