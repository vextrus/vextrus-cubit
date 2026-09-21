// @vitest-environment jsdom
/**
 * THE PATTERN'S TRACKED TIMELINE — `TrackedJobTimeline` (R-UI-024, docs/design/job-timeline.md).
 *
 * `JobTimeline` draws steps; `useTrackedJobs` follows jobs; a screen composes the two. A module
 * screen cannot compose them (ARCH-01), so the pattern now publishes the composition: hand it the
 * jobs you started, and it registers them with the jobs register and draws what the register reads.
 * Proved on the contract only: the steps it draws are the jobs it was handed, by job id and kind,
 * and it asks nothing of a job it was not handed.
 */
import { createElement, type FunctionComponent } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { PATTERN_BARREL, productModule } from "./support/stage";

afterEach(() => {
  cleanup();
});

type Pattern = {
  JobsProvider: FunctionComponent<{ format: unknown; children?: unknown }>;
  TrackedJobTimeline: FunctionComponent<{ heading: string; jobs: readonly unknown[]; onSucceeded?: (job: unknown) => void }>;
};

const FORMAT = { seconds: (elapsedMs: number) => `${Math.round(elapsedMs / 1000)} s`, refusal: () => null };
const EVIDENCE = { href: "/t/tenant-1/p/project-1/drawings", label: "Add the drawing again" } as const;

test("the pattern publishes TrackedJobTimeline, and it draws one step per job it is handed, named by the job", async () => {
  const { JobsProvider, TrackedJobTimeline } = await productModule<Pattern>(PATTERN_BARREL);
  expect(typeof TrackedJobTimeline, `${PATTERN_BARREL} publishes TrackedJobTimeline — the composition a module screen is handed as chrome`).toBe("function");

  const jobs = [
    { jobId: "11111111-1111-4111-8111-111111111111", kind: "measure", subject: "campaign-1", evidence: EVIDENCE },
    { jobId: "22222222-2222-4222-8222-222222222222", kind: "measure", subject: "campaign-1", evidence: EVIDENCE },
  ];
  render(createElement(JobsProvider, { format: FORMAT }, createElement(TrackedJobTimeline, { heading: "Measure runs", jobs })));

  const steps = screen.getAllByTestId("job-timeline-step");
  expect(steps.map((step) => step.getAttribute("data-job")), "one step per job handed, in the order handed, each named by its job").toEqual(jobs.map((job) => job.jobId));
  expect(steps.map((step) => step.getAttribute("data-kind")), "each wearing the kind it was handed as").toEqual(["measure", "measure"]);
  for (const step of steps) {
    expect(step.getAttribute("data-status"), "a job nobody has read yet stands queued — never a status the caller invented").toBe("queued");
  }
  expect(screen.getByTestId("job-timeline").textContent, "under the heading the caller gave").toContain("Measure runs");
});
