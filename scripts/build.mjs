/** 构建宿主与客户端 bundle。 */

import { mkdir } from "node:fs/promises";
import { build, context } from "esbuild";

const GENERATED = "/* 由 scripts/build.mjs 生成；请改 src/ 下的源码。 */";
const CLIENT_HEAD = `${GENERATED}\nwindow.__ModuleLoader__.load({\n  id: "dsh-echo-sketch",\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;\n    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });\n`;

/** @type {import('esbuild').BuildOptions} */
export const hostOptions = {
  entryPoints: ["src/host/index.js"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  legalComments: "none",
  banner: { js: GENERATED },
};

/** @type {import('esbuild').BuildOptions} */
export const clientOptions = {
  entryPoints: ["src/client/index.jsx"],
  outfile: "dist/client.js",
  bundle: true,
  platform: "browser",
  format: "cjs",
  target: "es2022",
  external: ["react", "react-dom"],
  jsx: "transform",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  legalComments: "none",
  footer: { js: "\n    return module.exports;\n  },\n});\n" },
  banner: { js: CLIENT_HEAD },
};

/** 执行一次构建。 */
export async function buildAll() {
  await mkdir("dist", { recursive: true });
  await Promise.all([build(hostOptions), build(clientOptions)]);
}

/** watch 模式：两个 context 同时监听。 */
export async function watchAll() {
  await mkdir("dist", { recursive: true });
  const [host, client] = await Promise.all([
    context(hostOptions),
    context(clientOptions),
  ]);
  await Promise.all([host.watch(), client.watch()]);
  console.log("[dsh-echo-sketch] watching src/host and src/client");
}

const watch = process.argv.includes("--watch");
await (watch ? watchAll() : buildAll());
if (!watch) console.log("[dsh-echo-sketch] build complete");
