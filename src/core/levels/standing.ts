// How a level's storey height stands over the readings made of it (L-MEA-07, R-TO-051, L-REG-03).
// Pure and derived at read time: no column anywhere holds a "current height", because a stored
// current value is exactly the overwrite R-TO-051 forbids, and a silently-resolved disagreement is
// what L-REG-03 forbids.
//
// Readings are append-only, so "current" is not a flag on a row. A reading key is (level, actor,
// basis, source key), and the LATEST reading under one key is what that key says today — an earlier
// one under the same key is superseded by the re-affirmation, which is the only thing that clears a
// contest. Every key's current reading then competes: they agree and the height is AGREED at what
// they agree on, or they do not and it is SUSPENDED with no value at all.
import type { RefusalCode } from "../errors";
import { exact } from "../units/canon";
import { STOREY_HEIGHT_STANDINGS, type StoreyHeightStandingName } from "./law";

/** The two facts a standing is derived from — a caller's row is free to carry more (C-05). */
export type ReadingOfHeight = {
  readonly readingKey: string;
  readonly canonicalMetres: string;
};

/**
 * How a height stands, whole: the standing, the metres it stands at where it stands at one, the
 * code a quantity line would report the absence under, and the readings behind both. The value is
 * null under SUSPENDED and under NONE — a height whose readings disagree has no height.
 */
export type StoreyHeightStanding<R extends ReadingOfHeight = ReadingOfHeight> = {
  readonly standing: StoreyHeightStandingName;
  readonly canonicalMetres: string | null;
  readonly refusal: RefusalCode | null;
  /** One reading per key: what each key says today. */
  readonly current: readonly R[];
  /** Every reading a later re-affirmation under the same key superseded. Superseded, never erased. */
  readonly superseded: readonly R[];
};

/** The three standings, read off the roster rather than spelled beside it (B-17). */
const [AGREED, SUSPENDED, NONE]: readonly StoreyHeightStandingName[] = STOREY_HEIGHT_STANDINGS;

/** The codes a level with no height, and a level with a contested one, are reported under. */
const STOREY_HEIGHT_UNSTATED: RefusalCode = "STOREY_HEIGHT_UNSTATED";
const STOREY_HEIGHT_CONTESTED: RefusalCode = "STOREY_HEIGHT_CONTESTED";

/** Do two readings say the same height? Judged on canonical metres: "10 ft" and "3.048 m" agree. */
function agree(left: ReadingOfHeight, right: ReadingOfHeight): boolean {
  return exact(left.canonicalMetres).eq(exact(right.canonicalMetres));
}

/**
 * How one level's storey height stands, derived from every reading ever made of it.
 *
 * `readings` arrive in the order they were appended — oldest first — because that order is what
 * decides which reading under a key is the current one. The keys keep their first-appearance order
 * so a reader sees the competing readings in the order the level acquired them.
 */
export function storeyHeightStanding<R extends ReadingOfHeight>(readings: readonly R[]): StoreyHeightStanding<R> {
  const latest = new Map<string, R>();
  const superseded: R[] = [];
  for (const reading of readings) {
    const standing = latest.get(reading.readingKey);
    if (standing !== undefined) superseded.push(standing);
    latest.set(reading.readingKey, reading);
  }
  const current = [...latest.values()];

  if (current.length === 0) {
    return { standing: NONE as StoreyHeightStandingName, canonicalMetres: null, refusal: STOREY_HEIGHT_UNSTATED, current: [], superseded };
  }
  // Agreement is judged among ALL the current readings: one that disagrees with the rest suspends
  // the height rather than correcting it, because a correction that carried the day by being
  // appended later would be the silent resolution L-REG-03 forbids — a correction declares itself by
  // re-affirming under its own key, which supersedes the reading it corrects (L-MEA-07).
  const stands = current[0] as R;
  if (current.some((reading) => !agree(reading, stands))) {
    return { standing: SUSPENDED as StoreyHeightStandingName, canonicalMetres: null, refusal: STOREY_HEIGHT_CONTESTED, current, superseded };
  }
  return { standing: AGREED as StoreyHeightStandingName, canonicalMetres: stands.canonicalMetres, refusal: null, current, superseded };
}
