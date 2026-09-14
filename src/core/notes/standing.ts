// How a note figure stands over the readings made of it (R-TO-034, R-TO-051, L-REG-03) — the storey
// height's own rule, applied to a sentence instead of to a level.
//
// Pure and derived at read time: no column holds a "current figure", because a stored current value
// is exactly the overwrite R-TO-051 forbids, and a silently-resolved disagreement is what L-REG-03
// forbids. Readings are append-only, so "current" is not a flag on a row: a reading key is (sheet,
// kind, actor, source key) and the LATEST reading under one key is what that key says today. Every
// key's current reading then competes — they agree and the figure is AGREED at what they agree on,
// or they do not and it is SUSPENDED at no figure at all.
import type { RefusalCode } from "@/core/errors";
import { NOTE_STANDINGS, type NoteStandingName } from "./law";

/** The separator between the fields of a reading key. One character, spelled once (B-17). */
const FIELD = "|";

/** What a note reading is keyed on: the sheet it was read on, which figure, by whom, off what text. */
export type NoteReadingRef = {
  readonly drawingId: string;
  readonly layoutName: string;
  readonly kind: string;
  readonly actorId: string;
  readonly sourceKey: string;
};

/**
 * A field of a key, as it is written into one. An empty field would make two different readings
 * derive one key, and a key two readings share is not an identity (L-REG-04).
 */
function part(value: string, what: string): string {
  if (value.length === 0) throw new Error(`a note reading key has no empty ${what}: an empty field collides two readings into one key (L-REG-04)`);
  return value;
}

/**
 * The key a note reading stands under (L-REG-04: content-derived, zero minted ids), so the key a
 * preview names is the key a re-reading lands under with nothing remembered between them.
 *
 * Two readings under one key are the same person reading the same sentence twice, so the later one
 * supersedes the earlier. Two readings under different keys COMPETE — which is why the text a figure
 * was read from is part of the key: one person reading the concrete strength off the general note
 * and off the piles' note has read two things, not one thing twice (AC-2).
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

/** The three facts a standing is derived from — a caller's row is free to carry more (C-05). */
export type ReadingOfNote = {
  readonly readingKey: string;
  readonly canonical: string;
  readonly unitAsWritten: string;
};

/**
 * How one kind stands on one sheet, whole: the standing, the figure it stands at where it stands at
 * one, the code the absence is refused under, and the readings behind both. The figure is null under
 * SUSPENDED and under NONE — a note whose readings disagree states no figure (I-253).
 */
export type NoteStanding<R extends ReadingOfNote = ReadingOfNote> = {
  readonly standing: NoteStandingName;
  readonly canonical: string | null;
  readonly unitAsWritten: string | null;
  readonly code: RefusalCode | null;
  /** One reading per key: what each key says today. */
  readonly current: readonly R[];
  /** Every reading a later re-reading under the same key superseded. Superseded, never erased. */
  readonly superseded: readonly R[];
};

/** The three standings, read off the roster rather than spelled beside it (B-17). */
const [AGREED, SUSPENDED, NONE]: readonly NoteStandingName[] = NOTE_STANDINGS;

/** The code a figure two people read differently is refused under (R-TO-034). */
const NOTE_READING_CONTESTED = "NOTE_READING_CONTESTED" as RefusalCode;

/**
 * Do two readings state the same figure? Judged on the canonical and the unit it was written in:
 * `50 d` and `50 mm` are not the same figure, and converting one into the other is a rule this leaf
 * does not hold (the conversion is inc-309's, docs/design/s-schedules.md §8).
 */
function agree(left: ReadingOfNote, right: ReadingOfNote): boolean {
  return left.canonical === right.canonical && left.unitAsWritten === right.unitAsWritten;
}

/**
 * How one note figure stands, derived from every reading ever made of it (test contract:
 * `noteStanding`).
 *
 * `readings` arrive in the order they were appended — oldest first — because that order is what
 * decides which reading under a key is the current one. The keys keep their first-appearance order,
 * so a reader sees the competing readings in the order the sheet acquired them.
 */
export function noteStanding<R extends ReadingOfNote>(readings: readonly R[]): NoteStanding<R> {
  const latest = new Map<string, R>();
  const superseded: R[] = [];
  for (const reading of readings) {
    const standing = latest.get(reading.readingKey);
    if (standing !== undefined) superseded.push(standing);
    latest.set(reading.readingKey, reading);
  }
  const current = [...latest.values()];

  // Nobody has read this figure. It stands at nothing, and no refusal is owed for it: an unread note
  // is an absence the screen states, not something that was refused (L-MEA-01).
  if (current.length === 0) {
    return { standing: NONE as NoteStandingName, canonical: null, unitAsWritten: null, code: null, current: [], superseded };
  }
  // Agreement is judged among ALL the current readings: one that disagrees with the rest suspends
  // the figure rather than correcting it, because a correction that carried the day by being
  // appended later would be the silent resolution L-REG-03 forbids — a correction declares itself by
  // re-reading under its own key, which supersedes the reading it corrects (R-TO-051).
  const stands = current[0] as R;
  if (current.some((reading) => !agree(reading, stands))) {
    return { standing: SUSPENDED as NoteStandingName, canonical: null, unitAsWritten: null, code: NOTE_READING_CONTESTED, current, superseded };
  }
  return { standing: AGREED as NoteStandingName, canonical: stands.canonical, unitAsWritten: stands.unitAsWritten, code: null, current, superseded };
}
