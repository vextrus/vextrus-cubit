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
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// One home for the distDir's name and for the lock a serving process holds it with (ARCH-02): the
// journey lane's sweep reads the same two, and before it did it deleted this bundle mid-run.
import { DEFAULT_DIST_DIR, holdDistDir } from "./lib/dist.mjs";
// When the build read its inputs — its START, never its end (scripts/lib/build-stamp.mjs). Stamping
// the end let every edit made DURING a build be older than the marker, so it was never rebuilt.
import { writeBuildStamp } from "./lib/build-stamp.mjs";
// Whether the built output is current for this tree has one home (scripts/lib/build-currency.mjs):
// the live acceptance suites of the database lane read the same verdict over their shared build.
import { buildIsCurrent } from "./lib/build-currency.mjs";
// The journeys' port has one home too (scripts/lib/ports.mjs); `--port` still wins, as Playwright passes it.
import { portFor } from "./lib/ports.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const DIST = DEFAULT_DIST_DIR;
const args = process.argv.slice(2);
const valueOf = (/** @type {string} */ flag, /** @type {string} */ fallback) => { const at = args.indexOf(flag); return at === -1 ? fallback : (args[at + 1] ?? fallback); };
const NEXT = join(ROOT, valueOf("--next", "node_modules/next/dist/bin/next"));
const port = valueOf("--port", String(portFor("e2e")));
const policy = args.includes("build") ? "build" : args.includes("build-if-stale") ? "build-if-stale" : "build-if-stale";
if (args.includes("dev")) { process.stderr.write("e2e-server: the journeys never drive a dev server (V-E2E)\n"); process.exit(2); }

const verdict = policy === "build" ? { current: false, why: "build requested" } : buildIsCurrent(ROOT, DIST);
process.stdout.write(`e2e-server: ${verdict.current ? "reusing the build" : "building"} — ${verdict.why}\n`);
if (!verdict.current) {
  // Taken BEFORE the build reads anything, and written only once the build has succeeded: an edit
  // made while `next build` ran is at-or-after this instant, so the next run rebuilds it.
  const startedMs = Date.now();
  const b = spawnSync(process.execPath, [NEXT, "build"], { cwd: ROOT, stdio: "inherit", env: process.env });
  if (b.status !== 0) process.exit(b.status ?? 1);
  writeBuildStamp(join(ROOT, DIST), startedMs);
}
// Held for as long as this process serves, so `pnpm e2e:clean` cannot take the bundle out from
// under it; given back on exit, so a killed run locks nothing forever.
const release = holdDistDir(join(ROOT, DIST), Number(port));
const server = spawn(process.execPath, [NEXT, "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: ROOT, stdio: "inherit", env: process.env });
for (const sig of /** @type {const} */ (["SIGINT", "SIGTERM"])) process.on(sig, () => { release(); server.kill(sig); });
server.on("exit", (code, signal) => { release(); process.exit(code ?? (signal ? 1 : 0)); });
