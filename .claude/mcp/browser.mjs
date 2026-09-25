#!/usr/bin/env node
// The chrome-devtools MCP server (.mcp.json), pinned, driving the newest Playwright Chromium in
// ~/.cache/ms-playwright when one is installed (this machine has no Google Chrome at its default
// path). Headless at 1440x900; VEXTRUS_BROWSER_HEADED=1 opens a window (WSLg). A temporary profile
// per start, and no usage statistics or CrUX lookups: the product's URLs never leave the machine.
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SERVER = "chrome-devtools-mcp@1.9.0";
const ROOT = process.env.CLAUDE_PROJECT_DIR ?? resolve(fileURLToPath(new URL("../..", import.meta.url)));

function playwrightChromium() {
  const cache = join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(cache)) return null;
  const builds = readdirSync(cache)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const build of builds) {
    for (const dir of ["chrome-linux64", "chrome-linux"]) {
      const path = join(cache, build, dir, "chrome");
      if (existsSync(path)) return path;
    }
  }
  return null;
}

const args = ["-y", SERVER, "--isolated", "--viewport", "1440x900", "--workspace", ROOT, "--usageStatistics=false", "--performanceCrux=false"];
const chrome = playwrightChromium();
if (chrome) args.push("--executablePath", chrome);
if (process.env.VEXTRUS_BROWSER_HEADED !== "1") args.push("--headless");

const child = spawn("npx", args, { stdio: "inherit", env: { ...process.env, CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: "1" } });
child.on("exit", (code, signal) => process.exit(code ?? (signal === null ? 0 : 1)));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
