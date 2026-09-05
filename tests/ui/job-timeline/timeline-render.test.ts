// @vitest-environment jsdom
/**
 * AC-1 — R-UI-024's one timeline: it renders the steps it is handed and derives the region's state
 * from them, and it is the very component S-Drawings renders (B-17: one invariant, one home).
 *
 * The component is observed through the closed test contract only — the ids and data attributes the
 * increment spec fixes. No stylesheet fact is asserted: jsdom lays nothing out, and the marker,
 * connector and motion are the Design Decision's baselines.
 *
 * `.ts` rather than `.tsx`: tsconfig includes `tests/**\/*.ts`, so this file is `tsc`'s to read as
 * well as vitest's, and elements are therefore built with `createElement`.
 *
 * The kind roster is READ from the seam's own table, never transcribed (B-19): a job kind added
 * later must render its own word for this file to pass, with no edit here.
 */
import { createElement, type FunctionComponent } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  REPO_ROOT,
  ROUTE_LOCAL_TIMELINE,
  SHEET_INDEX_MODULE,
  TESTIDS,
  drawingsStrings,
  errorsModule,
  kindNames,
  pattern,
  productModule,
  stringOf,
  stringsTable,
  testFormat,
  type StepStatus,
  type TimelineStepShape,
} from "./support/stage";

// The screen under AC-1's last sentence is a client component of a route Next renders on demand;
// mounted by a test it has no router above it, so the hook it reaches for is answered here.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined, prefetch: () => undefined }),
  usePathname: () => "/t/tenant-1/p/project-1/drawings",
  useSearchParams: () => new URLSearchParams(),
}));

/** The consumer's own copy, which the pattern never invents for it. */
const HEADING = "Reading drawings";

const EVIDENCE = { href: "/t/tenant-1/p/project-1/drawings", label: "Upload again" } as const;

/** The five words a step can stand at — the test contract's `StepStatus`, closed by the spec. */
const STATUSES: readonly StepStatus[] = ["queued", "running", "succeeded", "failed", "refused"];

let minted = 0;

/** One step, in the shape the barrel publishes; only what a case is about is spelled per case. */
function step(over: Partial<TimelineStepShape> = {}): TimelineStepShape {
  minted += 1;
  return {
    id: `step-${minted}`,
    jobId: `job-${minted}`,
    kind: "ingest",
    status: "queued",
    timing: null,
    refusal: null,
    faultId: null,
    evidence: EVIDENCE,
    ...over,
  };
}

const textOf = (node: Element | null): string => (node?.textContent ?? "").trim();

afterEach(() => {
  cleanup();
});

test("AC-1: with no steps the region is an idle section that teaches what it is waiting for", async () => {
  const { JobTimeline } = await pattern();
  const table = await stringsTable();

  render(createElement(JobTimeline, { heading: HEADING, steps: [] }));

  const region = screen.getByTestId(TESTIDS.timeline);
  expect(region.tagName, "AC-1: the timeline is a section").toBe("SECTION");
  expect(region.getAttribute("data-state"), "AC-1: no steps reads as idle").toBe("idle");
  expect(textOf(region), "AC-1: the heading is the consumer's own copy").toContain(HEADING);
  expect(textOf(within(region).getByTestId(TESTIDS.idle))).toBe(stringOf(table, "job_timeline_idle"));
  expect(screen.queryAllByTestId(TESTIDS.step), "AC-1: an idle timeline renders no step").toEqual([]);
});

/**
 * The state rule itself, case by case: a terminal step outranks everything, a step still to finish
 * or an awaited one keeps the region running, and only a settled, complete list reads done.
 */
const STATE_CASES: readonly { statuses: readonly StepStatus[]; awaiting?: boolean; state: string }[] = [
  { statuses: ["succeeded"], state: "done" },
  { statuses: ["succeeded", "succeeded"], state: "done" },
  { statuses: ["queued"], state: "running" },
  { statuses: ["running"], state: "running" },
  { statuses: ["queued", "succeeded"], state: "running" },
  { statuses: ["succeeded"], awaiting: true, state: "running" },
  { statuses: ["succeeded", "succeeded"], awaiting: true, state: "running" },
  { statuses: ["failed"], state: "failed" },
  { statuses: ["refused"], state: "failed" },
  { statuses: ["succeeded", "failed"], state: "failed" },
  { statuses: ["running", "refused"], state: "failed" },
  { statuses: ["failed"], awaiting: true, state: "failed" },
];

test.each(STATE_CASES)("AC-1: steps $statuses with awaiting $awaiting read as $state", async ({ statuses, awaiting, state }) => {
  const { JobTimeline } = await pattern();

  render(
    createElement(JobTimeline, {
      heading: HEADING,
      steps: statuses.map((status) => step({ status })),
      awaiting,
    }),
  );

  expect(screen.getByTestId(TESTIDS.timeline).getAttribute("data-state")).toBe(state);
});

test("AC-1: every registered job kind renders its own word", async () => {
  const { JobTimeline } = await pattern();
  const table = await stringsTable();
  const kinds = await kindNames();

  render(
    createElement(JobTimeline, {
      heading: HEADING,
      steps: kinds.map((kind) => step({ kind, status: "succeeded", timing: "1 s" })),
    }),
  );

  const rows = screen.getAllByTestId(TESTIDS.step);
  expect(rows.length, "AC-1: one step renders per step handed in").toBe(kinds.length);
  for (const kind of kinds) {
    const row = rows.find((candidate) => candidate.getAttribute("data-kind") === kind);
    expect(row, `AC-1: the timeline renders a step for the ${kind} kind`).toBeDefined();
    expect(textOf(row as HTMLElement), `AC-1: the ${kind} step names its kind`).toContain(stringOf(table, `job_step_${kind}`));
  }
});

test.each(STATUSES)("AC-1: a %s step carries its job, kind and status, and says the status politely", async (status) => {
  const { JobTimeline } = await pattern();
  const table = await stringsTable();
  const kinds = await kindNames();
  const kind = kinds[0] as string;
  const one = step({ jobId: "job-77", kind, status, timing: "12 s" });

  render(createElement(JobTimeline, { heading: HEADING, steps: [one] }));

  const row = screen.getByTestId(TESTIDS.step);
  expect(row.tagName, "AC-1: a step is a list item").toBe("LI");
  expect(row.getAttribute("data-job")).toBe("job-77");
  expect(row.getAttribute("data-kind")).toBe(kind);
  expect(row.getAttribute("data-status")).toBe(status);

  const said = within(row).getByTestId(TESTIDS.stepStatus);
  expect(said.getAttribute("aria-live"), "AC-1: a status that changes under the reader is announced").toBe("polite");
  expect(textOf(said)).toBe(stringOf(table, `job_status_${status}`));
  expect(textOf(within(row).getByTestId(TESTIDS.stepTiming)), "AC-1: the timing is shown verbatim").toBe("12 s");
});

test("AC-1: a running step with no timing yet shows a bone, and no digits stand in for one", async () => {
  const { JobTimeline } = await pattern();

  render(createElement(JobTimeline, { heading: HEADING, steps: [step({ status: "running", timing: null })] }));

  const row = screen.getByTestId(TESTIDS.step);
  expect(within(row).getAllByTestId(TESTIDS.skeleton).length, "AC-1: the timing cell holds a core Skeleton").toBe(1);
  expect(textOf(within(row).queryByTestId(TESTIDS.stepTiming)), "AC-1: nothing numeric is invented").not.toMatch(/\d/);
  expect(textOf(row)).not.toMatch(/\d/);
});

test("AC-1: S-Drawings' timeline IS the pattern — the screen renders the one home", async () => {
  const { JobsProvider } = await pattern();
  const table = await stringsTable();
  const drawings = await drawingsStrings();
  const errors = await errorsModule();
  const { SheetIndex } = await productModule<{ SheetIndex: FunctionComponent<Record<string, unknown>> }>(SHEET_INDEX_MODULE);

  render(
    createElement(
      JobsProvider,
      { format: testFormat(errors) },
      createElement(SheetIndex, {
        tenantId: "3f1c2e10-8a44-4e2b-9f0a-1c2d3e4f5061",
        projectId: "9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d",
        cards: [],
        groups: [],
        canConfirm: false,
        awaitingIngest: 0,
      }),
    ),
  );

  const region = screen.getByTestId(TESTIDS.timeline);
  expect(region.getAttribute("data-state"), "AC-1: no drawing is being read on a fresh index").toBe("idle");
  // The pattern's own idle sentence, from the shared table — the route-local copy had its own key,
  // so reading this one here is what "the same component" means observably.
  expect(textOf(within(region).getByTestId(TESTIDS.idle))).toBe(stringOf(table, "job_timeline_idle"));
  expect(textOf(region), "AC-1: the heading stays the screen's own copy").toContain(stringOf(drawings, "drawings_timeline_heading"));
});

// white-box: AC-1 — "job-timeline.tsx no longer exists" is a property of the tree itself: the copy
// B-17 forbids has no runtime observable once the pattern renders the same ids beside it.
test("AC-1: the route-local timeline is retired, not kept beside the pattern", () => {
  expect(
    existsSync(join(REPO_ROOT, ROUTE_LOCAL_TIMELINE)),
    `${ROUTE_LOCAL_TIMELINE} still exists — a second home for the timeline is the byte-copied primitive B-17 refuses`,
  ).toBe(false);
});
