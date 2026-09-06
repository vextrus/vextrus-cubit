/**
 * AC-2 — the worker refuses to start when the environment it was declared to need is not there.
 *
 * The worker is spawned exactly the way `tests/jobs/jobs-seam.test.ts` spawns one — `tsx
 * src/worker/main.ts` at the checkout root — in an environment built from a copy of this process's
 * with every DECLARED name removed and only the case's names put back. Which names the case must
 * put back is read off `ENV_DECLARATION`: the worker's own answer for what it cannot start without,
 * so a later increment that makes another name required by the worker is judged here rather than
 * walked past.
 *
 * What is judged is what an operator and a supervisor see: the exit status, the contract line on
 * stdout, and the one fault record on stderr — never the worker's source.
 */
import { describe, expect, test } from "vitest";
import { envModule, faultRecords, FAILED_TO_START, READY_LINE, requiredBy, sampleFor, spawnWorker, stdoutLines, transcript, WORKER_ROUTE, type WorkerRun } from "./support/env-stage";

/** Long enough for a cold `tsx` boot that refuses, and shorter than the stage's own watchdog. */
const CASE_BUDGET_MS = 120_000;

/** The malformed health port AC-2 names. */
const NOT_A_PORT = "http";

/**
 * Everything a refused boot promises, in one place: the status, the silence about being ready, the
 * single contract line, and the single fault record that carries the same id and names the variable.
 */
function judgeRefusedBoot(run: WorkerRun, offendingName: string): void {
  const said = transcript(run);
  expect(run.timedOut, `the worker did not exit — a required name was absent and it started anyway\n${said}`).toBe(false);
  expect(run.code, `the worker did not exit 1\n${said}`).toBe(1);

  const lines = stdoutLines(run);
  expect(lines, `the worker announced itself ready with ${offendingName} unusable\n${said}`).not.toContain(READY_LINE);

  const failures = lines.filter((line) => FAILED_TO_START.test(line));
  expect(failures, `stdout does not carry exactly one "worker: failed to start (fault <uuid>)" line\n${said}`).toHaveLength(1);
  const faultId = FAILED_TO_START.exec(failures[0] ?? "")?.[1];

  const records = faultRecords(run).filter((record) => record.route === WORKER_ROUTE);
  expect(records, `stderr does not carry exactly one fault record under ${WORKER_ROUTE}\n${said}`).toHaveLength(1);
  const record = records[0];
  expect(record?.faultId, `the recorded fault is not the one stdout named\n${said}`).toBe(faultId);
  expect(record?.cause ?? "", `the recorded cause does not name ${offendingName}\n${said}`).toContain(offendingName);
  for (const field of ["requestId", "actor", "at"] as const) {
    expect(typeof record?.[field], `the fault record has no ${field}`).toBe("string");
  }
}

describe("AC-2 — the worker's boot", () => {
  test(
    "AC-2: a name the declaration says the worker requires, absent, refuses the boot and names it",
    async () => {
      const { ENV_NAMES, ENV_DECLARATION } = await envModule();
      const needed = requiredBy(ENV_DECLARATION, "worker");
      expect(needed, "the worker is declared to require nothing — the declaration says the boot cannot be judged").not.toEqual([]);
      expect(needed, "DATABASE_URL is not declared as a name the worker requires").toContain("DATABASE_URL");

      for (const absent of needed) {
        const stated: Record<string, string> = {};
        for (const name of needed) if (name !== absent) stated[name] = sampleFor(name);
        judgeRefusedBoot(await spawnWorker(ENV_NAMES, stated), absent);
      }
    },
    CASE_BUDGET_MS,
  );

  test(
    "AC-2: a malformed WORKER_HEALTH_PORT refuses the boot and names it",
    async () => {
      const { ENV_NAMES, ENV_DECLARATION } = await envModule();
      expect(requiredBy(ENV_DECLARATION, "worker"), "WORKER_HEALTH_PORT is not declared as a name the worker requires").toContain("WORKER_HEALTH_PORT");

      const stated: Record<string, string> = {};
      for (const name of requiredBy(ENV_DECLARATION, "worker")) stated[name] = sampleFor(name);
      stated["WORKER_HEALTH_PORT"] = NOT_A_PORT;
      judgeRefusedBoot(await spawnWorker(ENV_NAMES, stated), "WORKER_HEALTH_PORT");
    },
    CASE_BUDGET_MS,
  );
});
