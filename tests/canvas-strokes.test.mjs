import { expect, test } from "vitest";
import assert from "node:assert/strict";
import {
  CANVAS_HEIGHT,
  normalizeStrokes,
  sameStrokes,
  strokesToSvg,
} from "../src/host/canvas-strokes.js";

test("normalizeStrokes clamps values and drops invalid strokes", () => {
  const { strokes, dropped } = normalizeStrokes([
    {
      color: "#ABCDEF",
      width: 999,
      points: [
        [-10, 2000],
        [10, 10],
      ],
    },
    { color: "red", width: 0, points: [[1, 2]] },
    { points: [] },
  ]);
  assert.equal(dropped, 1);
  assert.equal(strokes.length, 2);
  assert.equal(strokes[0].color, "#abcdef");
  assert.equal(strokes[0].width, 40);
  assert.deepEqual(strokes[0].points, [
    [0, CANVAS_HEIGHT],
    [10, 10],
  ]);
  assert.equal(strokes[1].color, "#1f2329");
  assert.equal(strokes[1].points.length, 2);
});

test("strokesToSvg renders a white background and erase strokes as white", async () => {
  const svg = strokesToSvg([
    {
      color: "#123456",
      width: 4,
      points: [
        [1, 2],
        [3, 4],
      ],
    },
    {
      erase: true,
      width: 8,
      points: [
        [5, 6],
        [7, 8],
      ],
    },
  ]);
  await expect(svg).toMatchFileSnapshot("snapshots/strokesToSvg.svg");
});

test("sameStrokes compares serialized content", () => {
  assert.equal(sameStrokes([], []), true);
  assert.equal(
    sameStrokes([{ points: [[1, 2]] }], [{ points: [[1, 2]] }]),
    true,
  );
  assert.equal(
    sameStrokes([{ points: [[1, 2]] }], [{ points: [[1, 3]] }]),
    false,
  );
});
