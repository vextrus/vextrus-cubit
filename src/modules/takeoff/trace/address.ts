// The two addresses the Trace spells, and the reading of what a line cites that composes one of them
// (R-UI-022, X-2). One home for both (B-17): the register composes the viewer's address and the
// viewer composes the register's, and neither screen holds a second spelling of the other's route.
//
// This file is deliberately free of the store: both screens that spell an address are browser
// components, and a module they import must carry no database with it into their bundle. The doors
// that read the store stand beside it in `./index.ts`, which re-publishes everything here.
import type { QuantityBasis } from "@/core/offers/law";

/** The query the origin row travels under, on both addresses (test contract, s-takeoff-register §7). */
export const LINE_PARAM = "line";

/** The query the viewer's selection travels under — `selection.ts`'s own name for it (R-UI-031). */
const SELECTION_PARAM = "s";

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

/** What a traced line answers: the sheet, the cited keys, the formula and its live variables. */
export type LineEvidence = {
  readonly lineId: string;
  readonly objectKey: string;
  readonly kind: string;
  readonly value: string | null;
  readonly unit: string;
  readonly drawingId: string;
  readonly layoutName: string;
  /** The entities the Trace flies to, in cited order (`citedKeysOf`). */
  readonly sourceKeys: readonly string[];
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
  readonly sourceKeys?: unknown;
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

/**
 * The viewer, at the entities one line cites, with the row it was followed from (test contract).
 *
 * There is no `v`: the absence of a stated camera is what makes the viewer fly to what the address
 * named rather than sit where the link's author was standing (s-viewer-inspector I-85).
 */
export function traceAddress(tenantId: string, projectId: string, line: AddressableLine): string {
  const stated = line.sourceKeys;
  const keys = Array.isArray(stated) ? (stated as readonly unknown[]).map(String) : citedKeysOf(line);
  const selection = keys.map((key) => encodeURIComponent(key)).join(",");
  const sheet = `${String(line.drawingId)}/${encodeURIComponent(String(line.layoutName))}`;
  return `/t/${tenantId}/p/${projectId}/viewer/${sheet}?${SELECTION_PARAM}=${selection}&${LINE_PARAM}=${encodeURIComponent(String(line.lineId))}`;
}

/**
 * The register, at the row a Trace was followed from — and the bare register path where none is
 * named, which is the one home of this screen's own address (`registerRoute`).
 */
export function originAddress(tenantId: string, projectId: string, lineId: string | null): string {
  const base = `/t/${tenantId}/p/${projectId}/takeoff/register`;
  return lineId === null ? base : `${base}?${LINE_PARAM}=${encodeURIComponent(lineId)}`;
}
