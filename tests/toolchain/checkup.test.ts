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

/**
 * The failures the report declares, each attributed to the check that was announced as running when
 * it printed — the report states a check with `RUN <id>` and then one detail line per check.
 */
function failLines(stdout: string): { id: string; raw: string }[] {
  const out: { id: string; raw: string }[] = [];
  let announced = "";
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    const started = /^RUN\s+(\S+)$/.exec(line);
    if (started) {
      announced = started[1]!;
      continue;
    }
    if (/^SKIP\s/.test(line)) {
      announced = "";
      continue;
    }
    if (/—\s*FAIL$/.test(line)) out.push({ id: announced, raw: line });
  }
  return out;
}

/** checkup's own roster, from the module checkup itself walks — never a list restated here. */
async function machineChecks(): Promise<{ id: string; status: string; probe: string }[]> {
  const lanesModule = join(REPO_ROOT, "scripts/lib/lanes.mjs");
  expect(existsSync(lanesModule), "scripts/lib/lanes.mjs does not exist — the roster has no exported home").toBe(true);
  const loaded: unknown = await import(pathToFileURL(lanesModule).href);
  const derive = (loaded as Record<string, unknown>)["deriveMachineChecks"] as
    | ((root: string) => { id: string; status: string; probe: string }[])
    | undefined;
  expect(typeof derive, "scripts/lib/lanes.mjs does not export deriveMachineChecks(rootDir)").toBe("function");
  return derive!(REPO_ROOT);
}

describe("AC7: checkup reports the machine honestly", () => {
  test("AC7: checkup runs to completion and every non-zero exit is explained", async () => {
    // checkup's exit code is a function of the machine's provisioning, not of the tree: its own
    // contract says a check whose input exists but whose tool or service is absent *fails the
    // report*. So the lawful property is that the report is complete and self-explaining — exit 0
    // exactly when no armed check printed FAIL — never that this machine happened to be green.
    const run = checkup();
    expect(run.status, `pnpm checkup never ran to completion\n${run.stdout}\n${run.stderr}`).not.toBeNull();
    expect([0, 1], `pnpm checkup exited ${String(run.status)}\n${run.stdout}\n${run.stderr}`).toContain(run.status);
    expect(run.stdout.trim().length, "checkup printed nothing — a silent report is not a report").toBeGreaterThan(0);

    const fails = failLines(run.stdout);
    expect(
      run.status === 0,
      `checkup exited ${String(run.status)} while declaring ${fails.length} failure(s):\n${run.stdout}`,
    ).toBe(fails.length === 0);

    const armed = new Set((await machineChecks()).filter((check) => check.status === "armed").map((check) => check.id));
    const forged = fails
      .filter((fail) => !armed.has(fail.id))
      .map((fail) => `${fail.raw} — announced by ${fail.id === "" ? "no RUN line" : fail.id}`);
    expect(forged, "a FAIL for a stubbed or unrostered check is a forged failure — the mirror of B-23's forged skip").toEqual([]);
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
    // No exit-code guard: a forged skip is a forged skip at either exit code, and checkup exits 1
    // whenever an armed check's tool or service is absent on this machine.
    const run = checkup();
    const forged = skipLines(run.stdout)
      .filter((skip) => existsSync(join(REPO_ROOT, ...skip.probe.replace(/\\/g, "/").split("/"))))
      .map((skip) => `${skip.raw} — but ${skip.probe} exists`);
    expect(forged, "a skip whose trigger is present is a forged skip (B-23)").toEqual([]);
  });

  test("AC7: the checks whose inputs this tree does not have are recorded as skips, not passed over", async () => {
    // The roster checkup itself walks decides which skips are owed — the machine checks, not the
    // verify chain's lanes — and the correspondence runs both ways: a stub check that prints no SKIP
    // is a silent pass-over, and a SKIP for a check whose input root is present is a stale skip that
    // should have vanished when the tree grew that input. Both sides empty is the lawful answer for a
    // tree that has every input root (C-06/B-23).
    const lanesModule = join(REPO_ROOT, "scripts/lib/lanes.mjs");
    expect(existsSync(lanesModule), "scripts/lib/lanes.mjs does not exist — the roster has no exported home").toBe(true);
    const loaded: unknown = await import(pathToFileURL(lanesModule).href);
    const derive = (loaded as Record<string, unknown>)["deriveMachineChecks"] as
      | ((root: string) => { id: string; status: string; probe: string }[])
      | undefined;
    expect(typeof derive, "scripts/lib/lanes.mjs does not export deriveMachineChecks(rootDir)").toBe("function");
    const owed = derive!(REPO_ROOT)
      .filter((check) => check.status === "stub")
      .map((check) => `SKIP ${check.id} missing=${check.probe}`)
      .sort();

    const stdout = checkup().stdout;
    const printed = skipLines(stdout)
      .map((skip) => `SKIP ${skip.id} missing=${skip.probe}`)
      .sort();
    expect(printed, `checkup's skips do not match the machine checks whose input roots are absent:\n${stdout}`).toEqual(owed);
  });
});
