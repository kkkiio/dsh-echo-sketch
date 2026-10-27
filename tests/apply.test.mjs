import test from "node:test";
import assert from "node:assert/strict";
import * as host from "../src/host/index.js";

test("host apply registers tools, routes and lifecycle listeners", async () => {
  const tools = new Map();
  const routes = [];
  const listeners = new Map();
  const cleanups = [];
  const ctx = {
    logger: { warn: () => undefined },
    effect: (fn) => {
      const cleanup = fn();
      if (typeof cleanup === "function") cleanups.push(cleanup);
      return cleanup ?? (() => undefined);
    },
    on: (event, listener) => {
      listeners.set(event, listener);
      return () => undefined;
    },
    get: () => undefined,
    agents: { get: () => undefined },
    llm: { resolveModelInfo: async () => ({ inputModalities: ["text"] }) },
    tools: {
      register: (definition) => {
        tools.set(definition.name, definition);
        return () => undefined;
      },
    },
    connection: {
      fetch: {
        register: (route) => {
          routes.push(route);
          return () => undefined;
        },
      },
    },
    subagents: {
      startActivation: async () => {
        throw new Error("not used");
      },
      sendMessage: async () => {
        throw new Error("not used");
      },
    },
    attachments: undefined,
  };
  host.apply(ctx);
  assert.deepEqual([...tools.keys()].sort(), [
    "sketchpad_draw",
    "sketchpad_read",
  ]);
  assert.equal(routes.length, 5);
  assert.equal(listeners.has("agent/created"), true);
  assert.equal(listeners.has("session/event"), true);
  assert.equal(listeners.has("session/disposed"), true);
  assert.equal(listeners.has("agent/pre-step"), true);
  assert.equal(cleanups.length > 0, true);

  const claimed = [
    {
      source: {
        kind: "subagent-settled",
        senderSessionId: "echo-sketch-sidecar-test",
      },
    },
    { source: { kind: "runtime-context" } },
  ];
  let delegated = false;
  const decision = await listeners.get("agent/pre-step")(
    { agent: { id: "main-1" }, messages: claimed, step: 1, turn: 1 },
    async () => {
      delegated = true;
      return { kind: "enter", messages: claimed };
    },
  );
  assert.equal(delegated, true);
  assert.deepEqual(decision, { kind: "enter", messages: [] });

  const other = {
    source: { kind: "subagent-settled", senderSessionId: "other-subagent" },
  };
  const untouched = await listeners.get("agent/pre-step")(
    { agent: { id: "main-1" }, messages: [other], step: 1, turn: 3 },
    async () => ({ kind: "enter", messages: [other] }),
  );
  assert.deepEqual(untouched, { kind: "enter", messages: [other] });

  const user = { source: { kind: "user" } };
  const mixed = await listeners.get("agent/pre-step")(
    { agent: { id: "main-1" }, messages: [claimed[0], user], step: 1, turn: 2 },
    async () => ({ kind: "enter", messages: [claimed[0], user] }),
  );
  assert.deepEqual(mixed, { kind: "enter", messages: [claimed[0], user] });
});

test("host entry keeps namespace exports for the Loader", () => {
  assert.equal("default" in host, false);
  assert.equal(typeof host.apply, "function");
  assert.equal(host.name, "echo-sketch");
  assert.ok(host.inject.includes("tools"));
});
