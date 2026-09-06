// @vitest-environment jsdom
/**
 * AC-4 — R-UI-030's top bar carries the global jobs tray, fed by the same register the inline
 * timeline reads. The tray is a shipped Popover: the trigger says it opens a dialog, the panel
 * lists what this frame is tracking, and an empty tray teaches instead of hiding (R-UI-050).
 *
 * The journey begins on the keyboard, as Q-11 asks: the trigger is focused and activated with
 * Enter, and the answer is read as testids, data attributes and the accessible name.
 *
 * "Newest first" is proved by staging: one job is tracked, the clock is allowed to move on, and the
 * second is tracked after it — so the expected order is a consequence of when they started rather
 * than of a list this file transcribes.
 */
import { createElement, type FunctionComponent } from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  FakeEventSource,
  TESTIDS,
  errorsModule,
  installDomStubs,
  installEventSource,
  pattern,
  shellBarrel,
  stringOf,
  stringsTable,
  testFormat,
  type JobsFormatShape,
  type Pattern,
  type TrackedJobShape,
} from "./support/stage";

const EVIDENCE = { href: "/t/tenant-1/p/project-1/drawings", label: "Upload again" } as const;
const ELAPSED_MS = 4200;

/** How long the second job is left to start after the first, so "newest" is unambiguous. */
const APART_MS = 25;

/** The props the shell's own suite mounts the bar with. */
const BAR = {
  workspace: { tenantId: "A", name: "Acme Holdings" },
  area: "projects",
  atAreaHome: true,
  email: "someone@example.com",
  signOut: (): void => undefined,
} as const;

const JOB_A: TrackedJobShape = { jobId: "job-a", kind: "ingest", subject: "drawing-1", evidence: EVIDENCE };
const JOB_B: TrackedJobShape = { jobId: "job-b", kind: "thumbnails", subject: "drawing-1", evidence: EVIDENCE };

function trackerOf(p: Pattern, jobs: readonly TrackedJobShape[]): FunctionComponent {
  const options = {};
  return () => {
    p.useTrackedJobs(jobs, options);
    return null;
  };
}

async function keyboardUser(): Promise<{ keyboard(input: string): Promise<void> }> {
  const specifier = "@testing-library/user-event";
  const mod = await import(specifier).catch((cause: unknown) => {
    expect.fail(`MISSING TEST DEPENDENCY: ${specifier} — AC-4 opens the tray from the keyboard (${String(cause)})`);
  });
  const bag = mod as { default?: { setup(options: object): { keyboard(input: string): Promise<void> } } };
  const setup = bag.default?.setup;
  expect(typeof setup, `${specifier} exposes no setup()`).toBe("function");
  return (setup as (options: object) => { keyboard(input: string): Promise<void> }).call(bag.default, {});
}

const textOf = (node: Element | null): string => (node?.textContent ?? "").trim();

/** Open the tray the way a person on a keyboard does, and hand back the panel it revealed. */
async function openTray(): Promise<HTMLElement> {
  const user = await keyboardUser();
  const trigger = screen.getByTestId(TESTIDS.tray);
  trigger.focus();
  await user.keyboard("{Enter}");
  await waitFor(() => {
    expect(screen.getByTestId(TESTIDS.trayPanel), "AC-4: activating the trigger opens the tray").toBeDefined();
  });
  return screen.getByTestId(TESTIDS.trayPanel);
}

beforeEach(() => {
  installDomStubs();
  FakeEventSource.instances = [];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("AC-4: the tray stands in the top bar, counts what is tracked and lists it newest first", async () => {
  installEventSource();
  const p = await pattern();
  const { ShellTopBar } = await shellBarrel();
  const table = await stringsTable();
  const format: JobsFormatShape = testFormat(await errorsModule());
  const TrackA = trackerOf(p, [JOB_A]);
  const TrackB = trackerOf(p, [JOB_B]);

  const tree = (withB: boolean) =>
    createElement(
      p.JobsProvider,
      { format },
      createElement(TrackA),
      withB ? createElement(TrackB) : null,
      createElement(ShellTopBar, BAR),
    );

  const { rerender } = render(tree(false));
  await act(async () => {
    await new Promise((resume) => setTimeout(resume, APART_MS));
  });
  await act(async () => {
    rerender(tree(true));
    await Promise.resolve();
  });

  // Both jobs end, so the region word is `done` and each item carries a timing.
  await act(async () => {
    for (const source of FakeEventSource.instances) {
      const jobId = new URL(source.url, "http://127.0.0.1").searchParams.get("jobId");
      source.emit("job", { jobId, kind: jobId === JOB_A.jobId ? JOB_A.kind : JOB_B.kind, seq: 1, step: "read", status: "succeeded", elapsedMs: ELAPSED_MS, at: "2026-09-05T00:00:00.000Z" });
    }
    await Promise.resolve();
  });

  const bar = screen.getByTestId(TESTIDS.topBar);
  const trigger = within(bar).getByTestId(TESTIDS.tray);
  expect(trigger.tagName, "AC-4: the tray is a button").toBe("BUTTON");
  expect(trigger.getAttribute("aria-haspopup"), "AC-4: the trigger says what it opens").toBe("dialog");
  expect(trigger.getAttribute("data-count")).toBe("2");
  expect(trigger.getAttribute("data-state"), "AC-4: the tray's state is derived exactly as the timeline's").toBe("done");
  expect(textOf(trigger), "AC-4: the count is visible, not only machine-readable").toContain("2");
  expect(
    screen.getByRole("button", { name: stringOf(table, "jobs_tray_label") }),
    "AC-4: the tray's accessible name is its registered label",
  ).toBe(trigger);

  const panel = await openTray();
  expect(textOf(panel), "AC-4: the panel names itself").toContain(stringOf(table, "jobs_tray_heading"));

  const items = within(panel).getAllByTestId(TESTIDS.trayItem);
  expect(items.map((item) => item.getAttribute("data-job")), "AC-4: newest first").toEqual([JOB_B.jobId, JOB_A.jobId]);

  const newest = items[0] as HTMLElement;
  expect(newest.getAttribute("data-kind")).toBe(JOB_B.kind);
  expect(newest.getAttribute("data-status")).toBe("succeeded");
  expect(textOf(newest)).toContain(stringOf(table, `job_step_${JOB_B.kind}`));
  expect(textOf(newest)).toContain(stringOf(table, "job_status_succeeded"));
  expect(textOf(newest), "AC-4: the item carries the same timing the timeline shows").toContain(format.seconds(ELAPSED_MS));
  expect(within(panel).queryByTestId(TESTIDS.trayEmpty), "AC-4: a tray with jobs is not empty").toBeNull();
});

test("AC-4: with nothing tracked the tray is idle and its panel teaches", async () => {
  const p = await pattern();
  const { ShellTopBar } = await shellBarrel();
  const table = await stringsTable();
  const format = testFormat(await errorsModule());

  render(createElement(p.JobsProvider, { format }, createElement(ShellTopBar, BAR)));

  const trigger = screen.getByTestId(TESTIDS.tray);
  expect(trigger.getAttribute("data-count")).toBe("0");
  expect(trigger.getAttribute("data-state"), "AC-4: nothing tracked reads as idle").toBe("idle");

  const panel = await openTray();
  expect(within(panel).queryAllByTestId(TESTIDS.trayItem), "AC-4: an empty tray lists nothing").toEqual([]);
  expect(textOf(within(panel).getByTestId(TESTIDS.trayEmpty)), "AC-4: silence never happens").toBe(stringOf(table, "jobs_tray_empty"));
});

test("AC-4: a tracked job that is still running keeps the tray running", async () => {
  installEventSource();
  const p = await pattern();
  const { ShellTopBar } = await shellBarrel();
  const format = testFormat(await errorsModule());
  const Track = trackerOf(p, [JOB_A]);

  render(createElement(p.JobsProvider, { format }, createElement(Track), createElement(ShellTopBar, BAR)));
  await act(async () => {
    await Promise.resolve();
  });

  const trigger = screen.getByTestId(TESTIDS.tray);
  expect(trigger.getAttribute("data-count")).toBe("1");
  expect(trigger.getAttribute("data-state"), "AC-4: a job nothing has answered about yet is queued, which is running").toBe("running");
});

test("AC-4: the bar outside any provider carries no tray, and stands as it always has", async () => {
  const { ShellTopBar } = await shellBarrel();

  render(createElement(ShellTopBar, BAR));

  expect(screen.getByTestId(TESTIDS.topBar), "AC-4: the bar itself is unchanged").toBeDefined();
  expect(screen.queryByTestId(TESTIDS.tray), "AC-4: the tray renders null outside a JobsProvider").toBeNull();
});
