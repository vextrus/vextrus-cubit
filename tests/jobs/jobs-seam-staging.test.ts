/**
 * Public acceptance for inc-hotfix-20260914-0052 — AC-1, written as a state and not as a sighting
 * (arbitration of 2026-09-14, TEST_AMENDED: an acceptance whose first move is a red no lawful actor
 * may PRODUCE is a defect of the plan, B-20; Q-01 asks for a fixture that makes the defect appear on
 * demand, and this one does, in under a second, on any cluster).
 *
 * THE DEFECT, AS A STATE. Every suite in this lane — tests/jobs/jobs-seam.test.ts among them —
 * stages on a database cloned from the run's template, and a template is published by one boolean:
 * `datistemplate`, set after the migrations applied and read back as the whole of readiness
 * (db/__tests__/harness.ts). The stale sweep takes that flag off each database it is about to drop
 * and, when the unforced drop is refused, decides whether to put it back. Two quite different
 * databases refuse that drop with the same 55006: a finished template another run is cloning from,
 * and a database of an older digest whose migrations never finished. A sweep that cannot tell them
 * apart publishes the unfinished one as this cluster's ready template, and every file that
 * provisions next clones a schema whose migrations never ran — which reaches each suite as whatever
 * that suite happens to touch first, and reads as the suite's own flake.
 *
 * WHAT IS ASSERTED — the rule, both ways round: the flag goes back only where it came from. A
 * half-built database the sweep could not drop is left unpublished, and a ready template the sweep
 * could not drop is left ready, so a run cloning from it still reads it as ready. Neither half is a
 * timing question; no timeout or scheduler can clear this red, and no timing is asserted anywhere in
 * this file (AM-10(3)).
 *
 * NOTHING IS FROZEN HERE: the sweep is asked about a namespace this fixture makes for itself, and
 * every expectation is read back from the cluster it was staged on. The sweep's `prefix` parameter
 * exists for exactly this ("a suite that judges the sweep names its own namespace instead"), so the
 * template the rest of the lane is cloning from is never in reach.
 *
 * THE OTHER HALF of AC-1 — that tests/jobs/jobs-seam.test.ts itself exits 0 on the branch, run alone
 * and at lane concurrency, its wall time printed and recorded (AM-10(1)) — is the database lane's own
 * contract, which the gate runs as `pnpm test:db`; the run's output, which no lane inspects, is read
 * once at gate time in the held-out set.
 */
import { afterAll, describe, expect, test } from "vitest";
import { dropStaleTemplates } from "../../db/__tests__/harness";
import {
  backendsOn,
  databaseExists,
  dropStagedDatabase,
  holdOpen,
  isPublishedReady,
  stageDatabase,
  stagingNamespace,
  tablesOf,
  urlFor,
} from "./support/interrupted-stage";

/** Whatever this test staged on the cluster, taken away however the test ended. */
const staged: string[] = [];

afterAll(() => {
  for (const name of staged) dropStagedDatabase(name);
}, 120_000);

/** Stage a database of the fixture's own namespace, hold it open, and prove the hold took. */
function held(name: string, published: boolean): void {
  staged.push(name);
  stageDatabase(name, { published });
  holdOpen(name);
  expect(
    backendsOn(name),
    `the fixture could not keep a session standing on ${name} through the lane's own psql door, so the sweep's unforced drop would not be refused and there would be no case to judge`,
  ).toBeGreaterThan(0);
}

describe("AC-1: the stale-template sweep publishes nothing it did not find published", () => {
  test("AC-1: a half-built template the sweep cannot drop is left unpublished, and a ready one is left ready", () => {
    const namespace = stagingNamespace("ac1");
    const building = `${namespace}building`;
    const cloning = `${namespace}cloning`;

    // A database of an older digest whose migrations never finished: no flag, held open the way a
    // run that is still migrating holds it.
    held(building, false);
    expect(isPublishedReady(building), "the fixture did not stage the state under test — the half-built database is already flagged ready").toBe(false);
    expect(tablesOf(urlFor(building)), "the fixture did not stage the state under test — the half-built database is not unfinished").toEqual([]);

    // A finished template another run is cloning from: flagged, held open the same way.
    held(cloning, true);
    expect(isPublishedReady(cloning), "the fixture did not stage the state under test — the ready template is not flagged").toBe(true);

    const dropped = dropStaleTemplates(`${namespace}keep`, namespace);

    // Both were held, so both were kept: a sweep that dropped them judged nothing, and the two
    // assertions below would pass on a cluster where the case never arose.
    expect(dropped, `the sweep dropped databases it was being held out of — there was no refused drop to judge`).toEqual([]);
    for (const name of [building, cloning]) {
      expect(databaseExists(name), `${name} was held open, so the sweep's unforced drop must have been refused and the database left standing`).toBe(true);
    }

    expect(
      isPublishedReady(building),
      `the sweep published ${building} as a ready template — its migrations never finished, and every provision after this one clones that schema`,
    ).toBe(false);
    expect(
      isPublishedReady(cloning),
      `the sweep took the ready flag off ${cloning} and did not give it back — a run cloning from it now reads a finished template as unready`,
    ).toBe(true);
  }, 300_000);
});
