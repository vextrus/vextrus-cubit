/**
 * Load one product module in a world where nothing outside `src/core/` exists, and say what it
 * published (AC-2).
 *
 * MECHANICS ONLY: it loads and it prints. Whether loading was supposed to work is the caller's
 * judgement — the suite that spawns this runs it over the method under test, and over a module that
 * is NOT pure as its control.
 *
 *   node_modules/.bin/tsx tests/takeoff/partition/conventions/load-under-core-only.mts <repo-relative module>
 */
import { register } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [relative] = process.argv.slice(2);
if (relative === undefined) throw new Error("usage: load-under-core-only.mts <repo-relative module>");

const root = process.cwd();
const entry = join(root, relative);

// Registered here rather than on the command line: the hooks chain runs newest first, so this world
// is imposed on top of the TypeScript resolution tsx already installed.
register(new URL("./core-only-loader.mjs", import.meta.url), { data: { root, entry } });

const loaded = (await import(pathToFileURL(entry).href)) as Record<string, unknown>;
process.stdout.write(`loaded ${relative}: ${Object.keys(loaded).sort().join(", ")}\n`);
