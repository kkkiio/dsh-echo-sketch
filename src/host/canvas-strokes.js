/** 用户画板笔画校验与 SVG 生成（宿主侧，纯函数）。 */

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;
export const MAX_STROKES = 500;
export const MAX_POINTS = 20000;

const DEFAULT_COLOR = "#1f2329";
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const MAX_POINTS_PER_STROKE = 2000;
const MAX_WIDTH = 40;

/** @typedef {{ points: number[][], color?: string, width?: number, erase?: boolean }} Stroke */

/**
 * 规范化用户提交的笔画：裁剪坐标、限制数量、过滤非法值。
 * @param {unknown} input
 * @returns {{strokes: Stroke[], dropped: number}}
 */
export function normalizeStrokes(input) {
  const source = Array.isArray(input) ? input : [];
  const strokes = [];
  let dropped = 0;
  let totalPoints = 0;
  for (const raw of source) {
    if (strokes.length >= MAX_STROKES) {
      dropped += 1;
      continue;
    }
    const stroke = normalizeStroke(raw);
    if (stroke === undefined) {
      dropped += 1;
      continue;
    }
    const remaining = MAX_POINTS - totalPoints;
    if (remaining <= 0) {
      dropped += 1;
      continue;
    }
    if (stroke.points.length > remaining) {
      stroke.points = stroke.points.slice(0, remaining);
      dropped += 1;
    }
    totalPoints += stroke.points.length;
    strokes.push(stroke);
  }
  return { strokes, dropped };
}

function normalizeStroke(raw) {
  if (raw === null || typeof raw !== "object") return undefined;
  const points = normalizePoints(raw.points);
  if (points.length === 0) return undefined;
  const color =
    typeof raw.color === "string" && COLOR_PATTERN.test(raw.color)
      ? raw.color.toLowerCase()
      : DEFAULT_COLOR;
  const width = clampNumber(raw.width, 1, MAX_WIDTH, 3);
  return {
    color,
    width: round1(width),
    erase: raw.erase === true,
    points,
  };
}

function normalizePoints(input) {
  if (!Array.isArray(input)) return [];
  const points = [];
  for (const raw of input.slice(0, MAX_POINTS_PER_STROKE)) {
    if (!Array.isArray(raw) || raw.length < 2) continue;
    const x = round1(clampNumber(raw[0], 0, CANVAS_WIDTH, NaN));
    const y = round1(clampNumber(raw[1], 0, CANVAS_HEIGHT, NaN));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const previous = points.at(-1);
    if (previous !== undefined && previous[0] === x && previous[1] === y)
      continue;
    points.push([x, y]);
  }
  if (points.length === 1)
    points.push([points[0][0] + 0.1, points[0][1] + 0.1]);
  return points;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

/**
 * 把规范化后的笔画画成 1200×800 的独立 SVG。
 * @param {Stroke[]} strokes
 * @returns {string}
 */
export function strokesToSvg(strokes) {
  const paths = [];
  for (const stroke of Array.isArray(strokes) ? strokes : []) {
    if (!Array.isArray(stroke.points) || stroke.points.length === 0) continue;
    const d = stroke.points
      .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`)
      .join(" ");
    const color =
      stroke.erase === true ? "#ffffff" : String(stroke.color ?? DEFAULT_COLOR);
    const width = Number(stroke.width) || 3;
    paths.push(
      `<path d="${d}" fill="none" stroke="${escapeAttribute(color)}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}">`,
    `<rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="#ffffff"/>`,
    ...paths,
    "</svg>",
  ].join("");
}

/** 比较两组笔画是否完全一致。 */
export function sameStrokes(left, right) {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}
