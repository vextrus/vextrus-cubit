// How a note reading is keyed, and how a kind stands over the readings made of it (R-TO-034,
// R-TO-051, L-REG-03).
//
// Pure and derived at read time, exactly as a storey height is (`../levels/standing.ts`): no column
// holds a "current figure", because a stored current value is the overwrite R-TO-051 forbids and a
// silently-resolved disagreement is what L-REG-03 forbids.
//
// Readings are append-only, so "current" is not a flag on a row. A reading key is (sheet, kind,
// actor, source), and the LATEST reading under one key is what that key says today — an earlier one
// under the same key is superseded by the re-reading, which is the only thing that clears a contest.
// Every key's current reading then competes: they agree and the kind is AGREED at what they agree
// on, or they do not and it is SUSPENDED with no figure at all.
import { NOTE_STANDING_ABSENCE, type NoteContestedCode, type NoteKind, type NoteStandingName } from "./law";

/** The separator between the fields of a reading key. One character, spelled once (B-17). */
const FIELD = "|";

/** What a note reading is keyed on: which sheet, which figure, who read it, and off which text. */
export type NoteReadingRef = {
  readonly drawingId: string;
  readonly layoutName: string;
  readonly kind: NoteKind;
  readonly actorId: string;
  readonly sourceKey: string;
};

/** The two facts a standing is derived from — a caller's row is free to carry more (C-05). */
export type ReadingOfNote = {
  readonly readingKey: string;
  readonly canonical: string;
  readonly unitAsWritten: string;
};

/**
 * How one kind stands, whole: the standing, the figure it stands at where it stands at one, the code
 * a reader is shown the absence under, and the readings behind both. The figure is null under
 * SUSPENDED and under NONE — a note two people read differently states no figure (L-REG-03).
 */
export type NoteStanding<R extends ReadingOfNote = ReadingOfNote> = {
  readonly standing: NoteStandingName;
  readonly canonical: string | null;
  readonly unitAsWritten: string | null;
  readonly code: NoteContestedCode | null;
  /** One reading per key: what each key says today. */
  readonly current: readonly R[];
  /** Every reading a later re-reading under the same key superseded. Superseded, never erased. */
  readonly superseded: readonly R[];
};

/** The code a kind whose current readings disagree is refused under, off the register (Q-07). */
const CONTESTED = NOTE_STANDING_ABSENCE.SUSPENDED as NoteContestedCode;

/**
 * A field of a key, as it is written into one. An empty field would make two different readings
 * derive one key, and a key two readings share is not an identity (L-REG-04).
 */
function part(value: string, what: string): string {
  if (value.length === 0) throw new Error(`a note reading key has no empty ${what}: an empty field collides two readings into one key (L-REG-04)`);
  return value;
}

/**
 * The key a note reading stands under: (drawing, layout, kind, actor, source key).
 *
 * Two readings under one key are the same person reading the same figure off the same text twice, so
 * the later supersedes the earlier. Two readings under different keys COMPETE, and where they
 * disagree the kind is suspended rather than silently resolved (L-REG-03).
 */
export function noteReadingKey(of: NoteReadingRef): string {
  return [
    `note:${part(of.drawingId, "drawing id")}`,
    part(of.layoutName, "layout name"),
    part(of.kind, "note kind"),
    part(of.actorId, "actor id"),
    part(of.sourceKey, "source key"),
  ].join(FIELD);
}

/** Do two readings say the same figure? Judged on the canonical figure and the unit it was read in. */
function agree(left: ReadingOfNote, right: ReadingOfNote): boolean {
  return left.canonical === right.canonical && left.unitAsWritten === right.unitAsWritten;
}

/**
 * How one kind stands, derived from every reading ever made of it on one sheet.
 *
 * `readings` arrive in the order they were appended — oldest first — because that order is what
 * decides which reading under a key is the current one. The keys keep their first-appearance order,
 * so a reader sees the competing readings in the order the sheet acquired them.
 */
export function noteStanding<R extends ReadingOfNote>(readings: readonly R[]): NoteStanding<R> {
  const { current, superseded } = currentOf(readings);
  return standingOver(current, superseded);
}

/** Each key's latest reading, and every reading a later one under the same key superseded. */
function currentOf<R extends ReadingOfNote>(readings: readonly R[]): { readonly current: R[]; readonly superseded: R[] } {
  const latest = new Map<string, R>();
  const superseded: R[] = [];
  for (const reading of readings) {
    const standing = latest.get(reading.readingKey);
    if (standing !== undefined) superseded.push(standing);
    latest.set(reading.readingKey, reading);
  }
  return { current: [...latest.values()], superseded };
}

/** A reading as a scoped standing reads one: the two facts, and the class its note scoped it to. */
export type ScopedReadingOfNote = ReadingOfNote & { readonly scopeClass: string | null };

/**
 * How one kind stands in each SCOPE its readings were made under (Interpretation I-652): the
 * readings scoped to one element class compete among themselves, and the unscoped ones among
 * themselves. `f'c = 3000 psi (BORED PILES)` beside `f'c = 3500 psi` is two figures for two scopes,
 * not a disagreement — and two unscoped readings that differ still suspend exactly as before.
 *
 * Supersession is judged over EVERY reading first, whatever its scope: a re-reading under the same key
 * that scopes the figure differently supersedes the earlier reading in the scope it left, so a note
 * first read unscoped and then read again as the piles' leaves no unscoped figure behind (R-TO-051).
 * The map's keys keep their first-appearance order among the current readings; `null` is unscoped.
 */
export function noteStandingsByScope<R extends ScopedReadingOfNote>(readings: readonly R[]): Map<string | null, NoteStanding<R>> {
  const { current, superseded } = currentOf(readings);
  const scopes = new Map<string | null, R[]>();
  for (const reading of current) scopes.set(reading.scopeClass, [...(scopes.get(reading.scopeClass) ?? []), reading]);
  const standings = new Map<string | null, NoteStanding<R>>();
  for (const [scope, held] of scopes) {
    standings.set(
      scope,
      standingOver(
        held,
        superseded.filter((reading) => reading.scopeClass === scope),
      ),
    );
  }
  return standings;
}

/** How one kind stands over the readings current in one scope. */
function standingOver<R extends ReadingOfNote>(current: readonly R[], superseded: readonly R[]): NoteStanding<R> {
  if (current.length === 0) return { standing: "NONE", canonical: null, unitAsWritten: null, code: null, current: [], superseded: [...superseded] };

  // Agreement is judged among ALL the current readings: one that disagrees with the rest suspends
  // the figure rather than correcting it, because a correction that carried the day by being
  // appended later would be the silent resolution L-REG-03 forbids — a correction declares itself by
  // re-reading under its own key, which supersedes the reading it corrects.
  const stands = current[0] as R;
  if (current.some((reading) => !agree(reading, stands))) {
    return { standing: "SUSPENDED", canonical: null, unitAsWritten: null, code: CONTESTED, current: [...current], superseded: [...superseded] };
  }
  return { standing: "AGREED", canonical: stands.canonical, unitAsWritten: stands.unitAsWritten, code: null, current: [...current], superseded: [...superseded] };
}
