import { expect, test } from "vitest";
import assert from "node:assert/strict";
import { stringify } from "yaml";
import {
  endSeqOf,
  firstTurnStartSeq,
  isVisualizableTurn,
  lastAssistantText,
  renderDelta,
} from "../src/host/delta.js";

function sessionWith(events) {
  return { snapshotEvents: () => events };
}

const events = [
  { type: "turn/start", seq: 0, data: { turn: 1 } },
  {
    type: "user/message",
    seq: 1,
    data: {
      content: [
        { type: "text", text: "画个流程" },
        { type: "image", attachment: { attachmentId: "img-0" } },
      ],
      source: { kind: "user" },
    },
  },
  {
    type: "assistant/message",
    seq: 2,
    data: {
      message: {
        content: [
          { type: "text", text: "先用 A，再到 B。" },
          { type: "reasoning", text: "secret thought" },
          {
            type: "tool-call",
            id: "call-1",
            name: "sketchpad_draw",
            arguments: '{"title":"流程"}',
          },
          { type: "image", attachment: { attachmentId: "img-1" } },
        ],
      },
    },
  },
  {
    type: "tool/result",
    seq: 3,
    data: {
      message: {
        content: [{ type: "text", text: "ok" }],
        toolCallId: "call-1",
        source: { kind: "tool", callId: "call-1" },
      },
    },
  },
  {
    type: "turn/end",
    seq: 4,
    data: { turn: 1, reason: { kind: "completed" } },
  },
];

test("renderDelta includes text/tool I/O and excludes reasoning", async () => {
  const delta = renderDelta(sessionWith(events), 0);
  await expect(stringify(delta, { lineWidth: 0 })).toMatchFileSnapshot(
    "snapshots/renderDelta.yaml",
  );
});

test("renderDelta can include reasoning when explicitly requested", async () => {
  const delta = renderDelta(sessionWith(events), 0, {
    includeReasoning: true,
  });
  await expect(stringify(delta, { lineWidth: 0 })).toMatchFileSnapshot(
    "snapshots/renderDelta-reasoning.yaml",
  );
});

test("renderDelta starts at the requested cursor and marks compaction", async () => {
  const compacted = [...events, { type: "compaction/end", seq: 5, data: {} }];
  const delta = renderDelta(sessionWith(compacted), 2);
  await expect(stringify(delta, { lineWidth: 0 })).toMatchFileSnapshot(
    "snapshots/renderDelta-compaction.yaml",
  );
});

test("firstTurnStartSeq/lastAssistantText/endSeqOf", () => {
  const session = sessionWith(events);
  assert.equal(firstTurnStartSeq(session), 0);
  assert.equal(lastAssistantText(session), "先用 A，再到 B。");
  assert.equal(endSeqOf(session), 5);
});

test("isVisualizableTurn excludes settlement-only and empty turns", () => {
  const settlement = sessionWith([
    { type: "turn/start", seq: 0, data: { turn: 2 } },
    {
      type: "user/message",
      seq: 1,
      data: { content: [], source: { kind: "subagent-settled" } },
    },
    {
      type: "user/message",
      seq: 2,
      data: { content: [], source: { kind: "runtime-context" } },
    },
    {
      type: "assistant/message",
      seq: 3,
      data: { message: { content: [{ type: "text", text: "ok" }] } },
    },
    {
      type: "turn/end",
      seq: 4,
      data: { turn: 2, reason: { kind: "completed" } },
    },
  ]);
  assert.equal(isVisualizableTurn(settlement, 2), false);

  const empty = sessionWith([
    { type: "turn/start", seq: 0, data: { turn: 2 } },
    {
      type: "turn/end",
      seq: 1,
      data: { turn: 2, reason: { kind: "completed" } },
    },
  ]);
  assert.equal(isVisualizableTurn(empty, 2), false);

  const mixed = sessionWith([
    { type: "turn/start", seq: 0, data: { turn: 2 } },
    {
      type: "user/message",
      seq: 1,
      data: { content: [], source: { kind: "subagent-settled" } },
    },
    {
      type: "user/message",
      seq: 2,
      data: { content: [], source: { kind: "user" } },
    },
    {
      type: "turn/end",
      seq: 3,
      data: { turn: 2, reason: { kind: "completed" } },
    },
  ]);
  assert.equal(isVisualizableTurn(mixed, 2), true);

  const real = sessionWith([
    { type: "turn/start", seq: 0, data: { turn: 2 } },
    {
      type: "user/message",
      seq: 1,
      data: { content: [], source: { kind: "user" } },
    },
    {
      type: "assistant/message",
      seq: 2,
      data: { message: { content: [{ type: "text", text: "ok" }] } },
    },
    {
      type: "turn/end",
      seq: 3,
      data: { turn: 2, reason: { kind: "completed" } },
    },
  ]);
  assert.equal(isVisualizableTurn(real, 2), true);
});
