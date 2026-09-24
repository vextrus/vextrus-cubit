/**
 * The F-RCC6-BNBC read-back, as S-Ask's engine reads it (ASK-1a): `fixtures/bnbc-readback.json` is one
 * J-000 project's newest campaign, taken READ ONLY off cubit_e2e by `fixtures/bnbc-readback.sql`, with
 * the words of every entity a note or a storey-height reading cites read off the DXF J-000 ingests.
 *
 * Nothing here derives a figure: the objects and lines are the store's rows, the storey heights stand
 * by the product's own derivation (`storeyHeightStanding`), and a placement key is read off an object
 * key by the product's own grammar (`placementKeyOf`). The tests read their expectations off this
 * document too — "never constants spelled twice" (docs/design/s-ask.md §6).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { placementKeyOf } from "@/core/identity/keys";
import { storeyHeightStanding } from "@/core/levels/standing";
import type { NoteKind } from "@/core/notes/law";
import type { AskEntity, AskLevel, AskLine, AskNoteReading, AskObject, AskPlace, AskSchedule, AskScheduleRow, AskSheet, AskSources, AskTextHit } from "@/modules/takeoff/ask/law";

const HERE = dirname(fileURLToPath(import.meta.url));

type Reading = { readingKey: string; basis: string; sourceKey: string | null; valueAsWritten: string; unitAsWritten: string; canonicalMetres: string };
type Document = {
  readBack: { projectId: string; campaignId: string; setRevisionId: string; drawingIds: string[] };
  texts: { drawing: number; byKey: Record<string, string> };
  levels: { levelId: string; label: string; ordinal: number; readings: Reading[] }[];
  notes: { readingKey: string; drawingId: string; layoutName: string; kind: NoteKind; sourceKey: string; valueAsWritten: string; unitAsWritten: string; canonical: string }[];
  refusals: { code: string; objectKey: string; kind: string | null }[];
  repudiated: string[];
  schedules: { scheduleKey: string; viewKey: string; title: string; drawingId: string; cells: [number, number, string, string[]][] }[];
  objects: [string, string, string, string, string][];
  lines: [string, number, string, string | null, string, string, string[], number][];
};

/** The document, read once. */
export const READ_BACK: Document = JSON.parse(readFileSync(join(HERE, "..", "fixtures", "bnbc-readback.json"), "utf8")) as Document;

/** The one drawing F-RCC6-BNBC's revision names. */
export const BNBC_DRAWING = READ_BACK.readBack.drawingIds[0] as string;

/** The register's objects, as its one reader states them. */
export function objectsOf(document: Document = READ_BACK): AskObject[] {
  const struck = new Set(document.repudiated);
  return document.objects.map(([objectKey, klass, mark, level, role]) => ({
    objectKey,
    class: klass,
    mark,
    level,
    sourceKey: placementKeyOf(objectKey) ?? objectKey,
    role,
    corroboration: struck.has(objectKey) ? "REPUDIATED" : "NONE",
  }));
}

/** The campaign's lines, each on its object's level, with no sheet resolved (the store holds none). */
export function linesOf(document: Document = READ_BACK): AskLine[] {
  const objects = document.objects;
  const struck = new Set(document.repudiated);
  return document.lines.map(([lineId, index, kind, value, unit, coverage, omitted, drawing]) => {
    const object = objects[index] as Document["objects"][number];
    return {
      lineId,
      objectKey: object[0],
      class: object[1],
      kind,
      level: object[3],
      value,
      unit,
      coverage,
      omitted: omitted.map((entry) => {
        const cut = entry.indexOf(":");
        return { variable: entry.slice(0, cut), code: entry.slice(cut + 1) };
      }),
      repudiated: struck.has(object[0]),
      drawingId: document.readBack.drawingIds[drawing] ?? null,
      layoutName: null,
      sheetLabel: null,
      traceKeys: [],
    };
  });
}

/** The live stack, each level's height standing by the product's own derivation (D-001). */
export function stackOf(document: Document = READ_BACK): AskLevel[] {
  return document.levels.map((level) => ({ levelId: level.levelId, label: level.label, ordinal: level.ordinal, height: storeyHeightStanding(level.readings) }));
}

/** The schedules, their first band the header (L-CAD-08). */
export function schedulesOf(document: Document = READ_BACK): AskSchedule[] {
  return document.schedules.map((schedule) => {
    const rows = new Map<number, AskScheduleRow["cells"][number][]>();
    for (const [rowIndex, columnIndex, text, sourceKeys] of schedule.cells) {
      const held = rows.get(rowIndex) ?? [];
      held.push({ columnIndex, text, sourceKeys });
      rows.set(rowIndex, held);
    }
    const bands: AskScheduleRow[] = [...rows.entries()].sort((left, right) => left[0] - right[0]).map(([rowIndex, cells]) => ({ rowIndex, cells }));
    return { scheduleKey: schedule.scheduleKey, viewKey: schedule.viewKey, title: schedule.title, drawingId: schedule.drawingId, header: bands[0], rows: bands.slice(1) };
  });
}

/** The note readings. */
export function notesOf(document: Document = READ_BACK): AskNoteReading[] {
  return document.notes.map((note) => ({ ...note }));
}

/** The words of an entity the readings cite, on the drawing they were read off; no sheet resolved. */
export function entityAtOf(document: Document = READ_BACK): (drawingId: string | null, key: string) => AskEntity | null {
  const drawingId = document.readBack.drawingIds[document.texts.drawing] as string;
  return (asked, key) => {
    if (asked !== null && asked !== drawingId) return null;
    const text = document.texts.byKey[key];
    return text === undefined ? null : { drawingId, text, layoutName: null, sheetLabel: null };
  };
}

/** The sources, whole, as the server would hand them — with any part a test stages put in its place. */
export function readBackSources(overrides: Partial<AskSources> = {}): AskSources {
  return {
    campaign: { campaignId: READ_BACK.readBack.campaignId, setRevisionId: READ_BACK.readBack.setRevisionId },
    objects: objectsOf(),
    lines: linesOf(),
    refusals: READ_BACK.refusals,
    stack: stackOf(),
    notes: notesOf(),
    schedules: schedulesOf(),
    sheets: [] as AskSheet[],
    memberAt: (): AskPlace | null => null,
    entityAt: entityAtOf(),
    findText: (): readonly AskTextHit[] => [],
    ...overrides,
  };
}
