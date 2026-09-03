/**
 * The one home of "at most once a window, per process" (ARCH-02, B-17), judged where it lives.
 *
 * Three schedules in this directory rest on it — the outage an unconfigured deployment stands in, the
 * auth tables' hygiene pass and the outbox's retention sweep — so what is proven here is the whole of
 * what they rely on: a decision taken in one synchronous step, a window measured from the last yes, a
 * stamp held on the process rather than in a module, and a way back to armed.
 *
 * Every schedule this file opens is named freshly, so a suite running beside the live ones in the same
 * process can never spend their windows.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";

import { oncePerWindow } from "./once-per-window";

const WINDOW_MS = 60_000;

/** A schedule no other caller in this process shares. */
function freshSchedule(windowMs: number = WINDOW_MS): ReturnType<typeof oncePerWindow> {
  return oncePerWindow(`probe-${randomUUID()}`, windowMs);
}

describe("a schedule answers one caller a window", () => {
  test("due is a check and a stamp in the one step, so a burst inside a window wins once", () => {
    const schedule = freshSchedule();
    const now = 1_700_000_000_000;

    expect(schedule.due(now), "the first caller of an unspent schedule is the one to do the work").toBe(true);
    const rest = [schedule.due(now), schedule.due(now), schedule.due(now), schedule.due(now)];
    expect(rest, "no later caller inside the window is told yes as well").toEqual([false, false, false, false]);
  });

  test("the window is measured from the last yes", () => {
    const schedule = freshSchedule();
    const now = 1_700_000_000_000;
    schedule.due(now);

    expect(schedule.due(now + WINDOW_MS - 1), "a moment short of the window is still inside it").toBe(false);
    expect(schedule.due(now + WINDOW_MS), "the window elapsed, the next caller is due").toBe(true);
    expect(schedule.due(now + WINDOW_MS + 1), "and that yes started the next window").toBe(false);
  });

  test("reset arms the schedule again", () => {
    const schedule = freshSchedule();
    const now = 1_700_000_000_000;
    schedule.due(now);
    expect(schedule.due(now), "spent").toBe(false);

    schedule.reset();

    expect(schedule.due(now), "a schedule that was reset is due at the very same instant").toBe(true);
  });
});

describe("a schedule is the process's, not a module instance's", () => {
  test("two handles of one name share the stamp; two names do not", () => {
    const name = `probe-${randomUUID()}`;
    const first = oncePerWindow(name, WINDOW_MS);
    const second = oncePerWindow(name, WINDOW_MS);
    const other = freshSchedule();
    const now = 1_700_000_000_000;

    expect(first.due(now), "the first handle takes the window").toBe(true);
    expect(second.due(now), "a second handle of the same name reads the same stamp").toBe(false);
    expect(other.due(now), "a differently named schedule keeps its own window").toBe(true);

    second.reset();

    expect(first.due(now), "and either handle can arm the one schedule again").toBe(true);
  });

  test("one name cannot be opened on two windows", () => {
    const name = `probe-${randomUUID()}`;
    oncePerWindow(name, WINDOW_MS);

    expect(
      () => oncePerWindow(name, WINDOW_MS * 2),
      "sharing a stamp while enforcing two periods is two schedules under one name, and it is refused where it is made",
    ).toThrow(String(WINDOW_MS));
  });
});
