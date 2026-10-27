/** 画布绘制与指针坐标工具。 */

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;

/** 在 1200×800 画布上重绘全部笔画。 */
export function drawStrokes(context, strokes) {
  context.save();
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const stroke of Array.isArray(strokes) ? strokes : []) {
    drawStroke(context, stroke);
  }
  context.restore();
}

function drawStroke(context, stroke) {
  const points = Array.isArray(stroke?.points) ? stroke.points : [];
  if (points.length === 0) return;
  const color = stroke.erase === true ? '#ffffff' : String(stroke.color ?? '#1f2329');
  const width = Number(stroke.width) || 3;
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = width;
  if (points.length === 1) {
    context.beginPath();
    context.arc(points[0][0], points[0][1], width / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index][0], points[index][1]);
  }
  context.stroke();
}

/** 把指针位置映射到 1200×800 逻辑坐标。 */
export function pointFromEvent(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return [0, 0];
  return [
    clamp((event.clientX - rect.left) * CANVAS_WIDTH / rect.width, 0, CANVAS_WIDTH),
    clamp((event.clientY - rect.top) * CANVAS_HEIGHT / rect.height, 0, CANVAS_HEIGHT),
  ];
}

/** 是否聚焦在可编辑控件中。 */
export function isEditableElement(element) {
  if (element === null || element === undefined) return false;
  const tag = String(element.tagName ?? '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (element.isContentEditable === true) return true;
  return typeof element.closest === 'function' && element.closest('[contenteditable="true"]') !== null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
