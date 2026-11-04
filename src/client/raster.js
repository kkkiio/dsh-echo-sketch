/** 浏览器侧 PNG 导出。 */

import { translate } from "./i18n.js";
import { CANVAS_HEIGHT, CANVAS_WIDTH, drawStrokes } from "./strokes.js";

/** 用户画板 → PNG。 */
export function renderUserPng(strokes) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error(translate("error.canvasContext"));
  drawStrokes(context, strokes);
  return {
    png: base64Of(canvas.toDataURL("image/png")),
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  };
}

/** 用户画板 → PNG File。 */
export function renderUserPngFile(strokes, filename) {
  const rendered = renderUserPng(strokes);
  const bytes = Uint8Array.from(atob(rendered.png), (char) =>
    char.charCodeAt(0),
  );
  return new File([bytes], filename, { type: "image/png" });
}

/** Agent SVG → PNG；失败时抛出可读错误。 */
export async function renderAgentPng(svg, maxWidth = CANVAS_WIDTH) {
  if (typeof svg !== "string" || svg.trim().length === 0)
    throw new Error(translate("error.agentEmpty"));
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = await loadImage(url);
    const sourceWidth = image.naturalWidth || CANVAS_WIDTH;
    const sourceHeight = image.naturalHeight || CANVAS_HEIGHT;
    const width = Math.min(maxWidth, Math.max(1, sourceWidth));
    const height = Math.max(
      1,
      Math.round((sourceHeight * width) / sourceWidth),
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.min(height, 2400);
    const context = canvas.getContext("2d");
    if (context === null) throw new Error(translate("error.canvasContext"));
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      png: base64Of(canvas.toDataURL("image/png")),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** SVG 的安全 data URL。 */
export function svgDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 触发浏览器下载。 */
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 下载 SVG 文本。 */
export function downloadSvg(filename, svg) {
  downloadBlob(filename, new Blob([svg], { type: "image/svg+xml" }));
}

/** 下载 PNG base64。 */
export function downloadPng(filename, png) {
  const bytes = Uint8Array.from(atob(png), (char) => char.charCodeAt(0));
  downloadBlob(filename, new Blob([bytes], { type: "image/png" }));
}

function base64Of(dataUrl) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error(translate("error.pngEncode"));
  return dataUrl.slice(comma + 1);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(translate("error.svgRender")));
    image.src = url;
  });
}
