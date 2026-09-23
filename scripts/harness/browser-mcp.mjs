#!/usr/bin/env node
// The `chrome-devtools` MCP server of this checkout (.mcp.json): chrome-devtools-mcp, pinned, driving
// the Chromium that the product's own Playwright installs, so what a session sees is what the
// journeys see. The marketplace plugin's copy looks for Google Chrome at /opt/google/chrome, which
// this machine does not have, and the plugin takes no arguments; this launcher resolves the browser
// on every start, so a Playwright upgrade moves it without anyone editing a path.
//
// Headless at the product's canonical viewport (1440x900); CUBIT_BROWSER_HEADED=1 opens a window
// (WSLg) for the owner to watch. A temporary profile per start (--isolated); the files it writes land
// in the checkout (--workspace). No usage statistics and no CrUX lookups: this product's URLs never
// leave the machine.
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The one pin of the server this checkout runs (a moved pin is a toolchain change, like any other). */
const SERVER = "chrome-devtools-mcp@1.9.0";

/** Screenshots, snapshots and traces may be written anywhere in the checkout (.private/work/review/ is where a review keeps them). */
const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const { chromium } = await import("@playwright/test");
const executablePath = chromium.executablePath();
const args = [
  "-y",
  SERVER,
  "--executablePath",
  executablePath,
  "--isolated",
  "--viewport",
  "1440x900",
  "--workspace",
  ROOT,
  "--usageStatistics=false",
  "--performanceCrux=false",
];
if (process.env.CUBIT_BROWSER_HEADED !== "1") args.push("--headless");

const child = spawn("npx", args, { stdio: "inherit", env: { ...process.env, CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: "1" } });
child.on("exit", (code, signal) => process.exit(code ?? (signal === null ? 0 : 1)));
for (const signal of /** @type {const} */ (["SIGINT", "SIGTERM"])) process.on(signal, () => child.kill(signal));
