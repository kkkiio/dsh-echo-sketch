/** perfect-freehand 共享的笔画 → SVG path 转换（host/client 走同一渲染路径）。 */

import { getStroke } from "perfect-freehand";

/**
 * 把一组笔画点转换为 SVG path 的 d 字符串（填充轮廓，非描边）。
 * @param {number[][]} points 笔画点 [[x, y] | [x, y, pressure], ...]
 * @param {number} size 笔画最大粗细（px）
 * @returns {string} SVG path d；空点列返回空串
 */
export function strokePathD(points, size) {
  const hasRealPressure = points.some(
    (point) => Array.isArray(point) && Number.isFinite(point[2]),
  );
  const outline = getStroke(points, {
    size,
    simulatePressure: !hasRealPressure,
  });
  if (outline.length === 0) return "";
  const d = outline.reduce(
    (acc, [x0, y0], index, arr) => {
      const [x1, y1] = arr[(index + 1) % arr.length];
      acc.push(
        x0.toFixed(2),
        y0.toFixed(2),
        ((x0 + x1) / 2).toFixed(2),
        ((y0 + y1) / 2).toFixed(2),
      );
      return acc;
    },
    ["M", outline[0][0].toFixed(2), outline[0][1].toFixed(2), "Q"],
  );
  d.push("Z");
  return d.join(" ");
}
