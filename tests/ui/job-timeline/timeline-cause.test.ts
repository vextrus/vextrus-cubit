// @vitest-environment jsdom
/**
 * AC-2 — a step that ended badly names why (R-UI-020, C-SPINE-JOBS' "a job never fails silently").
 * A refusal renders in place through the ONE RefusalState renderer with the register's own message,
 * remedy and evidence link; a fault names its id; a step that ended neither way says neither thing.
 *
 * The refusal cases are derived from the register itself (B-19): every registered code is rendered
 * and judged here, so a code added later is covered by this file without an edit. Nothing asserts
 * the code as visible copy — the taxonomy travels as `data-code`, which is the renderer's own law.
 */
import { createElement } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { TESTIDS, errorsModule, kindNames, pattern, type TimelineStepShape } from "./support/stage";

const HEADING = "Reading drawings";

/** Where a refused step's evidence points — the caller's own place, verb-first label (R-UI-020). */
const EVIDENCE = { href: "/t/tenant-1/p/project-1/drawings", label: "Upload again" } as const;

/** A fault id is opaque and rendered verbatim: any string, echoed exactly (test contract). */
const FAULT_ID = "fault-7f3c1a";

/** Sonner's own nodes, which is what a raised toast puts in the document. */
const TOAST_NODES = "[data-sonner-toaster], [data-sonner-toast], .cx-toaster, .cx-toast";

const textOf = (node: Element | null): string => (node?.textContent ?? "").trim();

afterEach(() => {
  cleanup();
});

test("AC-2: every registered refusal renders in place, in the one renderer, with its evidence", async () => {
  const { JobTimeline } = await pattern();
  const errors = await errorsModule();
  const kind = (await kindNames())[0] as string;
  const codes = Object.keys(errors.REFUSALS);
  expect(codes.length, "AC-2: the register holds the entries a refused step is answered with").toBeGreaterThan(0);

  const steps: TimelineStepShape[] = codes.map((code, index) => ({
    id: `step-${index}`,
    jobId: `job-${index}`,
    kind,
    status: "refused",
    timing: "3 s",
    refusal: errors.refusalOf(code),
    faultId: null,
    evidence: { href: `${EVIDENCE.href}#${code}`, label: EVIDENCE.label },
  }));

  render(createElement(JobTimeline, { heading: HEADING, steps }));

  const rows = screen.getAllByTestId(TESTIDS.step);
  expect(rows.length).toBe(codes.length);

  for (const [index, code] of codes.entries()) {
    const entry = errors.refusalOf(code);
    const row = rows.find((candidate) => candidate.getAttribute("data-job") === `job-${index}`) as HTMLElement;
    expect(row, `AC-2: a step renders for the ${code} case`).toBeDefined();

    const shown = within(row).getAllByTestId(TESTIDS.refusal);
    expect(shown.length, `AC-2: exactly one refusal renders inside the ${code} step`).toBe(1);
    const refusal = shown[0] as HTMLElement;
    expect(refusal.getAttribute("data-code"), "AC-2: the taxonomy travels machine-readably").toBe(code);
    expect(textOf(within(refusal).getByTestId(TESTIDS.refusalMessage))).toBe(entry.message);
    expect(textOf(within(refusal).getByTestId(TESTIDS.refusalRemedy))).toBe(entry.remedy);

    const link = within(refusal).getByTestId(TESTIDS.refusalEvidence);
    expect(link.getAttribute("href"), "AC-2: the evidence is the step's own place").toBe(`${EVIDENCE.href}#${code}`);
    expect(textOf(link)).toBe(EVIDENCE.label);
    expect(within(row).queryByTestId(TESTIDS.stepFault), "AC-2: a refusal is not a fault").toBeNull();
  }

  expect(
    document.body.querySelectorAll(TOAST_NODES).length,
    "AC-2: a refusal is never a toast — it renders where the work was started",
  ).toBe(0);
});

test("AC-2: a failed step names the fault id it was handed, verbatim", async () => {
  const { JobTimeline } = await pattern();
  const kind = (await kindNames())[0] as string;

  render(
    createElement(JobTimeline, {
      heading: HEADING,
      steps: [
        {
          id: "step-1",
          jobId: "job-1",
          kind,
          status: "failed",
          timing: "9 s",
          refusal: null,
          faultId: FAULT_ID,
          evidence: EVIDENCE,
        },
      ],
    }),
  );

  const row = screen.getByTestId(TESTIDS.step);
  expect(textOf(within(row).getByTestId(TESTIDS.stepFault)), "AC-2: the report id is the thread to the fault").toContain(FAULT_ID);
  expect(within(row).queryByTestId(TESTIDS.refusal), "AC-2: a fault is not a refusal").toBeNull();
  expect(document.body.querySelectorAll(TOAST_NODES).length, "AC-2: no toast is raised").toBe(0);
});

test("AC-2: a step with neither a refusal nor a fault says neither thing", async () => {
  const { JobTimeline } = await pattern();
  const kind = (await kindNames())[0] as string;

  render(
    createElement(JobTimeline, {
      heading: HEADING,
      steps: [
        { id: "step-1", jobId: "job-1", kind, status: "succeeded", timing: "2 s", refusal: null, faultId: null, evidence: EVIDENCE },
        { id: "step-2", jobId: "job-2", kind, status: "running", timing: null, refusal: null, faultId: null, evidence: EVIDENCE },
      ],
    }),
  );

  expect(screen.queryAllByTestId(TESTIDS.refusal), "AC-2: nothing invents a refusal").toEqual([]);
  expect(screen.queryAllByTestId(TESTIDS.stepFault), "AC-2: nothing invents a fault").toEqual([]);
  expect(document.body.querySelectorAll(TOAST_NODES).length, "AC-2: no toast is raised").toBe(0);
});
