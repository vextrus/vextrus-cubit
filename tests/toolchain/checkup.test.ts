// AC7 — `pnpm checkup` is the machine's honest report (V-CHECKUP, B-23): it checks the pins, it
// probes only what the tree actually needs, and every skip it prints names an input root that is
// really absent. checkup is not part of the verify chain, so running it here cannot recurse.
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function checkup(): Run {
  const result = spawnSync("pnpm", ["checkup"], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000 });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function skipLines(stdout: string): { id: string; probe: string; raw: string }[] {
  const out: { id: string; probe: string; raw: string }[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const match = /^SKIP\s+(\S+)\s+missing=(\S+)$/.exec(raw.trim());
    if (match) out.push({ id: match[1]!, probe: match[2]!, raw: raw.trim() });
  }
  return out;
}

describe("AC7: checkup reports the machine honestly", () => {
  test("AC7: pnpm checkup exits 0 on this tree and prints something", () => {
    const run = checkup();
    expect(run.status, `pnpm checkup exited ${String(run.status)}\n${run.stdout}\n${run.stderr}`).toBe(0);
    expect(run.stdout.trim().length, "checkup printed nothing — a silent report is not a report").toBeGreaterThan(0);
  });

  test("AC7: checkup verifies the Node and pnpm pins against .nvmrc and packageManager", () => {
    expect(existsSync(join(REPO_ROOT, ".nvmrc")), ".nvmrc does not exist").toBe(true);
    expect(existsSync(join(REPO_ROOT, "package.json")), "package.json does not exist").toBe(true);
    const nodePin = readFileSync(join(REPO_ROOT, ".nvmrc"), "utf8").trim().replace(/^v/, "");
    const packageManager = (JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as { packageManager?: string }).packageManager ?? "";
    const pnpmPin = packageManager.replace(/^pnpm@/, "").split("+")[0]!;
    const stdout = checkup().stdout;
    expect(stdout, `checkup's report never mentions the Node pin ${nodePin} from .nvmrc`).toContain(nodePin);
    expect(stdout, `checkup's report never mentions the pnpm pin ${pnpmPin} from packageManager`).toContain(pnpmPin);
  });

  test("AC7: every skip checkup prints names an input root that really is missing", () => {
    const run = checkup();
    expect(run.status, `pnpm checkup exited ${String(run.status)}\n${run.stdout}\n${run.stderr}`).toBe(0);
    const forged = skipLines(run.stdout)
      .filter((skip) => existsSync(join(REPO_ROOT, ...skip.probe.replace(/\\/g, "/").split("/"))))
      .map((skip) => `${skip.raw} — but ${skip.probe} exists`);
    expect(forged, "a skip whose trigger is present is a forged skip (B-23)").toEqual([]);
  });

  test("AC7: the checks whose inputs this tree does not have are recorded as skips, not passed over", async () => {
    // checkup probes the same input roots as deriveLanes, so the tree — not a roster in this file —
    // decides whether a skip is owed at all.
    const lanesModule = join(REPO_ROOT, "scripts/lib/lanes.mjs");
    expect(existsSync(lanesModule), "scripts/lib/lanes.mjs does not exist — the roster has no exported home").toBe(true);
    const loaded: unknown = await import(pathToFileURL(lanesModule).href);
    const derive = (loaded as Record<string, unknown>)["deriveLanes"] as ((root: string) => { status: string }[]) | undefined;
    expect(typeof derive, "scripts/lib/lanes.mjs does not export deriveLanes(rootDir)").toBe("function");
    const stubs = (await Promise.resolve(derive!(REPO_ROOT))).filter((lane) => lane.status === "stub");

    const stdout = checkup().stdout;
    const skips = skipLines(stdout);
    if (stubs.length > 0) {
      expect(skips.length, `${stubs.length} input roots are missing, yet checkup printed no 'SKIP <checkId> missing=<probePath>' line at all:\n${stdout}`).toBeGreaterThan(0);
    }
  });
});
