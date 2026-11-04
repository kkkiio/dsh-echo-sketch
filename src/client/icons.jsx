/** 画板图标。 */

import React from "react";

const ICONS = {
  brand: (
    <>
      <rect x="2.2" y="3" width="8.6" height="10" rx="2.2" />
      <path d="M6 13h5.8a2.2 2.2 0 0 0 2.2-2.2V5.4" />
      <path d="m5 10.4.8-2.4 3.1-3.1 1.6 1.6-3.1 3.1-2.4.8Z" />
    </>
  ),
  pencil: (
    <>
      <path d="M3 13l.7-2.8 7-7a1.4 1.4 0 0 1 2 0l.1.1a1.4 1.4 0 0 1 0 2l-7 7L3 13Z" />
      <path d="m9.7 4.2 2.1 2.1M3.7 10.2l2.1 2.1" />
    </>
  ),
  sparkles: (
    <>
      <path d="M6.3 2.4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
      <path d="M12 8.7l.45 1.25 1.25.45-1.25.45L12 12.1l-.45-1.25-1.25-.45 1.25-.45L12 8.7Z" />
      <path d="M12.2 2.5l.35.95.95.35-.95.35-.35.95-.35-.95-.95-.35.95-.35.35-.95Z" />
    </>
  ),
  wand: (
    <>
      <path d="M3 13l7.2-7.2" />
      <path d="m9.3 4.7 2 2" />
      <path d="M11.6 2.3l.4 1.1 1.1.4-1.1.4-.4 1.1-.4-1.1-1.1-.4 1.1-.4.4-1.1Z" />
      <path d="M13.1 8.1l.3.8.8.3-.8.3-.3.8-.3-.8-.8-.3.8-.3.3-.8Z" />
    </>
  ),
  eraser: (
    <>
      <path d="M6.1 13.1 3.2 10.2a1.3 1.3 0 0 1 0-1.8l5.2-5.2a1.3 1.3 0 0 1 1.8 0l2.6 2.6a1.3 1.3 0 0 1 0 1.8l-5.2 5.2a1.3 1.3 0 0 1-1.5.3Z" />
      <path d="m5.1 6.9 4 4M7.2 13.5h6.3" />
    </>
  ),
  undo: (
    <>
      <path d="M6 4 3 7l3 3" />
      <path d="M3.5 7H9a4 4 0 0 1 0 8H7.4" />
    </>
  ),
  trash: (
    <>
      <path d="M3 4.5h10M5.7 4.5v-1a1 1 0 0 1 1-1h2.6a1 1 0 0 1 1 1v1" />
      <path d="M4.6 4.5l.55 8a1.1 1.1 0 0 0 1.1 1h3.5a1.1 1.1 0 0 0 1.1-1l.55-8" />
      <path d="M6.6 7.4v3.5M9.4 7.4v3.5" />
    </>
  ),
  download: (
    <>
      <path d="M8 2.5v7.7M5.4 7.8 8 10.4l2.6-2.6" />
      <path d="M3 12.2v1a1.3 1.3 0 0 0 1.3 1.3h7.4a1.3 1.3 0 0 0 1.3-1.3v-1" />
    </>
  ),
  refresh: (
    <>
      <path d="M13.1 5.5A5.2 5.2 0 0 0 3.4 7.9" />
      <path d="M13.1 2.6v2.9H10.2" />
      <path d="M2.9 10.5A5.2 5.2 0 0 0 12.6 8.1" />
      <path d="M2.9 13.4v-2.9h2.9" />
    </>
  ),
  code: (
    <>
      <path d="M5.4 4.8 2.4 8l3 3.2M10.6 4.8 13.6 8l-3 3.2" />
      <path d="m9.1 3.2-2.2 9.6" />
    </>
  ),
  image: (
    <>
      <rect x="2.5" y="3" width="11" height="10" rx="2" />
      <circle cx="5.8" cy="6.2" r="1.1" />
      <path d="m3.4 11.4 2.9-2.9 2.1 2.1 1.6-1.6 2.6 2.6" />
    </>
  ),
  plus: <path d="M8 3.2v9.6M3.2 8h9.6" />,
  close: <path d="m4 4 8 8M12 4l-8 8" />,
  alert: (
    <>
      <path d="M8 2.4 14 13H2L8 2.4Z" />
      <path d="M8 6v3.2M8 11.4v.1" />
    </>
  ),
  check: <path d="m3.2 8.4 3.1 3.1 6.5-7" />,
  dot: <circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none" />,
};

/** 内联 SVG 图标。 */
export function Icon({ name, size = 16, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name] ?? ICONS.dot}
    </svg>
  );
}
