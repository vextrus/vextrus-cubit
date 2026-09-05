// @vitest-environment jsdom
/**
 * AC-3 — one watch per job, and the readings it derives (C-SPINE-JOBS: progress is streamed with
 * per-step status, timings and named refusals; R-UI-024: results appear without reload).
 *
 * The stream leg is driven by a controllable EventSource (jsdom publishes none, which is exactly the
 * condition the poll leg is chosen under — asserted, never assumed). Nothing here pins the poll
 * cadence: the clock is advanced far past any interval a Decision could lawfully choose and what is
 * judged is how many times the route was asked (B-19).
 *
 * The seconds a timing shows are `format.seconds`' own answer — the test's format is asked for the
 * expected string rather than a literal being spelled beside it, so the criterion holds whatever
 * the frame later binds.
 */
import { createElement, type FunctionComponent } from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  FakeEventSource,
  TESTIDS,
  answering,
  errorsModule,
  expectNoEventSource,
  installEventSource,
  pattern,
  pollsFor,
  stringOf,
  stringsTable,
  testFormat,
  type JobsFormatShape,
  type Pattern,
  type PollAnswer,
  type TrackedJobShape,
} from "./support/stage";

const HEADING = "Reading drawings";
const JOB_ID = "job-1";
const KIND = "ingest";
const EVIDENCE = { href: "/t/tenant-1/p/project-1/drawings", label: "Upload again" } as const;
const JOB: TrackedJobShape = { jobId: JOB_ID, kind: KIND, subject: "drawing-1", evidence: EVIDENCE };

/** Far past any polling interval this pattern could lawfully choose — the criterion's "until". */
const WELL_PAST_ANY_INTERVAL_MS = 60_000;

/** How long the ingest took, as the stream reports it. */
const ELAPSED_MS = 4200;

/** The frame the seam publishes, in the route's own envelope; only `status` changes per case. */
function frame(status: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return { jobId: JOB_ID, kind: KIND, seq: 1, step: KIND, status, elapsedMs: ELAPSED_MS, at: "2026-09-05T00:00:00.000Z", ...over };
}

/** A component that tracks jobs through the hook and renders the one timeline over its readings. */
function trackerOf(p: Pattern, jobs: readonly TrackedJobShape[], onSucceeded?: (job: TrackedJobShape) => void): FunctionComponent {
  const options = { onSucceeded };
  return () => {
    const { steps, lost } = p.useTrackedJobs(jobs, options);
    return createElement(p.JobTimeline, { heading: HEADING, steps, lost });
  };
}

/** The provider, the format it is handed, and a tracker under it — the staging every case shares. */
async function staged(jobs: readonly TrackedJobShape[] = [JOB], onSucceeded?: (job: TrackedJobShape) => void): Promise<{ p: Pattern; format: JobsFormatShape }> {
  const p = await pattern();
  const format = testFormat(await errorsModule());
  const Tracker = trackerOf(p, jobs, onSucceeded);
  render(createElement(p.JobsProvider, { format }, createElement(Tracker)));
  await act(async () => {
    await Promise.resolve();
  });
  return { p, format };
}

const step = (): HTMLElement => screen.getByTestId(TESTIDS.step);
const statusOf = (): string | null => step().getAttribute("data-status");
const timingText = (): string => (within(step()).queryByTestId(TESTIDS.stepTiming)?.textContent ?? "").trim();

beforeEach(() => {
  FakeEventSource.instances = [];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("AC-3: one EventSource is opened for the job, at the events route", async () => {
  installEventSource();
  await staged();

  const source = FakeEventSource.only("AC-3: exactly one watch is opened for the job");
  const opened = new URL(source.url, "http://127.0.0.1");
  expect(opened.pathname, "AC-3: the watch reads the events route").toBe("/api/events");
  expect(opened.searchParams.get("jobId"), "AC-3: it names the job it follows").toBe(JOB_ID);
});

test.each(["started", "progress"])("AC-3: a %s frame reads as running", async (status) => {
  installEventSource();
  await staged();
  const source = FakeEventSource.only("AC-3: one watch");

  await act(async () => {
    source.emit("job", frame(status));
    await Promise.resolve();
  });

  expect(statusOf(), `AC-3: the seam's ${status} is the timeline's running`).toBe("running");
});

test.each(["succeeded", "failed"])("AC-3: a %s frame is read verbatim, with the elapsed time formatted", async (status) => {
  installEventSource();
  const { format } = await staged();
  const source = FakeEventSource.only("AC-3: one watch");

  await act(async () => {
    source.emit("job", frame(status));
    await Promise.resolve();
  });

  expect(statusOf()).toBe(status);
  expect(timingText(), "AC-3: the timing is format.seconds of the latest frame").toBe(format.seconds(ELAPSED_MS));
});

test("AC-3: a refused frame carries the register's own entry into the step", async () => {
  installEventSource();
  const errors = await errorsModule();
  const code = "FORMAT_NOT_ACCEPTED";
  const entry = errors.refusalOf(code);
  const { format } = await staged();
  const source = FakeEventSource.only("AC-3: one watch");

  await act(async () => {
    source.emit("job", frame("refused", { refusalCode: code }));
    await Promise.resolve();
  });

  expect(statusOf()).toBe("refused");
  expect(timingText()).toBe(format.seconds(ELAPSED_MS));
  const shown = within(step()).getAllByTestId(TESTIDS.refusal);
  expect(shown.length, "AC-3: the named refusal renders in place").toBe(1);
  expect((shown[0] as HTMLElement).getAttribute("data-code")).toBe(code);
  expect((within(shown[0] as HTMLElement).getByTestId(TESTIDS.refusalMessage).textContent ?? "").trim()).toBe(entry.message);
});

test("AC-3: a fault frame reads as failed and names the fault id", async () => {
  installEventSource();
  const faultId = "fault-9c21";
  await staged();
  const source = FakeEventSource.only("AC-3: one watch");

  await act(async () => {
    source.emit("fault", { faultId });
    await Promise.resolve();
  });

  expect(statusOf(), "AC-3: a fault frame is the job failing").toBe("failed");
  expect((within(step()).getByTestId(TESTIDS.stepFault).textContent ?? "").trim()).toContain(faultId);
});

test("AC-3: onSucceeded fires once per job however often the ending is repeated", async () => {
  installEventSource();
  const told: TrackedJobShape[] = [];
  await staged([JOB], (job) => told.push(job));
  const source = FakeEventSource.only("AC-3: one watch");

  await act(async () => {
    source.emit("job", frame("succeeded"));
    source.emit("job", frame("succeeded", { seq: 2 }));
    source.emit("job", frame("succeeded", { seq: 3 }));
    await Promise.resolve();
  });

  expect(told.length, "AC-3: the chained request is made once per job, not once per frame").toBe(1);
  expect(told[0]?.jobId).toBe(JOB_ID);
});

test("AC-3: a job already settled is not watched again when its consumer re-renders", async () => {
  installEventSource();
  const p = await pattern();
  const format = testFormat(await errorsModule());
  const Tracker = trackerOf(p, [JOB]);
  const tree = (label: string) => createElement(p.JobsProvider, { format }, createElement(Tracker), createElement("span", null, label));

  const { rerender } = render(tree("first"));
  await act(async () => {
    await Promise.resolve();
  });
  const source = FakeEventSource.only("AC-3: one watch");
  await act(async () => {
    source.emit("job", frame("succeeded"));
    await Promise.resolve();
  });

  await act(async () => {
    rerender(tree("second"));
    await Promise.resolve();
  });

  expect(statusOf()).toBe("succeeded");
  expect(FakeEventSource.instances.length, "AC-3: a terminal reading is never re-watched").toBe(1);
});

test("AC-3: a tracked job with no id reads as succeeded and opens no transport", async () => {
  installEventSource();
  const fetched = answering([{ status: 200, body: { events: [], done: true } }]);
  vi.stubGlobal("fetch", fetched);
  await staged([{ jobId: null, kind: KIND, subject: "drawing-1", evidence: EVIDENCE }]);

  expect(statusOf(), "AC-3: work a seam answered was already done").toBe("succeeded");
  expect(timingText(), "AC-3: nothing timed it, so nothing is shown").toBe("");
  expect(within(step()).queryAllByTestId(TESTIDS.skeleton), "AC-3: a settled step waits for nothing").toEqual([]);
  expect(FakeEventSource.instances.length, "AC-3: no stream is opened for a job that has no id").toBe(0);
  expect(fetched.mock.calls.length, "AC-3: and no poll either").toBe(0);
});

test("AC-3: with no EventSource the watch polls the route until the body says done", async () => {
  vi.useFakeTimers();
  expectNoEventSource();
  const fetched = answering([
    { status: 200, body: { events: [frame("started")], done: false } },
    { status: 200, body: { events: [frame("succeeded")], done: true } },
  ]);
  vi.stubGlobal("fetch", fetched);
  const { format } = await staged();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(statusOf(), "AC-3: the first snapshot is read").toBe("running");

  const asked = pollsFor(fetched, JOB_ID);
  expect(asked.length, "AC-3: the poll leg is chosen when the stream cannot be").toBe(1);
  const [url, init] = asked[0] as [string, RequestInit | undefined];
  const polled = new URL(String(url), "http://127.0.0.1");
  expect(polled.pathname).toBe("/api/events");
  expect(polled.searchParams.get("jobId")).toBe(JOB_ID);
  expect(polled.searchParams.get("transport"), "AC-3: the fallback names its transport").toBe("poll");
  expect(init?.cache, "AC-3: a snapshot is never read from a cache").toBe("no-store");

  await act(async () => {
    await vi.advanceTimersByTimeAsync(WELL_PAST_ANY_INTERVAL_MS);
  });
  expect(statusOf()).toBe("succeeded");
  expect(timingText()).toBe(format.seconds(ELAPSED_MS));
  const afterDone = pollsFor(fetched, JOB_ID).length;

  await act(async () => {
    await vi.advanceTimersByTimeAsync(WELL_PAST_ANY_INTERVAL_MS);
  });
  expect(pollsFor(fetched, JOB_ID).length, "AC-3: a job the body called done is asked about no more").toBe(afterDone);
});

/** The two ways the transport can be gone: the route says nothing answers to the id, or it does not answer at all. */
const LOSS_CASES: readonly { name: string; queue: readonly (PollAnswer | "reject")[] }[] = [
  {
    name: "a 404",
    queue: [
      { status: 200, body: { events: [frame("started")], done: false } },
      { status: 404, body: { events: [], done: false } },
    ],
  },
  {
    name: "a rejection",
    queue: [{ status: 200, body: { events: [frame("started")], done: false } }, "reject"],
  },
];

test.each(LOSS_CASES)("AC-3: $name leaves the last status standing and says live progress stopped arriving", async ({ queue }) => {
  vi.useFakeTimers();
  expectNoEventSource();
  const table = await stringsTable();
  const fetched = answering([...queue]);
  vi.stubGlobal("fetch", fetched);
  await staged();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(statusOf()).toBe("running");

  await act(async () => {
    await vi.advanceTimersByTimeAsync(WELL_PAST_ANY_INTERVAL_MS);
  });
  const afterLoss = pollsFor(fetched, JOB_ID).length;
  expect(statusOf(), "AC-3: the last known status stands — the transport failed, not the job").toBe("running");

  const lost = screen.getByTestId(TESTIDS.transportLost);
  expect(lost.getAttribute("role"), "AC-3: the reading announces itself").toBe("status");
  expect((lost.textContent ?? "").trim()).toBe(stringOf(table, "job_timeline_transport_lost"));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(WELL_PAST_ANY_INTERVAL_MS);
  });
  expect(pollsFor(fetched, JOB_ID).length, "AC-3: a lost transport schedules no further poll").toBe(afterLoss);
});

test("AC-3: a stream that errors before a terminal frame falls back to the poll", async () => {
  vi.useFakeTimers();
  installEventSource();
  const fetched = answering([{ status: 200, body: { events: [frame("succeeded")], done: true } }]);
  vi.stubGlobal("fetch", fetched);
  await staged();
  const source = FakeEventSource.only("AC-3: one watch");

  await act(async () => {
    source.emit("job", frame("started"));
    await Promise.resolve();
  });
  expect(statusOf()).toBe("running");

  await act(async () => {
    source.fail();
    await vi.advanceTimersByTimeAsync(WELL_PAST_ANY_INTERVAL_MS);
  });

  expect(pollsFor(fetched, JOB_ID).length, "AC-3: the poll stands behind the stream").toBeGreaterThan(0);
  expect(statusOf(), "AC-3: and the reading arrives over it").toBe("succeeded");
});
