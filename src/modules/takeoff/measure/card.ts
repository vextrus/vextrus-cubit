// What the card at a hand measurement's closing point offers beside the act's own preview
// (docs/design/s-measure.md § 2.5, I-377, I-616, I-617): the live levels a measurement may stand on,
// the one the view's caption states, and the notes of the view that state a reading the recipe binds.
//
// Nothing here decides a measurement. The act reads its own state again at preview and at commit and
// refuses by name what cannot stand (a level the stack no longer holds, a note the drawing does not
// carry — which it demotes to ENTERED); this read only lets a person SEE and PICK what the drawing
// offers, so a default is a choice they are shown and can change, never one made silently (I-377).
//
// Its own file rather than an export of the barrel beside it: the barrel is the measure run's door
// and stays out of a screen's module graph's reach of the store (ARCH-01's spirit, `./index.ts`).
import { and, eq, forTenant, viewAssignments, type TenantTx } from "@/core/db";
import { artifactAt } from "@/core/entitygraph/artifact";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { liveLevelsOf } from "@/core/levels/store";
import { projectDrawingsOf } from "@/core/sheets";
import { appStorage } from "@/core/storage/app";
import { viewRecordsOf } from "@/core/views";
import { captionLevelsOf } from "../partition/expansion/resolve";
import { normaliseNotation, sameStorey } from "../partition/notation";
import { windowsOf } from "../viewer/projection";

/** One live level of the stack, as the card's level Select lists it. */
export type CardLevel = { readonly levelId: string; readonly label: string };

/** One note of the view that states a reading, as the card's reading Select offers it (TRANSCRIBED). */
export type CardNote = {
  readonly attribute: string;
  readonly sourceKey: string;
  /** The note's own words, normalised by the one notation reading, for a person to recognise it by. */
  readonly text: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
};

/**
 * One window a paper sheet shows model space through, with the affine map between them — the viewer's
 * own reading (`windowsOf`), so a point is carried back exactly as it was projected: paper =
 * centre + (model − viewCentre) × scale (I-620).
 */
export type CardWindow = {
  readonly via: string;
  /** The frame on the paper: minX, minY, maxX, maxY. */
  readonly paper: readonly [number, number, number, number];
  readonly centre: readonly [number, number];
  readonly viewCentre: readonly [number, number];
  readonly scale: number;
};

/** What the card offers for one view of one sheet. */
export type MeasureCard = {
  /**
   * The space the act is told the points are in (I-378, I-620): the sheet's own name on model space;
   * on a paper sheet, the model space's name — its points are carried back through `windows`, because
   * the partition partitions model space and a point on paper is off every view (I-375).
   */
  readonly space: string;
  readonly windows: readonly CardWindow[];
  readonly levels: readonly CardLevel[];
  /** The level the view's caption states through the one level reading, or null where it states one the stack does not hold, or none. */
  readonly levelId: string | null;
  readonly notes: readonly CardNote[];
};

/**
 * The words a note must carry to state a reading of a kind (I-616). A thickness written on a plan is
 * the thickness of whatever the note names — `SLAB 125 THK` is the slab's, `75 THK BLINDING UNDER` the
 * blinding's — so a figure is offered for a kind only where its note names that kind's material. A
 * kind with no entry is offered no note: its readings come from the condition alone.
 */
const KIND_WORDS: Readonly<Record<string, RegExp>> = Object.freeze({
  "pcc.blinding": /\b(?:BLINDING|P?CC)\b/,
});

/**
 * A thickness as a plan writes it: `75 THK`, `75MM THK`. Millimetres whatever the drawing's header
 * unit, as every thickness note is read (`placement/runs.ts`'s SLAB_THICKNESS_UNIT: a detailing
 * convention, not a length measured off the plan; L-MEA-01).
 */
const THICKNESS = /(?:^|[^0-9.])(\d+(?:\.\d+)?)\s*(?:MM)?\s*THK\b/;
const THICKNESS_UNIT = "mm";

/** The readings a note grammar reads, by attribute: only a thickness, today (the one rule MANUAL_RULES owes one for). */
const READERS: Readonly<Record<string, (said: string) => { value: string; unit: string } | null>> = Object.freeze({
  t: (said: string) => {
    const found = THICKNESS.exec(said);
    return found?.[1] === undefined ? null : { value: found[1], unit: THICKNESS_UNIT };
  },
});

/**
 * The notes among these texts that state a reading the recipe binds, for its kinds, in the texts'
 * own order (the artifact's, L-CAD-05). Pure.
 */
export function notesStating(texts: readonly { readonly sourceKey: string; readonly text: string }[], wanted: { readonly attributes: readonly string[]; readonly kinds: readonly string[] }): CardNote[] {
  const words = wanted.kinds.map((kind) => KIND_WORDS[kind]).filter((pattern): pattern is RegExp => pattern !== undefined);
  if (words.length === 0) return [];
  const offered: CardNote[] = [];
  for (const { sourceKey, text } of texts) {
    const said = normaliseNotation(text).replace(/\s+/gu, " ").trim().toUpperCase();
    if (!words.some((pattern) => pattern.test(said))) continue;
    for (const attribute of wanted.attributes) {
      const read = READERS[attribute]?.(said) ?? null;
      if (read !== null) offered.push({ attribute, sourceKey, text: said, valueAsWritten: read.value, unitAsWritten: read.unit });
    }
  }
  return offered;
}

/**
 * The live level a view's caption states (I-377): one level word, read by the placement law's one
 * reading of a level set and matched to the stack as storeys (`sameStorey`), ties to the lower
 * ordinal. A caption stating a set, or none, or a storey the stack does not carry, offers no default:
 * the person picks. Pure.
 */
export function captionLevelOf(caption: string, levels: readonly (CardLevel & { readonly ordinal: number })[]): string | null {
  const stated = captionLevelsOf(caption);
  if (stated.kind !== "single") return null;
  const found = levels.filter((level) => sameStorey(level.label, stated.label)).sort((left, right) => left.ordinal - right.ordinal);
  return found[0]?.levelId ?? null;
}

/**
 * The space a sheet's points are stated in, and the windows they are carried back through (I-620): a
 * paper sheet that shows model space through windows states model space; any other sheet states itself.
 * Pure over the artifact's layout inventory.
 */
export function spaceOf(graph: Pick<EntityGraph, "layouts">, sheetName: string): { space: string; windows: CardWindow[] } {
  const layout = graph.layouts.find((held) => held.name === sheetName);
  const model = graph.layouts.find((held) => held.kind === "model");
  const windows = layout?.kind === "paper" ? windowsOf(layout) : [];
  if (windows.length === 0 || model === undefined) return { space: sheetName, windows: [] };
  return {
    space: model.name,
    windows: windows.map((window) => ({ via: window.via, paper: [window.paper[0], window.paper[1], window.paper[2], window.paper[3]], centre: [window.centre[0], window.centre[1]], viewCentre: [window.viewCentre[0], window.viewCentre[1]], scale: window.scale })),
  };
}

/** The card's reads, on one transaction of the workspace. */
async function cardIn(tx: TenantTx, scope: MeasureCardScope, asked: MeasureCardAsk): Promise<MeasureCard> {
  const stack = await liveLevelsOf(tx, scope);
  const levels = stack.map((level) => ({ levelId: level.levelId, label: level.label, ordinal: level.ordinal }));
  const record = (await projectDrawingsOf(tx, scope)).find((drawing) => drawing.drawingId === asked.drawingId)?.record ?? null;
  if (record === null) return { space: asked.sheetName, windows: [], levels: levels.map(({ levelId, label }) => ({ levelId, label })), levelId: null, notes: [] };
  const view = (await viewRecordsOf(tx, { tenantId: scope.tenantId, ingestId: record.ingestId })).find((held) => held.viewKey === asked.viewKey) ?? null;
  const assigned = await tx
    .select({ entityKey: viewAssignments.entityKey })
    .from(viewAssignments)
    .where(and(eq(viewAssignments.tenantId, scope.tenantId), eq(viewAssignments.ingestId, record.ingestId), eq(viewAssignments.viewKey, asked.viewKey)));
  const members = new Set(assigned.map((row) => row.entityKey));
  const graph = await artifactAt(scope.tenantId, record.artifactSha256, appStorage(), `the card's notes on drawing ${asked.drawingId}`);
  // The notes of the view: the text entities the stored partition assigned to it (§ 2.5).
  const texts = graph.entities.filter((entity) => typeof entity.text === "string" && members.has(entity.key)).map((entity) => ({ sourceKey: entity.key, text: entity.text as string }));
  return {
    ...spaceOf(graph, asked.sheetName),
    levels: levels.map(({ levelId, label }) => ({ levelId, label })),
    levelId: view === null ? null : captionLevelOf(view.caption, levels),
    notes: notesStating(texts, asked),
  };
}

/** Which project the card is read in. */
export type MeasureCardScope = { readonly tenantId: string; readonly projectId: string };

/** What the card asks about: the drawing and view the ring stands in, and what its recipe binds. */
export type MeasureCardAsk = { readonly drawingId: string; readonly sheetName: string; readonly viewKey: string; readonly attributes: readonly string[]; readonly kinds: readonly string[] };

/** The card's offer for one view (test contract: `measureCardOf`). */
export async function measureCardOf(scope: MeasureCardScope, asked: MeasureCardAsk): Promise<MeasureCard> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => cardIn(tx, scope, asked));
}
