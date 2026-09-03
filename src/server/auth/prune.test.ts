/**
 * What a failed pass may not become (ARCH-03, B-21), judged where the pass lives.
 *
 * `pruneWhenDue` is started from a limited door and awaited by nobody, so a rejection of its promise
 * is an unhandled rejection inside some unrelated person's request. The property is therefore not
 * "the failure is reported" but "the promise resolves anyway" — and it has to hold when the fault
 * seam's own sink is down too, which is the one case a report-then-resolve arm could still throw in.
 *
 * The database is swapped for one that is simply gone: this file is about the failure path, and a
 * live cluster would only make the same rejection harder to arrange.
 */
import { afterEach, expect, test, vi } from "vitest";

import { setFaultSink } from "../../core/faults/report";
import { pruneWhenDue, resetPruneSchedule } from "./prune";

vi.mock("../../core/db", () => ({
  runAsSystem: (): never => {
    throw new Error("the database went away mid-pass");
  },
  lt: (): undefined => undefined,
  authAttempts: {},
  authTokens: {},
  sessions: {},
}));

afterEach(() => {
  resetPruneSchedule();
});

test("a pass that fails while the fault sink is down still resolves", async () => {
  resetPruneSchedule();
  const previous = setFaultSink(() => {
    throw new Error("and the sink is down as well");
  });

  try {
    const running = pruneWhenDue(1_700_000_000_000);
    expect(running, "the schedule was armed, so this call started the pass").not.toBeNull();
    await expect(running, "nothing on the request path awaits this, so it may not reject").resolves.toBeUndefined();
  } finally {
    setFaultSink(previous);
  }
});
