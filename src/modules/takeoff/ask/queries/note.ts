// NOTE (§1.2): "What concrete strength do the notes specify?" — every committed reading of that note
// kind, project-wide (N1 has not scoped them by class), each with its sheet and its clause in the
// drawing's own words. Where the readings state different values, the facts say how many and no value
// is chosen: F-RCC6-BNBC's `f'c` reads 3500 psi on S-01 and S-02 and 3000 psi on S-01 for the bored
// piles, and the answer quotes all three.
//
// A value is QUOTED only where the drawing wrote those very characters (I-401): the reading's value
// must stand in its cited entity's normalised words. A reading that respells its value (the minimum
// hook reader writes `{figure} {unit}` whatever spacing the note used) is stated as a figure instead,
// at the places it was written to — never a quote of characters the drawing did not write.
import { unitNamed } from "@/core/units/canon";
import { NOTE_KINDS, type NoteKind } from "@/core/notes/law";
import { ASK_REFUSAL_CODES, type AskNoteGroup, type AskNoteReading, type AskReading, type AskReadingRecord, type AskSources } from "../law";
import { clauseOf, figure, placesFrom, placesWritten, NO_RECORDS } from "./common";
import type { AskQuery } from "./registry-law";

/** One note reading as the answer states it: a quote where the drawing wrote it, else a figure. */
export function noteRecord(reading: AskNoteReading, sources: Pick<AskSources, "entityAt">): AskReadingRecord {
  const entity = sources.entityAt(reading.drawingId, reading.sourceKey);
  const clause = clauseOf(entity?.text ?? null);
  const quoted = clause !== null && clause.includes(reading.valueAsWritten);
  const sheetLabel = entity?.sheetLabel ?? null;
  const layoutName = entity?.layoutName ?? reading.layoutName;
  const place = { drawingId: reading.drawingId, layoutName, sheetLabel, keys: [reading.sourceKey] };
  return {
    readingKey: reading.readingKey,
    what: reading.kind,
    sourceKey: reading.sourceKey,
    drawingId: reading.drawingId,
    layoutName,
    sheetLabel,
    quote: quoted ? reading.valueAsWritten : null,
    figure: quoted ? null : figure(reading.canonical, unitNamed(reading.unitAsWritten) ?? reading.unitAsWritten, null, placesWritten(reading.canonical), [place]),
    clause,
  };
}

export const NOTE_QUERY: AskQuery = {
  intent: "NOTE",
  basis: "NOTES",
  needs: ["notes", "entities"],
  answer(reading: AskReading, sources: AskSources) {
    const kinds: readonly NoteKind[] = reading.noteKind === null ? NOTE_KINDS : [reading.noteKind];
    const groups: AskNoteGroup[] = [];
    for (const noteKind of kinds) {
      const ofKind = sources.notes.filter((note) => note.kind === noteKind);
      if (ofKind.length === 0) continue;
      const values = new Set(ofKind.map((note) => `${note.canonical} ${note.unitAsWritten}`));
      groups.push({ noteKind, values: values.size, readings: ofKind.map((note) => noteRecord(note, sources)) });
    }
    if (groups.length === 0) {
      const held = NOTE_KINDS.filter((noteKind) => sources.notes.some((note) => note.kind === noteKind));
      return { outcome: "REFUSED", code: ASK_REFUSAL_CODES.subjectUnknown, reading, held: { subject: "NOTES", class: null, items: held } };
    }
    const readings = groups.flatMap((group) => group.readings);
    return {
      statement: { intent: "NOTE", groups },
      partial: null,
      places: placesFrom(readings.map((one) => (one.layoutName === null || one.drawingId === null ? null : { drawingId: one.drawingId, layoutName: one.layoutName, sheetLabel: one.sheetLabel, keys: one.sourceKey === null ? [] : [one.sourceKey] }))),
      records: { ...NO_RECORDS, readings },
      basis: "NOTES",
    };
  },
};
