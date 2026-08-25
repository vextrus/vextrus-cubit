// ARCH-01, branch by branch. The import-direction matrix is mechanical from the foundation onward
// (B-18): core imports nothing above it; a module imports core and its own module only; server
// imports core and modules; app imports server, modules, core and ui; ui imports nothing outside
// itself except core types and never app; worker imports core and modules.
import { layerOf, targetOf } from "../lib/layers.mjs";
import { specifierVisitors } from "../lib/specifiers.mjs";

/** Layers each layer may reach, ARCH-01 verbatim. `ui` reads `core` for types only. */
const REACHES = Object.freeze({
  core: ["core"],
  modules: ["core", "modules"],
  server: ["core", "modules", "server"],
  app: ["core", "modules", "server", "app", "ui"],
  ui: ["ui", "core"],
  worker: ["core", "modules", "worker"],
});

/**
 * @param {{layer: string, module: string | null}} from
 * @param {{layer: string, module: string | null}} to
 * @param {boolean} typeOnly
 * @returns {string | null} the law that was broken, or null
 */
function judge(from, to, typeOnly) {
  const reaches = /** @type {Record<string, string[]>} */ (REACHES)[from.layer] ?? [];
  if (from.layer === "modules" && to.layer === "modules" && to.module !== from.module) {
    return `src/modules/${from.module} reaches into src/modules/${to.module}'s internals — a module imports core and its own module only (ARCH-01)`;
  }
  if (from.layer === "ui" && to.layer === "core" && !typeOnly) {
    return "src/ui imports nothing outside itself except core types — import type, or move the value into src/ui (ARCH-01)";
  }
  if (reaches.includes(to.layer)) return null;
  if (from.layer === "core") return `src/core imports nothing above it — it must not import src/${to.layer} (ARCH-01)`;
  if (from.layer === "ui" && to.layer === "app") return "src/ui never imports src/app (ARCH-01)";
  if (from.layer === "ui") return `src/ui imports nothing outside itself except core types — it must not import src/${to.layer} (ARCH-01)`;
  if (from.layer === "modules") return `src/modules imports core and its own module only — it must not import src/${to.layer} (ARCH-01)`;
  if (from.layer === "server") return `src/server imports core and modules — it must not import src/${to.layer} (ARCH-01)`;
  if (from.layer === "app") return `src/app imports server, modules, core and ui — it must not import src/${to.layer} (ARCH-01)`;
  return `src/worker imports core and modules — it must not import src/${to.layer} (ARCH-01)`;
}

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "the ARCH-01 import-direction matrix" },
    schema: [],
    messages: { boundary: "{{detail}}" },
  },
  create(context) {
    const from = layerOf(context.filename);
    if (from === null) return {};
    return specifierVisitors(context, ({ value, node, typeOnly }) => {
      const to = targetOf(value, context.filename);
      if (to === null) return;
      const detail = judge(from, to, typeOnly);
      if (detail !== null) context.report({ node: /** @type {any} */ (node), messageId: "boundary", data: { detail } });
    });
  },
};
