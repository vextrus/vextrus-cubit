// The test-id registry, read by the probe the way the rest of the tree reads it: from
// `src/ui/testids.ts`, the one spelling (AM-09 §1). A script under node cannot import the
// TypeScript module, so this reads the registry's text — a nested object literal of `key: "id"`
// lines — and answers the same nested object. A literal id in this harness would be a name the
// registry cannot rename, which is exactly what `cubit/no-literal-testid` refuses everywhere else.
import { readFileSync } from "node:fs";

const REGISTRY = new URL("../../../src/ui/testids.ts", import.meta.url);

/** @typedef {{[key: string]: string | Registry}} Registry */

/**
 * Parse the registry's `TESTIDS` literal: groups open with `name: {`, entries are `key: "id",`.
 * @param {string} source
 * @returns {Registry}
 */
export function parseRegistry(source) {
  const start = source.indexOf("export const TESTIDS");
  if (start === -1) throw new Error("src/ui/testids.ts publishes no `export const TESTIDS`");
  /** @type {Registry} */
  const root = {};
  /** @type {Registry[]} */
  const stack = [root];
  for (const raw of source.slice(start).split("\n").slice(1)) {
    const line = raw.replace(/\/\/.*$/, "").trim();
    if (line === "" || line.startsWith("*") || line.startsWith("/*")) continue;
    const top = stack[stack.length - 1];
    if (top === undefined) break;
    const open = /^([A-Za-z_$][\w$]*)\s*:\s*\{\s*$/.exec(line);
    if (open !== null && open[1] !== undefined) {
      /** @type {Registry} */
      const group = {};
      top[open[1]] = group;
      stack.push(group);
      continue;
    }
    const entry = /^([A-Za-z_$][\w$]*)\s*:\s*"([^"]+)"\s*,?\s*$/.exec(line);
    if (entry !== null && entry[1] !== undefined && entry[2] !== undefined) {
      top[entry[1]] = entry[2];
      continue;
    }
    if (/^\}/.test(line)) {
      stack.pop();
      if (stack.length === 0) break;
    }
  }
  return root;
}

/** The registry as the tree publishes it. */
export const TESTIDS = parseRegistry(readFileSync(REGISTRY, "utf8"));

/**
 * One id, by its dotted key — `shell.main` — refusing a key the registry does not carry.
 * @param {string} path
 * @returns {string}
 */
export function idOf(path) {
  /** @type {string | Registry | undefined} */
  let at = TESTIDS;
  for (const step of path.split(".")) {
    if (at === undefined || typeof at === "string") throw new Error(`src/ui/testids.ts declares no TESTIDS.${path}`);
    at = at[step];
    if (at === undefined) throw new Error(`src/ui/testids.ts declares no TESTIDS.${path}`);
  }
  if (typeof at !== "string") throw new Error(`TESTIDS.${path} is a group, not an id`);
  return at;
}

/**
 * The selector the tree spells for an id (`testIdSelector`).
 * @param {string} path
 * @returns {string}
 */
export function sel(path) {
  return `[data-testid="${idOf(path)}"]`;
}
