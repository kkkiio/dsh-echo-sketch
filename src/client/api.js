import { translate } from './i18n.js';

const BASE = '/api/plugins/dsh-echo-sketch';

/** 读取会话画板状态。 */
export async function fetchState(sessionId, signal) {
  return request(`${BASE}/state?sessionId=${encodeURIComponent(sessionId)}`, { signal });
}

/** 保存用户笔画或清空画板。 */
export async function postCanvas(body, signal) {
  return request(`${BASE}/canvas`, { method: 'POST', body, signal });
}

/** 更新画板设置。 */
export async function postSettings(body, signal) {
  return request(`${BASE}/settings`, { method: 'POST', body, signal });
}

/** 请求 sidecar 重绘。 */
export async function postRedraw(body, signal) {
  return request(`${BASE}/redraw`, { method: 'POST', body, signal });
}

/** 回传按需渲染结果。 */
export async function postRenderResult(body, signal) {
  return request(`${BASE}/render-result`, { method: 'POST', body, signal });
}

async function request(url, { method = 'GET', body, signal } = {}) {
  const response = await fetch(url, {
    method,
    signal,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body === undefined ? { accept: 'application/json' } : {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(statusMessage(response.status));
  }
  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.error ?? statusMessage(response.status));
  }
  return payload;
}

function statusMessage(status) {
  if (status === 404) return translate('error.serviceUnavailable');
  if (status === 401) return translate('error.unauthorized');
  if (status === 403) return translate('error.forbidden');
  if (status === 413) return translate('error.tooLarge');
  if (status >= 500) return translate('error.server');
  return translate('error.http', { status });
}
