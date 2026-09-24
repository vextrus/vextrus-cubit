// The two addresses the Trace spells, and the reading of what a line cites that composes one of them
// (R-UI-022, X-2). One home for both (B-17): the register composes the viewer's address and the
// viewer composes the register's, and neither screen holds a second spelling of the other's route.
//
// This file is deliberately free of the store: both screens that spell an address are browser
// components, and a module they import must carry no database with it into their bundle. The doors
// that read the store stand beside it in `./index.ts`, which re-publishes everything here.
import { readCitedKey } from "@/core/identity/keys";
import type { QuantityBasis } from "@/core/offers/law";
// The selection's query is the viewer's own to spell (R-UI-031): its name and its lossless value are
// read from the one module that also reads them back, so a link into the sheet and the sheet itself
// can never disagree about a key (B-17, I-423).
import { SELECTION_PARAM, selectionQueryValue } from "../viewer-inspector/selection";

/** The query the origin row travels under, on both addresses (test contract, s-takeoff-register §7). */
export const LINE_PARAM = "line";

/**
 * What one variable of a line's formula was read as: the reading as the drawing wrote it, beside
 * what the canon made of it. One shape, because the register's table and the Trace's block state the
 * same binding — the register renders the pair, the Trace renders the reading (B-17).
 */
export type LineBinding = {
  readonly value: string;
  readonly unit: string;
  readonly basis: string;
  readonly source: string;
  readonly canonical: { readonly value: string; readonly unit: string };
};

/** One component a line kept with no quantity left out, by the variable and the registered code. */
export type LineOmission = {
  readonly variable: string;
  readonly code: string;
};

/**
 * The member a line was measured off, as a quantity surveyor names it: its mark and the storey it
 * stands on, read from the register object the line cites (I-552). Null where the pinned revision's
 * register holds no such object — a hand line over an outline, a placeholder — and then the Trace
 * names the line by its class and kind alone rather than by a guessed mark.
 */
export type LineMember = {
  readonly mark: string;
  /** The level's label (`GF`), or the slot the reading named where the stack holds none; "" for none. */
  readonly level: string;
};

/** What a traced line answers: the sheet, the cited keys, the formula and its live variables. */
export type LineEvidence = {
  readonly lineId: string;
  readonly objectKey: string;
  /** The class the line was measured under (`column`) — the first word of its description. */
  readonly elementClass: string;
  readonly member: LineMember | null;
  readonly kind: string;
  readonly value: string | null;
  /** What a line kept with no quantity left out (L-QTY-02) — empty wherever `value` stands. */
  readonly omitted: readonly LineOmission[];
  readonly unit: string;
  readonly drawingId: string;
  /**
   * The sheet the Trace opens — the member's, as the pinned record resolves it (I-421) — or null
   * where the record the line was measured on cannot be read, which offers no Trace at all (I-181).
   */
  readonly layoutName: string | null;
  /**
   * The entities the Trace selects and flies to, every one standing on `layoutName`: the member's
   * outline and mark where its placement resolves, else what the line cites on that sheet (I-421).
   * Named apart from what the line CITES (`citedKeysOf`, the register's `sourceKeys`): the two lists
   * differ for every line measured off a placement, and one name for both let a published field
   * change meaning under an unchanged name (I-426).
   */
  readonly traceKeys: readonly string[];
  /**
   * The sheet each key the line cites stands on, by the key as cited (`citedKeysOf`'s keys) — null
   * for one that stands on no sheet: a view is a region, an edition clause and an act are no entity.
   * What lets a reader follow a variable read on ANOTHER sheet to that sheet (the schedule cell on
   * S-11, the level note on S-25) rather than find it in the "not on this sheet" cell.
   */
  readonly sourceSheets: Readonly<Record<string, string | null>>;
  /**
   * How a reader names each sheet `layoutName` and `sourceSheets` name — the sheet's number (`S-11`)
   * as the record's title block states it (I-179) — by layout name. A sheet the record numbers
   * nowhere is absent, and is then named by its layout name.
   */
  readonly sheetLabels: Readonly<Record<string, string>>;
  readonly formula: string;
  readonly variables: Readonly<Record<string, LineBinding>>;
  readonly quantityBasis: QuantityBasis;
  readonly selectionBasis: QuantityBasis;
};

/**
 * The shape an address is composed from. Both the register's `ViewLine` and this module's own
 * `LineEvidence` satisfy it, which is why neither screen needs a second spelling of the route.
 */
export type AddressableLine = {
  readonly lineId?: unknown;
  readonly drawingId?: unknown;
  readonly layoutName?: unknown;
  /** What the Trace selects (I-421); a line that states none selects what it cites. */
  readonly traceKeys?: unknown;
  readonly sourceKey?: unknown;
  readonly variables?: unknown;
};

/**
 * The keys a line cites: its own `sourceKey` first, then each binding's `source` in binding order,
 * duplicates collapsed to their first occurrence.
 *
 * The calibration keys a view was scaled by are deliberately absent: a calibration is not an entity,
 * and a Trace that flew to one would frame the scale bar rather than the column (settled reading 2).
 */
export function citedKeysOf(line: AddressableLine): string[] {
  const cited: string[] = [];
  const add = (key: unknown): void => {
    if (typeof key === "string" && key.length > 0 && !cited.includes(key)) cited.push(key);
  };
  add(line.sourceKey);
  const variables = line.variables;
  if (typeof variables === "object" && variables !== null) {
    for (const binding of Object.values(variables as Record<string, unknown>)) {
      if (typeof binding === "object" && binding !== null) add((binding as { source?: unknown }).source);
    }
  }
  return cited;
}

/** One sheet, and the entities standing on it an address selects (R-UI-022, R-UI-031). */
export type AddressableSelection = {
  readonly drawingId: string;
  readonly layoutName: string;
  readonly sourceKeys: readonly string[];
};

/**
 * The viewer, at the entities something cites — and nothing else (test contract: `selectionAddress`).
 *
 * There is no `line`: a schedule cell and a note reading were not followed from a quantity row, and
 * an address carrying an origin nobody came from would send the reader back to a row that never
 * opened it. There is no `v` either — the absence of a stated camera is what makes the viewer fly to
 * what the address named rather than sit where the link's author was standing (s-viewer-inspector
 * I-85).
 */
export function selectionAddress(tenantId: string, projectId: string, sheet: AddressableSelection): string {
  const at = `${sheet.drawingId}/${encodeURIComponent(sheet.layoutName)}`;
  return `/t/${tenantId}/p/${projectId}/viewer/${at}?${SELECTION_PARAM}=${selectionQueryValue(sheet.sourceKeys)}`;
}

/**
 * The viewer, at the entities one line's Trace selects (`traceKeys`, I-421) — the entities it cites
 * where it states no selection — with the row it was followed from (test contract).
 *
 * Composed over `selectionAddress`, so the sheet and the selection have one spelling and this
 * function adds exactly what it is for: the row the reader came from (B-17).
 */
export function traceAddress(tenantId: string, projectId: string, line: AddressableLine): string {
  const stated = line.traceKeys;
  const keys = Array.isArray(stated) ? (stated as readonly unknown[]).map(String) : citedKeysOf(line);
  const sheet = selectionAddress(tenantId, projectId, { drawingId: String(line.drawingId), layoutName: String(line.layoutName), sourceKeys: keys });
  return `${sheet}&${LINE_PARAM}=${encodeURIComponent(String(line.lineId))}`;
}

/**
 * The register, at the row a Trace was followed from — and the bare register path where none is
 * named, which is the one home of this screen's own address (`registerRoute`).
 */
export function originAddress(tenantId: string, projectId: string, lineId: string | null): string {
  const base = `/t/${tenantId}/p/${projectId}/takeoff/register`;
  return lineId === null ? base : `${base}?${LINE_PARAM}=${encodeURIComponent(lineId)}`;
}

/** Where one key a traced line cites can be followed to: the sheet it stands on, and the address there. */
export type SourceLink = {
  /** The sheet as a reader names it — its number where the record states one, else its layout name. */
  readonly sheet: string;
  readonly href: string;
};

/**
 * Each key a traced line cites that a reader can follow, by the key as cited (I-553): a SOURCE key
 * opens the sheet it stands on with itself selected — the schedule cell on S-11, the level note on
 * S-25 — and a PLACEMENT or bar-set key opens the member's own sheet with the member selected, which
 * is what the line's Trace selects there. A view key names a region and is never flown to, and an
 * edition clause or an act stands on no sheet: neither is answered, so a row that cites one offers no
 * link rather than one that lands nowhere.
 */
export function sourceLinksOf(
  tenantId: string,
  projectId: string,
  line: Pick<LineEvidence, "drawingId" | "layoutName" | "traceKeys" | "sourceSheets" | "sheetLabels">,
): Record<string, SourceLink> {
  const links: Record<string, SourceLink> = {};
  for (const [key, sheet] of Object.entries(line.sourceSheets)) {
    if (sheet === null) continue;
    const cited = readCitedKey(key);
    let selected: readonly string[];
    if (cited.scheme === "source") selected = [cited.key];
    else if ((cited.scheme === "placement" || cited.scheme === "bars") && sheet === line.layoutName && line.traceKeys.length > 0) selected = line.traceKeys;
    else continue;
    links[key] = {
      sheet: line.sheetLabels[sheet] ?? sheet,
      href: selectionAddress(tenantId, projectId, { drawingId: line.drawingId, layoutName: sheet, sourceKeys: selected }),
    };
  }
  return links;
}
