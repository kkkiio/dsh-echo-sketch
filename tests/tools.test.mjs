import test from "node:test";
import assert from "node:assert/strict";
import { registerSketchpadTools } from "../src/host/tools.js";

const SVG =
  '<svg viewBox="0 0 100 50"><title>流程</title><rect width="10" height="10"/></svg>';

function setup() {
  const tools = new Map();
  const calls = [];
  const ctx = {
    tools: {
      register: (definition) => {
        tools.set(definition.name, definition);
        return () => undefined;
      },
    },
    agents: {
      get: (id) => (id === "main" ? { id, session: {} } : undefined),
      turnBoundaryOf: () => ({ lastTurn: 3 }),
    },
  };
  const store = {
    setAgentCanvas: async (id, value) => {
      calls.push(["setAgentCanvas", id, value]);
      return { agent: { revision: 2 } };
    },
    setVisual: async (id, status) => {
      calls.push(["setVisual", id, status]);
    },
  };
  const bridge = {
    request: async (id, target) => {
      calls.push(["request", id, target]);
      return {
        note: "ok",
        images: [
          {
            revision: 1,
            ref: {
              attachmentId: "a1",
              mediaType: "image/png",
              bytes: 3,
              width: 10,
              height: 10,
              name: "x.png",
            },
          },
        ],
      };
    },
  };
  const sidecar = {
    isSidecar: (id) => String(id).startsWith("sidecar-"),
    mainSessionOf: (id) =>
      String(id).startsWith("sidecar-") ? "main" : undefined,
  };
  registerSketchpadTools(ctx, { store, bridge, sidecar });
  return { tools, calls };
}

test("sketchpad_draw validates and stores SVG with the correct source", async () => {
  const { tools, calls } = setup();
  const draw = tools.get("sketchpad_draw");
  const result = await draw.execute(
    { title: "流程", svg: SVG },
    { agent: { id: "main" }, signal: new AbortController().signal },
  );
  assert.deepEqual(result, { title: "流程", revision: 2 });
  assert.equal(calls[0][0], "setAgentCanvas");
  assert.equal(calls[0][1], "main");
  assert.equal(calls[0][2].source, "main");
  assert.equal(calls[0][2].sourceTurn, 3);
  await assert.rejects(
    draw.execute(
      { title: "x", svg: "<svg><script/></svg>" },
      { agent: { id: "main" }, signal: new AbortController().signal },
    ),
    /禁止/,
  );
});

test("sidecar draw maps child to main session", async () => {
  const { tools, calls } = setup();
  const draw = tools.get("sketchpad_draw");
  await draw.execute(
    { title: "x", svg: SVG },
    { agent: { id: "sidecar-1" }, signal: new AbortController().signal },
  );
  assert.equal(calls[0][1], "main");
  assert.equal(calls[0][2].source, "auto");
});

test("sketchpad_read returns image blocks", async () => {
  const { tools, calls } = setup();
  const read = tools.get("sketchpad_read");
  const value = await read.execute(
    { target: "user" },
    { agent: { id: "main" }, signal: new AbortController().signal },
  );
  assert.equal(value.images.length, 1);
  assert.equal(value.images[0].attachmentId, "a1");
  assert.deepEqual(calls[0], ["request", "main", "user"]);
  const blocks = read.output.render({ target: "user" }, value);
  assert.equal(blocks[0].type, "text");
  assert.equal(blocks[1].type, "image");
});
