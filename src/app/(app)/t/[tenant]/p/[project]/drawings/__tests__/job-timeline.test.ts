// @vitest-environment jsdom
/**
 * AC-1(a) — the job timeline's poll, beside the component it judges.
 *
 * `/api/events` answers 404 for an id no job is recorded under. The poll reads the body and never
 * the status, so an id nothing will ever answer to is asked again every interval for as long as the
 * screen is open. What the criterion asks for is the transport's own offline reading: the watch
 * stops, the step keeps the last status the log actually said, and the region says live progress
 * stopped arriving (I-89, R-UI-050).
 *
 * This file is `.ts`, not `.tsx`: tsconfig includes `src/**\/*.ts`, so `pnpm verify`'s `tsc` reads
 * it too, and elements are therefore built with `createElement` (the `s-auth.test.ts` precedent).
 *
 * Nothing here pins the interval. The criterion is "however far fake timers advance past
 * POLL_INTERVAL_MS", so the clock is run far past any interval a Decision could choose and the
 * count of calls is what is judged (B-19).
 */
import { createElement } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { JobTimeline, type TimelineJob } from "../job-timeline";

/** Far past any polling interval this screen could lawfully choose — the criterion's "however far". */
const WELL_PAST_ANY_INTERVAL_MS = 60_000;

/** The one job the timeline follows in these cases. */
const JOB_ID = "job-under-watch";
const JOB: TimelineJob = { jobId: JOB_ID, kind: "ingest", drawingId: "drawing-1" };

/** The step element, which carries the status the timeline last read (the test contract's testid). */
function step(): HTMLElement {
  const found = screen.getAllByTestId("job-timeline-step")[0];
  expect(found, "the timeline renders a step for the job it was given").toBeDefined();
  return found as HTMLElement;
}

/** How many times the transport was asked about this job, whatever else the page fetched. */
function pollsForTheJob(fetched: ReturnType<typeof vi.fn>): number {
  return fetched.mock.calls.filter((call) => String(call[0]).includes(encodeURIComponent(JOB_ID))).length;
}

/** An answer from the events route: its HTTP status, and the JSON envelope that route publishes. */
function answering(status: number, body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

beforeEach(() => {
  vi.useFakeTimers();
  // The poll leg is the one under judgement, and the component chooses it when the environment has
  // no EventSource — which is jsdom's own condition, asserted rather than assumed.
  expect(typeof (globalThis as { EventSource?: unknown }).EventSource, "jsdom publishes no EventSource, so the timeline watches by poll").not.toBe("function");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("AC-1(a): a 404 from the events route stops the poll for that job", async () => {
  // The route's own 404 envelope: an id nothing answers to carries an empty log and a sentence.
  const fetched = answering(404, { events: [], done: false, error: "no job is recorded under that id" });
  vi.stubGlobal("fetch", fetched);

  render(createElement(JobTimeline, { jobs: [JOB] }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

  const statusBeforeTheWait = step().getAttribute("data-status");
  expect(statusBeforeTheWait, "the step stands at some status the moment it mounts").not.toBeNull();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(WELL_PAST_ANY_INTERVAL_MS);
  });

  expect(pollsForTheJob(fetched), "the job is asked about exactly once: a 404 is an id nothing will ever answer to, so no further poll is scheduled").toBe(1);
  expect(step().getAttribute("data-status"), "the step keeps the last status the log actually said — a 404 is not a job's failure").toBe(statusBeforeTheWait);
  expect(step().getAttribute("data-status"), "and it is not reported as a failure of the job's own").not.toBe("failed");
});

test("AC-1(a): the region says live progress stopped arriving after the 404", async () => {
  const fetched = answering(404, { events: [], done: false, error: "no job is recorded under that id" });
  vi.stubGlobal("fetch", fetched);

  // What "lost" reads as is the timeline's own copy, read from the table the component renders from
  // rather than respelled here (R-SPINE-060, B-19).
  const { drawings } = await import("../strings");

  render(createElement(JobTimeline, { jobs: [JOB] }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(WELL_PAST_ANY_INTERVAL_MS);
  });

  expect(screen.queryByText(drawings.drawings_timeline_transport_lost), "the region says live progress stopped arriving (the reading `lost: true` renders)").not.toBeNull();
});

test("AC-1(a): a 200 answer that is not done is polled again", async () => {
  const fetched = answering(200, { events: [{ status: "running", elapsedMs: 1_200 }], done: false });
  vi.stubGlobal("fetch", fetched);

  const { drawings } = await import("../strings");

  render(createElement(JobTimeline, { jobs: [JOB] }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(WELL_PAST_ANY_INTERVAL_MS);
  });

  expect(pollsForTheJob(fetched), "a job the log is still speaking about is asked again after the interval").toBeGreaterThan(1);
  expect(step().getAttribute("data-status"), "the step reads the status the log said").toBe("running");
  expect(screen.queryByText(drawings.drawings_timeline_transport_lost), "a transport that is answering has not been lost").toBeNull();
});
