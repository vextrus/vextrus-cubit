/**
 * The document zone's wall-clock parts, beside the seam that owns them (L-FMT-01, SEAM-FORMAT).
 *
 * `formatDate` takes parts because a day is the reader's day, and a screen holding an instant holds
 * a moment in no zone at all. The conversion between the two is one question, and it belongs here
 * rather than as an offset spelled beside whichever screen happens to have a `Date` in its hand.
 *
 * The instants below are chosen for the hours the conversion is wrong on a UTC-clocked host: the six
 * hours after midnight in Dhaka are still the previous day in UTC, so an act committed at half past
 * midnight Dhaka time renders on the wrong day if the host's zone is read. Everything is compared as
 * plain numbers — the lint rule that makes this file's subject the tree's sole locale caller binds a
 * suite too, so nothing here formats anything.
 */
import { expect, test } from "vitest";
import { dhakaDateParts, formatDate } from "../format";

/** An instant, spelled as the UTC moment it is, so no host zone can move it. */
const at = (iso: string): Date => new Date(iso);

test("the six hours after midnight in Dhaka are already the next day", () => {
  // 18:30 UTC on the first is 00:30 on the second in a zone six hours ahead.
  expect(dhakaDateParts(at("2026-01-01T18:30:00Z"))).toEqual({ year: 2026, month: 1, day: 2 });
});

test("an instant still inside the Dhaka day keeps that day", () => {
  expect(dhakaDateParts(at("2026-01-01T17:59:59Z"))).toEqual({ year: 2026, month: 1, day: 1 });
});

test("the roll carries the month and the year with it", () => {
  expect(dhakaDateParts(at("2025-12-31T18:00:00Z")), "the last evening of the year in UTC is New Year's Day in Dhaka").toEqual({ year: 2026, month: 1, day: 1 });
  expect(dhakaDateParts(at("2026-02-28T18:00:00Z")), "and the month rolls on the same boundary").toEqual({ year: 2026, month: 3, day: 1 });
});

test("the zone keeps no daylight saving, so midsummer converts exactly as midwinter does", () => {
  expect(dhakaDateParts(at("2026-07-01T18:00:00Z"))).toEqual({ year: 2026, month: 7, day: 2 });
  expect(dhakaDateParts(at("2026-07-01T17:00:00Z"))).toEqual({ year: 2026, month: 7, day: 1 });
});

test("the parts are what the date seam renders a document day from", () => {
  expect(formatDate(dhakaDateParts(at("2026-01-01T18:30:00Z"))), "the seam's two halves compose: an instant in, a document day out").toBe("02 Jan 2026");
});
