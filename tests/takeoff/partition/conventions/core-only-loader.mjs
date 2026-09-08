// A module-resolution hook that makes a world in which NOTHING OUTSIDE `src/core/` exists for one
// module (AC-2). It judges the entry module's own imports and nothing else: every specifier that
// module asks for must resolve inside `src/core/`, whatever it is spelled as — the `@/core/` alias,
// a relative neighbour, a package name. Anything else is refused by name, so a method that reaches
// out of core cannot be loaded at all.
//
// This is how the purity of a pure method is OBSERVED rather than read: the import graph a module
// really has when it is loaded, seen through Node's own resolver (ARCH-01, L-CAD-08).
//
// Plain `.mjs` on purpose: hooks run in their own thread and are loaded before any TypeScript
// transform is registered there.
import { sep } from "node:path";
import { fileURLToPath } from "node:url";

/** The checkout, and the one module whose imports this world binds. */
let root = "";
let entry = "";

/**
 * @param {{root: string, entry: string}} data
 */
export function initialize(data) {
  root = data.root;
  entry = data.entry;
}

/**
 * @param {string} specifier
 * @param {{parentURL?: string}} context
 * @param {(specifier: string, context: unknown) => Promise<{url: string}>} nextResolve
 * @returns {Promise<{url: string}>}
 */
export async function resolve(specifier, context, nextResolve) {
  const resolved = await nextResolve(specifier, context);
  const parent = context.parentURL;
  if (parent === undefined || !parent.startsWith("file:") || fileURLToPath(parent) !== entry) return resolved;
  if (!resolved.url.startsWith("file:")) {
    throw new Error(`core-only: ${specifier} is not a module under src/core`);
  }
  const target = fileURLToPath(resolved.url);
  if (target.startsWith(`${root}${sep}src${sep}core${sep}`)) return resolved;
  throw new Error(`core-only: ${specifier} resolves to ${target.startsWith(root) ? target.slice(root.length + 1) : target}, which is not under src/core`);
}
