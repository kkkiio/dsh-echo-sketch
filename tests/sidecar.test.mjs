import test from "node:test";
import assert from "node:assert/strict";
import {
  SidecarManager,
  SIDECAR_PREFIX,
  VISUAL_PRESET_ID,
} from "../src/host/sidecar.js";

function fakeAgent(id) {
  const calls = [];
  const agent = {
    id,
    session: {
      requestHeader: () => ({ config: { provider: "p", model: "m" } }),
    },
    options: {},
    model: { select: (selection) => calls.push(["select", selection]) },
    ctx: {
      systemPrompt: {
        section: (section) => calls.push(["section", section]),
        context: (context) => calls.push(["context", context]),
      },
      tools: {
        restrict: (filter) => calls.push(["restrict", filter]),
        guard: (guard) => calls.push(["guard", guard]),
      },
    },
    whenIdle: async () => undefined,
  };
  agent.__calls = calls;
  return { agent, calls };
}

function setup() {
  const agents = new Map();
  const created = [];
  const sent = [];
  const storeState = {
    sidecarChildId: "",
    user: { revision: 0 },
    agent: { revision: 0 },
  };
  let manager;
  const ctx = {
    agents: { get: (id) => agents.get(String(id)) },
    llm: {
      resolveModelInfo: async () => ({
        inputModalities: ["text", "image"],
        reasoning: { efforts: [{ id: "low" }] },
      }),
    },
    subagents: {
      startActivation: async (spec) => {
        created.push(spec);
        const { agent } = fakeAgent(String(spec.childId));
        agents.set(String(spec.childId), agent);
        manager.configureChild(agent);
        return { childId: spec.childId, dispose: async () => undefined };
      },
      sendMessage: async (_parent, childId, content) => {
        sent.push([String(childId), content]);
        return "message-1";
      },
    },
  };
  const store = {
    get: async () => storeState,
    setSidecarChildId: async (_id, childId) => {
      storeState.sidecarChildId = String(childId);
    },
    setVisual: async () => undefined,
  };
  manager = new SidecarManager({ ctx, store });
  const main = fakeAgent("main-1").agent;
  return { manager, ctx, main, created, sent, storeState, agents };
}

test("isSidecar uses the reserved prefix", () => {
  const { manager } = setup();
  assert.equal(manager.isSidecar(`${SIDECAR_PREFIX}x`), true);
  assert.equal(manager.isSidecar("main-1"), false);
});

test("first push creates a spawn sidecar with visual setup", async () => {
  const { manager, main, created, storeState, agents } = setup();
  const childId = await manager.push(
    main,
    [{ type: "text", text: "hello" }],
    {},
  );
  assert.equal(childId.startsWith(SIDECAR_PREFIX), true);
  assert.equal(created.length, 1);
  assert.equal(created[0].provider, "spawn");
  assert.equal(created[0].label, "画板 Sidecar");
  assert.equal(created[0].delivery, "caller");
  assert.equal(created[0].request.agentPreset, VISUAL_PRESET_ID);
  assert.deepEqual(created[0].request.agentOptions, {
    provider: "p",
    model: "m",
    reasoningEffort: "low",
    maxTokens: 8192,
  });
  assert.equal(storeState.sidecarChildId, childId);
  const child = agents.get(childId);
  assert.equal(manager.mainSessionOf(childId), "main-1");
  const setupCalls = child.__calls ?? [];
  assert.equal(
    setupCalls.some((call) => call[0] === "context"),
    true,
  );
  assert.equal(
    setupCalls.some((call) => call[0] === "restrict"),
    true,
  );
  assert.equal(
    setupCalls.some((call) => call[0] === "guard"),
    true,
  );
  assert.equal(
    setupCalls.some((call) => call[0] === "select"),
    true,
  );
});

test("later pushes use sendMessage and reuse the child", async () => {
  const { manager, main, created, sent, storeState, agents } = setup();
  const childId = await manager.push(
    main,
    [{ type: "text", text: "first" }],
    {},
  );
  await manager.push(main, [{ type: "text", text: "second" }], {});
  assert.equal(created.length, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], childId);
  assert.equal(agents.get(childId) !== undefined, true);
  assert.equal(storeState.sidecarChildId, childId);
});
