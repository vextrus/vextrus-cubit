#!/usr/bin/env node
// The journeys' server (V-E2E: the journeys drive the BUILT product, never a dev server). Playwright's
// webServer ran `next build && next start` on every invocation — a 27 s cold build per journey even
// when verify had just built the same tree into the same distDir (the gate runs J-000 and every
// regression journey one invocation each). The build is reused when it is CURRENT: `<distDir>/BUILD_ID`
// exists, no input file (src, public, the configs, the manifest and its lockfile) is newer than it,
// and no tracked input was deleted since. Anything else builds first. What the journeys walk is still
// the built product of this tree; a stale build cannot be mistaken for a current one because every
// edit moves an mtime past the build's.
//
//   node scripts/e2e-server.mjs --next node_modules/next/dist/bin/next build-if-stale start --port <port>
//
// The words are the policy: `--next <bin>` names the Next binary that builds and serves; `build`
// always builds, `build-if-stale` builds only when the built output is older than an input; `start`
// serves the built product (`dev` is refused — V-E2E).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const DIST = process.env["NEXT_DIST_DIR"] ?? ".next-cubit";
const args = process.argv.slice(2);
const valueOf = (/** @type {string} */ flag, /** @type {string} */ fallback) => { const at = args.indexOf(flag); return at === -1 ? fallback : (args[at + 1] ?? fallback); };
const NEXT = join(ROOT, valueOf("--next", "node_modules/next/dist/bin/next"));
const port = valueOf("--port", "3211");
const policy = args.includes("build") ? "build" : args.includes("build-if-stale") ? "build-if-stale" : "build-if-stale";
if (args.includes("dev")) { process.stderr.write("e2e-server: the journeys never drive a dev server (V-E2E)\n"); process.exit(2); }

const INPUT_ROOTS = ["src", "public"];
const INPUT_FILES = ["next.config.ts", "package.json", "pnpm-lock.yaml", "tsconfig.json", "postcss.config.mjs", "tailwind.config.ts", "middleware.ts"];

/** The newest mtime under the input roots and files (a skipped directory is the build's own or dependencies). */
function newestInputMs() {
  let newest = 0;
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const ms = statSync(full).mtimeMs;
        if (ms > newest) newest = ms;
      }
    }
  };
  for (const root of INPUT_ROOTS) if (existsSync(join(ROOT, root))) walk(join(ROOT, root));
  for (const file of INPUT_FILES) if (existsSync(join(ROOT, file))) newest = Math.max(newest, statSync(join(ROOT, file)).mtimeMs);
  return newest;
}

/** A tracked input deleted since the last commit leaves no mtime behind: `git status` names it. */
function inputDeleted() {
  const r = spawnSync("git", ["status", "--porcelain", "--", ...INPUT_ROOTS, ...INPUT_FILES], { cwd: ROOT, encoding: "utf8" });
  return r.status === 0 && /^\s?D\s/m.test(r.stdout);
}

function buildIsCurrent() {
  const marker = join(ROOT, DIST, "BUILD_ID");
  if (!existsSync(marker)) return { current: false, why: `no ${DIST}/BUILD_ID` };
  const builtMs = statSync(marker).mtimeMs;
  const newest = newestInputMs();
  if (newest > builtMs) return { current: false, why: `an input is newer than the build by ${Math.round((newest - builtMs) / 1000)}s` };
  if (inputDeleted()) return { current: false, why: "a tracked input was deleted since the last commit" };
  return { current: true, why: `${DIST} built ${Math.round((Date.now() - builtMs) / 1000)}s ago and every input is older` };
}

const verdict = policy === "build" ? { current: false, why: "build requested" } : buildIsCurrent();
process.stdout.write(`e2e-server: ${verdict.current ? "reusing the build" : "building"} — ${verdict.why}\n`);
if (!verdict.current) {
  const b = spawnSync(process.execPath, [NEXT, "build"], { cwd: ROOT, stdio: "inherit", env: process.env });
  if (b.status !== 0) process.exit(b.status ?? 1);
}
const server = spawn(process.execPath, [NEXT, "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: ROOT, stdio: "inherit", env: process.env });
for (const sig of /** @type {const} */ (["SIGINT", "SIGTERM"])) process.on(sig, () => server.kill(sig));
server.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
