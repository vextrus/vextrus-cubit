// What a killed gate leaves behind (v22 Wave A, P2b finding 3).
//
// `pnpm verify` gates its independent lanes at once and buffers each lane's output so the four
// streams do not interleave into an unreadable verdict. Buffered in MEMORY, though, and written only
// when the lane closed: an engine that kills the gate — a budget park, a session timeout, an
// operator's ^C — took the whole buffer with it, and the run's stageTail was empty. The one moment
// the output is worth most is the moment it was lost.
//
// So each lane now spools to a file as its output arrives, and a parent that is going down flushes
// every lane's spool, labelled, before it goes. And a lane that never ends at all is not a lane the
// gate waits on forever: CUBIT_LANE_TIMEOUT_MS (15 min by default) kills it and says so.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { runAsync } from "../../scripts/lib/report.mjs";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/** A child that says something at once and then never ends — the shape of a lane mid-run. */
const SAYS_THEN_HANGS = "console.log('EARLY LINE FROM THE LANE'); setInterval(() => {}, 60000);";

afterEach(() => {
  delete process.env["CUBIT_LANE_TIMEOUT_MS"];
});

describe("a lane's output outlives the run that was watching it", () => {
  test("a parent killed mid-lane still prints what the lane had already said", async () => {
    // A parent of our own, so the kill is a real signal to a real process running the real runner.
    const scratch = mkdtempSync(join(tmpdir(), "cubit-lane-kill-"));
    const parent = join(scratch, "parent.mjs");
    writeFileSync(
      parent,
      `import { runAsync } from ${JSON.stringify(join(ROOT, "scripts", "lib", "report.mjs"))};\n` +
        `await runAsync(["node", "-e", ${JSON.stringify(SAYS_THEN_HANGS)}], { cwd: ${JSON.stringify(ROOT)}, label: "slow-lane" });\n`,
    );

    const said = await new Promise<string>((settle) => {
      const child = spawn(process.execPath, [parent], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
      let output = "";
      child.stdout.on("data", (chunk) => { output += String(chunk); });
      child.stderr.on("data", (chunk) => { output += String(chunk); });
      // Long enough for the lane to have spoken, far short of anything ending by itself.
      const killAt = setTimeout(() => child.kill("SIGTERM"), 2000);
      child.on("close", () => { clearTimeout(killAt); settle(output); });
    });

    expect(said, "a killed gate carried the lane's buffer to the grave — the whole stageTail was empty").toContain("EARLY LINE FROM THE LANE");
    expect(said, "the flushed output is not labelled, so a reader cannot tell which lane said it").toContain("slow-lane");
  }, 60_000);

  test("a lane that never ends is killed at its timeout, and says what it had said", async () => {
    process.env["CUBIT_LANE_TIMEOUT_MS"] = "1500";
    const printed: string[] = [];
    const code = await runAsync(["node", "-e", SAYS_THEN_HANGS], { cwd: ROOT, label: "endless-lane", write: (line) => printed.push(line) });

    expect(code, "a lane that outran its timeout came back green").not.toBe(0);
    expect(printed.join(""), "the timed-out lane's own output was lost").toContain("EARLY LINE FROM THE LANE");
    expect(printed.join(""), "the timeout was not reported as such").toMatch(/endless-lane/);
  }, 60_000);
});
