// Which SHEET of a record a key stands on — the one home of that question (R-TO-021, L-CAD-05,
// R-UI-022, B-17).
//
// A record is one drawing file and may carry many paper layouts. An entity is drawn in exactly one
// space; a paper sheet shows model space through its windows, so a model-space entity stands on the
// sheet whose window frames it ("a viewport frames what is drawn", L-CAD-05) rather than on the model
// sheet the draughtsman merely kept it in. The sheet index counts a sheet's views by it, the register
// names the sheet a line stands on by it, the Trace opens that sheet at the member by it, and the
// coverage residue can place a sighting by it — so it lives in core, where every one of those
// readers may reach it (ARCH-01).
//
// Pure: every reading below is of an artifact and of rows a caller has already read. Nothing here
// opens a store or a file, so the reading is the same wherever it is asked.
import type { EntityGraph } from "../entitygraph/schema";
import { readCitedKey } from "../identity/keys";
import { readTitleBlock } from "./grammar";
import { modelBoxOf, projectable, type Box } from "./windows";

export { modelBoxOf, projectable, type Box, type ViewportRecord } from "./windows";

/** The layout kind model space stands under, as the artifact's own inventory spells it (L-CAD-05). */
const MODEL = "model";

/** As far as this reading looks at a sheet: its layout's name, and which space that layout is. */
export type SheetOfRecord = { readonly layoutName: string; readonly kind: string };

/**
 * What a record's geometry says about where its entities are shown: one window per projectable
 * viewport — the sheet it is drawn on and the piece of model space it frames — and where each
 * model-space entity stands (the mean of its points).
 */
export type RecordFrames = {
  readonly windows: readonly { readonly layoutName: string; readonly model: Box }[];
  readonly standing: ReadonlyMap<string, readonly [number, number]>;
};

/** A record whose frames nobody read: every key of it stands where it was drawn. */
export const NO_FRAMES: RecordFrames = Object.freeze({ windows: Object.freeze([]), standing: new Map<string, readonly [number, number]>() });

/** The sheets a record holds, in the inventory's own order. */
export function sheetsOfGraph(graph: EntityGraph): SheetOfRecord[] {
  return graph.layouts.map((layout) => ({ layoutName: layout.name, kind: layout.kind }));
}

/** The name the record's model sheet goes by, as its own inventory spells it — or none. */
export function modelSheetOf(sheets: readonly SheetOfRecord[]): string | null {
  return sheets.find((sheet) => sheet.kind === MODEL)?.layoutName ?? null;
}

// A graph is read once per content hash and kept (`artifactAt`), so what is derived from it is kept
// beside it for exactly as long: a register of a thousand lines asks the same record a thousand
// questions, and each would otherwise walk every entity of the drawing again.
const spacesMemo = new WeakMap<EntityGraph, Map<string, string>>();
const framesMemo = new WeakMap<EntityGraph, RecordFrames>();
const labelsMemo = new WeakMap<EntityGraph, Map<string, string | null>>();

/** Where every entity of a record was drawn, by its own key: the artifact's `space` (L-CAD-05). */
export function spacesOfGraph(graph: EntityGraph): ReadonlyMap<string, string> {
  const kept = spacesMemo.get(graph);
  if (kept !== undefined) return kept;
  const spaces = new Map(graph.entities.map((entity) => [entity.key, entity.space]));
  spacesMemo.set(graph, spaces);
  return spaces;
}

/**
 * The windows a record's paper layouts open onto model space, and where each model-space entity
 * stands: what tells a key drawn IN model space which sheet actually shows it (L-CAD-05).
 */
export function framesOfGraph(graph: EntityGraph): RecordFrames {
  const kept = framesMemo.get(graph);
  if (kept !== undefined) return kept;
  const modelSpace = modelSheetOf(sheetsOfGraph(graph));
  const windows = graph.layouts.flatMap((layout) =>
    layout.kind === MODEL ? [] : (layout.viewports ?? []).filter(projectable).map((viewport) => ({ layoutName: layout.name, model: modelBoxOf(viewport) })),
  );
  const standing = new Map<string, readonly [number, number]>();
  for (const entity of graph.entities) {
    const points = entity.points ?? [];
    if (entity.space !== modelSpace || points.length === 0) continue;
    const summed = points.reduce<[number, number]>((held, point) => [held[0] + point[0], held[1] + point[1]], [0, 0]);
    standing.set(entity.key, [summed[0] / points.length, summed[1] / points.length]);
  }
  const frames: RecordFrames = { windows, standing };
  framesMemo.set(graph, frames);
  return frames;
}

/**
 * The layout one key stands on — generalised from the view's own reading, which it still is.
 *
 * A key drawn on a PAPER layout stands on that sheet: it was drawn there. A key drawn in MODEL space
 * stands on the sheet whose windows show it; where windows of two DIFFERENT sheets show it, the record
 * does not say which sheet it is drawn for, so neither does this — and it stays on the model sheet,
 * which is where it was found. Two windows of ONE sheet showing it still say which sheet that is.
 *
 * A key the artifact does not name — and no key at all, which is a view no caption anchors and so the
 * whole of the space it was read in — stands on the model sheet, rather than on every sheet of the
 * record at once (R-UI-050). A record with no model sheet answers none.
 */
export function sheetOfKey(key: string | null | undefined, spaces: ReadonlyMap<string, string>, sheets: readonly SheetOfRecord[], frames: RecordFrames): string | null {
  const modelSheet = modelSheetOf(sheets);
  if (key === null || key === undefined) return modelSheet;

  const space = spaces.get(key);
  if (space === undefined) return modelSheet;
  if (space !== modelSheet) return space;

  const at = frames.standing.get(key);
  if (at === undefined) return space;
  const showing = [...new Set(frames.windows.filter((window) => inside(window.model, at)).map((window) => window.layoutName))];
  return showing.length === 1 ? (showing[0] as string) : space;
}

/**
 * Whether one key stands on one sheet: drawn on it, or drawn in model space where a window of it
 * shows it. What a sheet's viewer holds is exactly this — a paper sheet's picture carries the model
 * entities its windows frame, each named by its own key (viewer.md I-290) — so a key this answers
 * true for is one the viewer can select and fly to on that sheet.
 */
export function standsOn(key: string, layoutName: string, spaces: ReadonlyMap<string, string>, sheets: readonly SheetOfRecord[], frames: RecordFrames): boolean {
  const space = spaces.get(key);
  if (space === undefined) return false;
  if (space === layoutName) return true;
  if (space !== modelSheetOf(sheets)) return false;
  const at = frames.standing.get(key);
  return at !== undefined && frames.windows.some((window) => window.layoutName === layoutName && inside(window.model, at));
}

/**
 * How a reader names a sheet: the number its title block states (`S-10`), else the layout's own
 * name. Model space is no sheet with a number and answers null — the screen says "model space" in
 * words rather than printing the extractor's name for it (I-179, R-UI-082).
 */
export function sheetLabelOf(graph: EntityGraph, layoutName: string): string | null {
  const held = labelsMemo.get(graph) ?? new Map<string, string | null>();
  labelsMemo.set(graph, held);
  if (held.has(layoutName)) return held.get(layoutName) ?? null;
  // A layout the inventory does not list is still a sheet by its name (a space entities were drawn
  // in): only the one the inventory calls model space goes without a number.
  const layout = graph.layouts.find((entry) => entry.name === layoutName);
  const label = layout?.kind === MODEL ? null : (readTitleBlock(graph, layoutName).number ?? layoutName);
  held.set(layoutName, label);
  return label;
}

/* ----------------------------------------------------------------- the Trace, key by key */

/** The two entities a placement was read off, as the placement stage stored them (L-CAD-03). */
export type MemberKeys = { readonly outlineKey: string; readonly markKey: string };

/**
 * Everything a record says about where its keys stand: its sheets, where each entity was drawn, the
 * windows, and the two entities each of its placements was read off.
 */
export type RecordStanding = {
  readonly sheets: readonly SheetOfRecord[];
  readonly spaces: ReadonlyMap<string, string>;
  readonly frames: RecordFrames;
  readonly members: ReadonlyMap<string, MemberKeys>;
};

/** A record's standing, read off its artifact and the placements of the same record. */
export function standingOfGraph(graph: EntityGraph, members: ReadonlyMap<string, MemberKeys>): RecordStanding {
  return { sheets: sheetsOfGraph(graph), spaces: spacesOfGraph(graph), frames: framesOfGraph(graph), members };
}

/** What a line cites, as the Trace is asked about it: the view it was read in, then each binding's source. */
export type Citations = { readonly viewKey: string; readonly sources: readonly string[] };

/** What the Trace makes of a line's citations (I-421). */
export type TracedCitations = {
  /** The sheet the Trace opens: the member's, else the view's — or none where the record says nothing. */
  readonly layoutName: string | null;
  /**
   * The keys the Trace selects and flies to, every one standing on `layoutName`: the member's outline
   * and mark where a placement resolves, else the entities the line cites on that sheet. Never a view,
   * an edition clause or an act, which are no entity of a drawing.
   */
  readonly flyTo: readonly string[];
  /**
   * Every entity the line cites, resolved: the member's two keys and every source key of its bindings,
   * wherever they stand. What the other direction (X-2) meets a held selection against.
   */
  readonly entities: readonly string[];
  /** The sheet each cited key stands on, by the key as cited — null for one that stands on none. */
  readonly sheets: Readonly<Record<string, string | null>>;
};

/** Nothing resolved: a line whose record could not be read names no sheet and flies to nothing. */
const UNTRACED: Omit<TracedCitations, "entities" | "sheets"> = { layoutName: null, flyTo: [] };

/**
 * The Trace of one line, over the record its revision pinned (I-421). Every scheme a line cites is
 * read by the grammar that minted it (`readCitedKey`):
 * - a PLACEMENT key, and a bar set `<instanceKey>#bars`, name the member — resolved to the outline and
 *   the mark the placement was read off;
 * - a SOURCE key is its own entity, on its own sheet;
 * - a VIEW key names the region the line was read in, which decides the sheet but is never flown to;
 * - an EDITION or ACT key stands on no sheet at all.
 *
 * The sheet is the member's: the view's own sheet where its windows show every key of the member (so
 * a column opens on the layout plan that placed it, however many other sheets frame the same model
 * region), else the sheet the outline itself stands on. A line whose member no placement resolves
 * opens on the view's sheet and flies to the entities it cites there. What stands on another sheet
 * is not selected here — a key on no sheet in view would only fill the "not on this sheet" cell —
 * and is answered its own sheet instead, for the reader to follow (`sheets`).
 */
export function traceCitations(cited: Citations, standing: RecordStanding | null): TracedCitations {
  const keys = [...new Set([cited.viewKey, ...cited.sources].filter((key) => key.length > 0))];
  const read = keys.map((key) => readCitedKey(key));

  const members: string[] = [];
  const sources: string[] = [];
  for (const one of read) {
    if (one.scheme === "placement" || one.scheme === "bars") {
      const member = standing?.members.get(one.placementKey);
      if (member !== undefined) for (const key of [member.outlineKey, member.markKey]) if (!members.includes(key)) members.push(key);
    } else if (one.scheme === "source" && !sources.includes(one.key)) {
      sources.push(one.key);
    }
  }
  const entities = [...members, ...sources.filter((key) => !members.includes(key))];

  if (standing === null) return { ...UNTRACED, entities, sheets: Object.fromEntries(keys.map((key) => [key, null])) };
  const { spaces, sheets: records, frames } = standing;
  const on = (key: string): string | null => (spaces.has(key) ? sheetOfKey(key, spaces, records, frames) : null);

  const view = read.find((one) => one.scheme === "view");
  const viewSheet = view === undefined ? null : sheetOfKey(view.anchor, spaces, records, frames);
  const drawn = members.filter((key) => spaces.has(key));

  let layoutName: string | null;
  let candidates: readonly string[];
  if (drawn.length > 0) {
    const onView = viewSheet !== null && drawn.every((key) => standsOn(key, viewSheet, spaces, records, frames));
    layoutName = onView ? viewSheet : on(drawn[0] as string);
    candidates = drawn;
  } else {
    layoutName = viewSheet ?? modelSheetOf(records);
    candidates = sources;
  }
  const flyTo = layoutName === null ? [] : candidates.filter((key) => standsOn(key, layoutName as string, spaces, records, frames));

  const sheetOfCited: Record<string, string | null> = {};
  for (const one of read) {
    if (one.scheme === "view") sheetOfCited[one.key] = viewSheet;
    else if (one.scheme === "placement" || one.scheme === "bars") {
      const member = standing.members.get(one.placementKey);
      sheetOfCited[one.key] = member !== undefined && spaces.has(member.outlineKey) ? layoutName : sheetOfKey(one.anchor, spaces, records, frames);
    } else if (one.scheme === "source") sheetOfCited[one.key] = on(one.key);
    else sheetOfCited[one.key] = null;
  }
  return { layoutName, flyTo, entities, sheets: sheetOfCited };
}

/** Whether a point stands in a box, edges included — the same reading the projection frames by. */
function inside(box: Box, at: readonly [number, number]): boolean {
  return at[0] >= box[0] && at[0] <= box[2] && at[1] >= box[1] && at[1] <= box[3];
}
