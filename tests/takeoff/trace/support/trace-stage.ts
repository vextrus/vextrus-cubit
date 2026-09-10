/**
 * The stage the Trace module is judged over (inc-215-trace, AC-2).
 *
 * Two homes and nothing else: the module `src/modules/takeoff/trace`, which spells the two addresses
 * and answers the two doors, and the takeoff lane's router, which publishes them. Product modules
 * are loaded by absolute path through `productModule`, so a file the Builder has not written yet
 * fails as an assertion naming it rather than as a collection death.
 */
import { expect } from "vitest";
import { productModule } from "../../../server/support/wire";

/** The module the goal names: one reading, two doors (risk note 4). */
export const TRACE_MODULE = "src/modules/takeoff/trace/index.ts";

/** The reading the register workspace itself renders, used to READ BACK what the stage published. */
export const REGISTER_UI_SERVER_MODULE = "src/modules/takeoff/register-ui/server.ts";

/** One variable of a line's formula, as a published line carries one. */
export interface Binding {
  value: string;
  unit: string;
  basis: string;
  source: string;
}

/** What `lineEvidence` answers (AC-2's named readings). */
export interface LineEvidence {
  lineId: string;
  objectKey: string;
  kind: string;
  value: string | null;
  unit: string;
  drawingId: string | null;
  layoutName: string | null;
  sourceKeys: string[];
  formula: string;
  variables: Record<string, Binding>;
  quantityBasis: string;
  selectionBasis: string;
}

/** The scope every door of this module is asked in (the register's own `RegisterViewScope`). */
export interface TraceScope {
  tenantId: string;
  projectId: string;
}

/** The Trace module's surface, by the names the test contract fixes. */
export interface TraceSeam {
  lineEvidence: (scope: TraceScope, lineId: string) => Promise<LineEvidence | null>;
  linesCiting: (scope: TraceScope, ask: { drawingId: string; sourceKeys: readonly string[] }) => Promise<Record<string, unknown>[]>;
  citedKeysOf: (line: Record<string, unknown>) => string[];
  traceAddress: (tenantId: string, projectId: string, line: Record<string, unknown>) => string;
  originAddress: (tenantId: string, projectId: string, lineId: string | null) => string;
  LINE_PARAM: string;
}

export async function traceSeam(): Promise<TraceSeam> {
  const module = await productModule<Record<string, unknown>>(TRACE_MODULE);
  for (const name of ["lineEvidence", "linesCiting", "citedKeysOf", "traceAddress", "originAddress"]) {
    expect(typeof module[name], `${TRACE_MODULE} publishes \`${name}\` (test contract)`).toBe("function");
  }
  expect(typeof module["LINE_PARAM"], `${TRACE_MODULE} publishes \`LINE_PARAM\` (test contract)`).toBe("string");
  return module as unknown as TraceSeam;
}

/**
 * The two addresses, spelled here as the test contract states them and nowhere else — the product's
 * own `traceAddress`/`originAddress` are what these are asserted AGAINST, so one wrong spelling
 * cannot agree with itself into a pass (B-12: every literal below is public).
 */
export function traceAddressSpelling(tenantId: string, projectId: string, line: { drawingId: string; layoutName: string; sourceKeys: readonly string[]; lineId: string }, lineParam: string): string {
  const keys = line.sourceKeys.map((key) => encodeURIComponent(key)).join(",");
  return `/t/${tenantId}/p/${projectId}/viewer/${line.drawingId}/${encodeURIComponent(line.layoutName)}?s=${keys}&${lineParam}=${encodeURIComponent(line.lineId)}`;
}

export function originAddressSpelling(tenantId: string, projectId: string, lineId: string | null, lineParam: string): string {
  const base = `/t/${tenantId}/p/${projectId}/takeoff/register`;
  return lineId === null ? base : `${base}?${lineParam}=${encodeURIComponent(lineId)}`;
}

/**
 * The keys a line cites, as AC-2 states the rule: the line's own `sourceKey` first, then each
 * binding's `source` in binding order, duplicates collapsed to their first occurrence. Recomputed
 * from whatever line it is handed, so no expectation below is a transcript of today's corpus (B-19).
 */
export function citedKeysSpelling(line: { sourceKey: string; variables: Record<string, { source: string }> }): string[] {
  const seen: string[] = [];
  for (const key of [line.sourceKey, ...Object.values(line.variables).map((binding) => binding.source)]) {
    if (!seen.includes(key)) seen.push(key);
  }
  return seen;
}
