// @vitest-environment jsdom
/**
 * THE MEASURE RUN IS FOLLOWED, NOT DRAWN ONCE (R-UI-024, X-1, docs/design/s-takeoff.md §1).
 *
 * WHY. The register drew the run its Measure door answered from a step it wrote itself — `queued`
 * — and never followed the job: the worker finished the run in two seconds and the strip said
 * `queued` for the whole of J-000's 240 s budget (2026-09-21, the column-lines leg: 480 readings of
 * `data-status="queued"` against a queue row `completed` at +2 s). The register's own words are "one
 * TRACKED job per measure run the door answered"; a step nobody follows is a lie after its first
 * frame.
 *
 * So the workspace hands the run to the pattern's tracked timeline as chrome — the jobs it started,
 * never steps it invented — and is told when a run succeeds, which is its cue to re-read the lines
 * the rails published. Observed here through a probe standing in for the chrome: what it was handed,
 * and what the workspace does when it is told.
 */
import { cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { levelStackFixture, mountRegister, one, stagedDoors } from "./support/fixtures";

afterEach(() => {
  cleanup();
});

/** A stand-in for the pattern's tracked timeline: it records what it is handed and can be told a run succeeded. */
function probe(): { TrackedJobTimeline: (props: Record<string, unknown>) => ReturnType<typeof createElement>; handed: () => unknown[]; succeed: () => void } {
  let jobs: unknown[] = [];
  let onSucceeded: ((job: unknown) => void) | undefined;
  return {
    TrackedJobTimeline: (props) => {
      jobs = props["jobs"] as unknown[];
      onSucceeded = props["onSucceeded"] as ((job: unknown) => void) | undefined;
      return createElement("div", { "data-testid": "register-runs-probe", "data-jobs": String(jobs.length) }, String(props["heading"]));
    },
    handed: () => jobs,
    succeed: () => onSucceeded?.(jobs[0]),
  };
}

describe("the register follows the measure run it starts (R-UI-024)", () => {
  test("pressing Measure hands the pattern's tracked timeline the job the door answered — a tracked job, not a step the register wrote", async () => {
    const view = levelStackFixture();
    const staged = await stagedDoors();
    const runs = probe();
    const root = await mountRegister(view, { doors: staged.doors, chrome: { TrackedJobTimeline: runs.TrackedJobTimeline } });

    expect(root.querySelector('[data-testid="register-runs-probe"]'), "no run watched, no strip (R-UI-080)").toBeNull();
    await userEvent.setup().click(one(root, "register-measure"));

    const asked = staged.calls.filter((call) => call.door === "requestMeasure");
    expect(asked.length, "the door was asked once").toBe(1);
    const handed = runs.handed() as { jobId: string; kind: string; subject: string; evidence: { href: string; label: string } }[];
    expect(handed.length, "the strip stands over exactly the run the door answered").toBe(1);
    expect(handed[0]?.kind, "which is a measure run").toBe("measure");
    expect(typeof handed[0]?.jobId, "named by the job the door answered — what the register follows, never a status it assumed").toBe("string");
    expect(handed[0]?.subject, "on the campaign the register reads").toBe(view.campaign?.campaignId);
    expect(handed[0]?.evidence.href, "with the evidence a failed run points at").toContain(`/t/${view.tenantId}/p/${view.projectId}/`);
  });

  test("a run that succeeds tells the workspace, which is the screen's cue to re-read the lines the rails published", async () => {
    const view = levelStackFixture();
    const staged = await stagedDoors();
    const runs = probe();
    const onRunSucceeded = vi.fn();
    const root = await mountRegister(view, { doors: staged.doors, chrome: { TrackedJobTimeline: runs.TrackedJobTimeline }, onRunSucceeded });

    await userEvent.setup().click(one(root, "register-measure"));
    expect(onRunSucceeded, "nothing is re-read on the press itself").not.toHaveBeenCalled();
    runs.succeed();
    expect(onRunSucceeded, "the moment the run succeeds, the workspace asks the screen to read the register again (X-1)").toHaveBeenCalledTimes(1);
  });
});
