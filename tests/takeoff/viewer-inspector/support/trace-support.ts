/**
 * The stage the inspector's Trace and Cited-by blocks are judged over (inc-215-trace, AC-4 and AC-6).
 *
 * `InspectorPanel` lives in `src/modules`, which under ARCH-01 may not import `src/ui`: the shipped
 * `BasisChip` and `EvidenceLink` therefore arrive as CHROME, exactly as `RegisterWorkspace` is handed
 * its nine renderers (I-170), and the panel never re-implements either (B-17). This file declares
 * the props that widening adds, once, and both lanes mount through it — so the shape a held-out
 * assertion mounts is the shape the public suite beside it already publishes (C-04).
 *
 * THE PROPS THIS INCREMENT ADDS TO `InspectorPanelProps` (beside `hover`, `selection`, `missing`,
 * `onCopy`, `onReveal`, `onClear`, which are unchanged):
 *
 *   chrome: { BasisChip, EvidenceLink }   — the shipped components, injected (I-170, risk note 5)
 *   trace:  TraceBlock | null             — the line the address named, and how its reading stands
 *   cited:  CitedBlock | null             — the lines citing the held selection
 *
 * Nothing here reads product source, and no expectation is transcribed: the copy is read from the
 * product's own registry by key, and every rendered row is recomputed from the block it was given.
 */
import { render } from "@testing-library/react";
import { createElement, type FunctionComponent } from "react";
import { expect } from "vitest";
import { INSPECTOR_PANEL_MODULE, productModule } from "./inspector-support";

/** The shipped chrome the panel is handed (test contract: `basis-chip`, `evidence-link`). */
export const CHROME_BARRELS: readonly string[] = ["src/ui/primitives/core/index.ts", "src/ui/patterns/evidence-link/index.ts"];

/** The two renderers this region is given. */
export const CHROME_NAMES: readonly string[] = ["BasisChip", "EvidenceLink"];

/** One live variable of a traced line's formula, as the Trace block renders one row per binding. */
export interface TraceVariable {
  value: string;
  unit: string;
  basis: string;
  source: string;
}

/** What `lineEvidence` answers, as the block is handed it (AC-2's named readings). */
export interface TraceEvidence {
  lineId: string;
  objectKey: string;
  kind: string;
  value: string | null;
  unit: string;
  drawingId: string | null;
  layoutName: string | null;
  sourceKeys: string[];
  formula: string;
  variables: Record<string, TraceVariable>;
  quantityBasis: string;
  selectionBasis: string;
}

/**
 * The Trace block's whole state, as the screen's own read of the door leaves it: `ready` with the
 * evidence, `missing` where the project holds no line by that id (a fact, I-88's idiom), `failed`
 * where the door faulted and the block offers to read again.
 */
export interface TraceBlock {
  state: "ready" | "missing" | "failed";
  /** The line the address named — carried in every state, because the address named it in every state. */
  lineId: string;
  /** The reading, where there is one. */
  evidence: TraceEvidence | null;
  /** `originAddress(tenant, project, lineId)` — where the link back to the register goes. */
  originHref: string;
  /** What the `failed` cell's retry presses. */
  onRetry: () => void;
}

/** One line citing the held selection, as the Cited-by block renders one row per line. */
export interface CitedLine {
  lineId: string;
  objectKey: string;
  kind: string;
  value: string | null;
  unit: string;
  quantityBasis: string;
  /** `originAddress` for that line — where its own EvidenceLink goes back to. */
  href: string;
}

/** The Cited-by block: what `linesCiting` answered for the selection the panel holds. */
export interface CitedBlock {
  state: "ready" | "failed";
  lines: readonly CitedLine[];
}

/** A component of the product, as this stage mounts one. */
export type Mountable = (props: Record<string, unknown>) => unknown;

/** The shipped renderers, loaded from the barrels that publish them (B-17: never re-implemented). */
export async function chrome(): Promise<Record<string, unknown>> {
  const held: Record<string, unknown> = {};
  for (const barrel of CHROME_BARRELS) {
    const module = await productModule<Record<string, unknown>>(barrel);
    for (const [name, value] of Object.entries(module)) held[name] ??= value;
  }
  const bound: Record<string, unknown> = {};
  for (const name of CHROME_NAMES) {
    expect(typeof held[name], `the shipped \`${name}\` is published by one of ${CHROME_BARRELS.join(", ")} — the panel is handed it, never a copy (B-17, I-170)`).toBe("function");
    bound[name] = held[name];
  }
  return bound;
}

/** What a mount may be varied by. */
export interface MountOptions {
  hover?: unknown;
  selection?: readonly unknown[];
  missing?: readonly string[];
  trace?: TraceBlock | null;
  cited?: CitedBlock | null;
}

/** Mount the panel and hand back its own root (`viewer-inspector`). */
export async function mountInspector(over: MountOptions = {}): Promise<HTMLElement> {
  const module = await productModule<Record<string, unknown>>(INSPECTOR_PANEL_MODULE);
  expect(typeof module["InspectorPanel"], `${INSPECTOR_PANEL_MODULE} publishes \`InspectorPanel\``).toBe("function");
  const props = {
    hover: over.hover ?? null,
    selection: over.selection ?? [],
    missing: over.missing ?? [],
    trace: over.trace ?? null,
    cited: over.cited ?? null,
    chrome: await chrome(),
    onCopy: async (): Promise<void> => undefined,
    onReveal: (): void => undefined,
    onClear: (): void => undefined,
  };
  const { container } = render(createElement(module["InspectorPanel"] as unknown as FunctionComponent<typeof props>, props));
  const root = container.querySelector('[data-testid="viewer-inspector"]');
  expect(root, "InspectorPanel renders its root `viewer-inspector` (test contract)").not.toBeNull();
  return root as HTMLElement;
}

/* --------------------------------------------------------------------------- reading a mount */

export function all(root: HTMLElement, testId: string): HTMLElement[] {
  return [...root.querySelectorAll(`[data-testid="${testId}"]`)] as HTMLElement[];
}

export function one(root: HTMLElement, testId: string): HTMLElement {
  const found = all(root, testId);
  expect(found.length, `the panel renders exactly one \`${testId}\``).toBe(1);
  return found[0] as HTMLElement;
}

export function text(node: Element | null): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/* -------------------------------------------------------------------- the fixtures, declared once */

/** The scheme a source key of a DXF sheet carries (L-CAD-03). */
export const SCHEME = "DXF_HANDLE:";

export function keyOf(ordinal: number): string {
  return `${SCHEME}${ordinal.toString(16).toUpperCase()}`;
}

/**
 * One traced line's evidence. The three variables are read at two different keys and in two
 * different bases, so a block that spelled one row's basis or source into all three states the same
 * words for a binding that carries other ones (B-19).
 */
export function anEvidence(over: Partial<TraceEvidence> = {}): TraceEvidence {
  const sourceKey = keyOf(0x1a4);
  const variables: Record<string, TraceVariable> = {
    length: { value: "0.3", unit: "m", basis: "MEASURED", source: sourceKey },
    breadth: { value: "0.45", unit: "m", basis: "MEASURED", source: keyOf(0x2b7) },
    height: { value: "3", unit: "m", basis: "TRANSCRIBED", source: keyOf(0x3c9) },
  };
  return {
    lineId: "b1d6f0aa-0000-4000-8000-000000000001",
    objectKey: "PLAN|S-101:t:12|C1|GF",
    kind: "rcc.concrete",
    value: "0.405",
    unit: "m3",
    drawingId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    layoutName: "S-101 Plan",
    sourceKeys: [sourceKey, keyOf(0x2b7), keyOf(0x3c9)],
    formula: "length × breadth × height",
    variables,
    quantityBasis: "MEASURED",
    selectionBasis: "MEASURED",
    ...over,
  };
}

/** One cited line, as `linesCiting` answers one and the Cited-by block renders one. */
export function aCitedLine(over: Partial<CitedLine> = {}): CitedLine {
  const lineId = over.lineId ?? "b1d6f0aa-0000-4000-8000-000000000001";
  return {
    lineId,
    objectKey: "PLAN|S-101:t:12|C1|GF",
    kind: "rcc.concrete",
    value: "0.405",
    unit: "m3",
    quantityBasis: "MEASURED",
    href: originHref(lineId),
    ...over,
  };
}

/** The workspace and project the staged blocks stand in, and the register address they link back to. */
export const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const PROJECT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** `originAddress`, spelled as the test contract states it (never read from the product here). */
export function originHref(lineId: string | null): string {
  const base = `/t/${TENANT}/p/${PROJECT}/takeoff/register`;
  return lineId === null ? base : `${base}?line=${encodeURIComponent(lineId)}`;
}

/** A Trace block in one of its three states, over the evidence it was given. */
export function aTrace(over: Partial<TraceBlock> = {}): TraceBlock {
  const evidence = over.evidence === undefined ? anEvidence() : over.evidence;
  const lineId = over.lineId ?? evidence?.lineId ?? "b1d6f0aa-0000-4000-8000-000000000001";
  return { state: "ready", lineId, evidence, originHref: originHref(lineId), onRetry: (): void => undefined, ...over };
}

/** A Cited-by block over a list of lines. */
export function aCited(lines: readonly CitedLine[], state: "ready" | "failed" = "ready"): CitedBlock {
  return { state, lines };
}
