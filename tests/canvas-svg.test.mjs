import { test } from "vitest";
import assert from "node:assert/strict";
import { extractSvg, normalizeAgentSvg } from "../src/host/canvas-svg.js";

const VALID =
  '<svg viewBox="0 0 100 50"><title>流程</title><rect width="10" height="10"/></svg>';

test("normalizeAgentSvg extracts fenced SVG and adds missing attributes", () => {
  const result = normalizeAgentSvg(`说明\n\`\`\`svg\n${VALID}\n\`\`\``);
  assert.equal(result.ok, true);
  assert.equal(result.title, "流程");
  assert.match(result.svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(result.svg, /viewBox="0 0 100 50"/);
  assert.match(result.svg, /width="100"/);
  assert.match(result.svg, /height="50"/);
});

test("normalizeAgentSvg rejects unsafe constructs", () => {
  assert.equal(
    normalizeAgentSvg("<svg><script>alert(1)</script></svg>").ok,
    false,
  );
  assert.equal(normalizeAgentSvg("<svg><foreignObject/></svg>").ok, false);
  assert.equal(normalizeAgentSvg('<svg onload="x()"><rect/></svg>').ok, false);
  assert.equal(
    normalizeAgentSvg('<svg><image href="https://x/y.png"/></svg>').ok,
    false,
  );
  assert.equal(
    normalizeAgentSvg('<svg><rect fill="url(https://x)"/></svg>').ok,
    false,
  );
  assert.equal(
    normalizeAgentSvg('<svg><a href="javascript:alert(1)"/></svg>').ok,
    false,
  );
});

test("normalizeAgentSvg rejects missing or oversized SVG", () => {
  assert.equal(normalizeAgentSvg("not an svg").ok, false);
  const huge = `<svg><title>${"x".repeat(200_001)}</title></svg>`;
  assert.equal(normalizeAgentSvg(huge).ok, false);
});

test("extractSvg prefers fenced body", () => {
  assert.equal(
    extractSvg("x <svg></svg> ```svg\n<svg><rect/></svg>\n```"),
    "<svg><rect/></svg>",
  );
});
