/** Agent SVG 的安全提取、补齐与限制（宿主侧，纯函数）。 */

export const MAX_AGENT_SVG_BYTES = 200_000;

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const DANGEROUS_TAG = /<\s*(script|foreignObject|iframe|object|embed|style|link|meta|image)\b/i;
const EVENT_ATTRIBUTE = /\son[a-z]+\s*=/i;
const EXTERNAL_HREF = /\b(?:href|xlink:href)\s*=\s*["'](?!#)/i;
const EXTERNAL_URL = /url\s*\(\s*["']?(?!#)/i;
const SCRIPT_URL = /javascript\s*:/i;
const DOCTYPE = /<!DOCTYPE[\s\S]*?>/gi;
const XML_DECLARATION = /<\?xml[\s\S]*?\?>/gi;

/**
 * 从模型文本中提取 SVG，并做安全与尺寸规范化。
 * @param {unknown} input
 * @returns {{ok: true, svg: string, title: string} | {ok: false, error: string}}
 */
export function normalizeAgentSvg(input) {
  if (typeof input !== 'string') return { ok: false, error: 'SVG 必须是字符串' };
  const extracted = extractSvg(input);
  if (extracted === undefined) return { ok: false, error: '没有找到完整的 <svg> 文档' };
  let svg = extracted
    .replace(XML_DECLARATION, '')
    .replace(DOCTYPE, '')
    .trim();
  const bytes = Buffer.byteLength(svg, 'utf8');
  if (bytes > MAX_AGENT_SVG_BYTES) {
    return { ok: false, error: `SVG 过大（${bytes} 字节，上限 ${MAX_AGENT_SVG_BYTES}）` };
  }
  const unsafe = unsafeReason(svg);
  if (unsafe !== undefined) return { ok: false, error: unsafe };
  const open = /<svg\b[^>]*>/i.exec(svg);
  if (open === null) return { ok: false, error: '没有找到 <svg> 根元素' };
  const normalizedOpen = normalizeOpenTag(open[0]);
  svg = `${normalizedOpen}${svg.slice(open.index + open[0].length)}`;
  return { ok: true, svg, title: extractTitle(svg) };
}

/**
 * 提取字符串里的 SVG：优先 Markdown 围栏，否则取第一个完整 <svg>。
 * @param {string} input
 * @returns {string | undefined}
 */
export function extractSvg(input) {
  const text = String(input);
  const fenced = /```(?:svg|xml)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced === null ? text : fenced[1];
  const match = /<svg\b[\s\S]*?<\/svg>/i.exec(candidate);
  return match === null ? undefined : match[0].trim();
}

function unsafeReason(svg) {
  if (DANGEROUS_TAG.test(svg)) return 'SVG 包含被禁止的标签（script/foreignObject/image/style 等）';
  if (EVENT_ATTRIBUTE.test(svg)) return 'SVG 包含事件处理属性';
  if (SCRIPT_URL.test(svg)) return 'SVG 包含 javascript: URL';
  if (EXTERNAL_HREF.test(svg)) return 'SVG 包含外部 href；只允许 #fragment 引用';
  if (EXTERNAL_URL.test(svg)) return 'SVG 包含外部 url() 引用';
  return undefined;
}

function normalizeOpenTag(openTag) {
  let tag = openTag;
  if (!/\sxmlns\s*=/i.test(tag)) tag = tag.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  const viewBox = attribute(tag, 'viewBox');
  const width = attribute(tag, 'width');
  const height = attribute(tag, 'height');
  if (viewBox !== undefined) {
    if (width === undefined || height === undefined) {
      const numbers = viewBox.trim().split(/[\s,]+/).map(Number);
      const viewWidth = Number.isFinite(numbers[2]) && numbers[2] > 0 ? numbers[2] : DEFAULT_WIDTH;
      const viewHeight = Number.isFinite(numbers[3]) && numbers[3] > 0 ? numbers[3] : DEFAULT_HEIGHT;
      if (width === undefined) tag = appendAttribute(tag, 'width', String(viewWidth));
      if (height === undefined) tag = appendAttribute(tag, 'height', String(viewHeight));
    }
    return tag;
  }
  const numericWidth = numericAttribute(width) ?? DEFAULT_WIDTH;
  const numericHeight = numericAttribute(height) ?? DEFAULT_HEIGHT;
  tag = appendAttribute(tag, 'viewBox', `0 0 ${numericWidth} ${numericHeight}`);
  if (width === undefined) tag = appendAttribute(tag, 'width', String(numericWidth));
  if (height === undefined) tag = appendAttribute(tag, 'height', String(numericHeight));
  return tag;
}

function attribute(tag, name) {
  const match = new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag);
  return match === null ? undefined : match[2];
}

function numericAttribute(value) {
  if (value === undefined || value.includes('%')) return undefined;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : undefined;
}

function appendAttribute(tag, name, value) {
  return tag.replace(/\s*\/?>$/, match => ` ${name}="${value}"${match}`);
}

function extractTitle(svg) {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(svg);
  if (match === null) return '';
  return decodeEntities(match[1]).replace(/\s+/g, ' ').trim().slice(0, 80);
}

function decodeEntities(value) {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}
