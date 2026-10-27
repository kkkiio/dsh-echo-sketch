/** /api/plugins/dsh-echo-sketch/* 路由。 */

export const ROUTE_PREFIX = "/api/plugins/dsh-echo-sketch";

const MAX_CANVAS_BODY = 2 * 1024 * 1024;
const MAX_RENDER_BODY = 16 * 1024 * 1024;
const MAX_SMALL_BODY = 32 * 1024;

/**
 * 构造四个主机路由；由插件入口用 connection.fetch.register 挂载。
 */
export function createRoutes({ ctx, store, bridge, triggerVisual }) {
  const supportCache = new Map();
  const imageSupportFor = async (sessionId) => {
    const agent = ctx.agents.get(sessionId);
    if (agent === undefined) return null;
    const config =
      agent.session?.requestHeader?.()?.config ?? agent.options ?? {};
    const key = `${config.provider ?? ""}/${config.model ?? ""}`;
    if (supportCache.has(key)) return supportCache.get(key);
    try {
      const info = await ctx.llm.resolveModelInfo(
        config.provider,
        config.model,
      );
      const supported =
        info?.inputModalities === undefined ||
        info.inputModalities.includes("image");
      supportCache.set(key, supported);
      return supported;
    } catch {
      return null;
    }
  };

  const stateRoute = {
    path: `${ROUTE_PREFIX}/state`,
    methods: ["GET"],
    requestBody: "buffered",
    fetch: async (request) => {
      const sessionId = sessionIdOf(request);
      if (sessionId === undefined) return bad("sessionId is required");
      const state = await store.publicState(sessionId);
      return json({
        ok: true,
        state,
        imageSupport: await imageSupportFor(sessionId),
        renderRequest: bridge.currentRequest(sessionId),
      });
    },
  };

  const canvasRoute = {
    path: `${ROUTE_PREFIX}/canvas`,
    methods: ["POST"],
    requestBody: "buffered",
    fetch: async (request) => {
      let body;
      try {
        body = await readJson(request, MAX_CANVAS_BODY);
      } catch (error) {
        return bad(String(error?.message ?? error));
      }
      const sessionId = validSessionId(body.sessionId);
      if (sessionId === undefined) return bad("invalid sessionId");
      if (body.kind === "agent") {
        if (body.clear !== true) return bad("agent canvas can only be cleared");
        await store.clearAgentCanvas(sessionId);
      } else if (body.kind === "user") {
        if (body.clear === true) await store.clearUserCanvas(sessionId);
        else await store.saveUserStrokes(sessionId, body.strokes);
      } else {
        return bad("kind must be user or agent");
      }
      return json({ ok: true, state: await store.publicState(sessionId) });
    },
  };

  const settingsRoute = {
    path: `${ROUTE_PREFIX}/settings`,
    methods: ["POST"],
    requestBody: "buffered",
    fetch: async (request) => {
      let body;
      try {
        body = await readJson(request, MAX_SMALL_BODY);
      } catch (error) {
        return bad(String(error?.message ?? error));
      }
      const sessionId = validSessionId(body.sessionId);
      if (sessionId === undefined) return bad("invalid sessionId");
      if (typeof body.autoDraw !== "boolean")
        return bad("autoDraw must be boolean");
      await store.setSettings(sessionId, { autoDraw: body.autoDraw });
      return json({ ok: true, state: await store.publicState(sessionId) });
    },
  };

  const redrawRoute = {
    path: `${ROUTE_PREFIX}/redraw`,
    methods: ["POST"],
    requestBody: "buffered",
    fetch: async (request) => {
      let body;
      try {
        body = await readJson(request, MAX_SMALL_BODY);
      } catch (error) {
        return bad(String(error?.message ?? error));
      }
      const sessionId = validSessionId(body.sessionId);
      if (sessionId === undefined) return bad("invalid sessionId");
      if (ctx.agents.get(sessionId) === undefined)
        return json({ ok: false, error: "session is not live" }, 409);
      try {
        await triggerVisual(sessionId, { force: true });
        return json({ ok: true });
      } catch (error) {
        return json({ ok: false, error: String(error?.message ?? error) }, 500);
      }
    },
  };

  const renderRoute = {
    path: `${ROUTE_PREFIX}/render-result`,
    methods: ["POST"],
    requestBody: "buffered",
    fetch: async (request) => {
      let body;
      try {
        body = await readJson(request, MAX_RENDER_BODY);
      } catch (error) {
        return bad(String(error?.message ?? error));
      }
      const sessionId = validSessionId(body.sessionId);
      if (sessionId === undefined) return bad("invalid sessionId");
      if (typeof body.requestId !== "string" || body.requestId.length === 0)
        return bad("requestId is required");
      const accepted = await bridge.accept(
        sessionId,
        body.requestId,
        body.images,
        body.errors,
      );
      if (!accepted)
        return json({ ok: false, error: "stale render request" }, 409);
      return json({ ok: true });
    },
  };

  return [stateRoute, canvasRoute, settingsRoute, redrawRoute, renderRoute];
}

function sessionIdOf(request) {
  return validSessionId(new URL(request.url).searchParams.get("sessionId"));
}

function validSessionId(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return undefined;
  return trimmed;
}

async function readJson(request, maxBytes) {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes)
    throw new Error("request body too large");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes)
    throw new Error("request body too large");
  const value = JSON.parse(text);
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("body must be an object");
  return value;
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function bad(message) {
  return json({ ok: false, error: message }, 400);
}
