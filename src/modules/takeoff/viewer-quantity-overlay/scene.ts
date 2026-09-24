// R-TO-015's "every published quantity's geometry paints on the sheet" and R-TO-044's legend, as pure
// values: the lines of one placement read into its figures, the placements of one sheet read into a
// legend keyed by condition, and the placements mapped through the sheet's own camera into the
// screen quantities the canvas paints.
//
// Nothing here touches a canvas, a context or the DOM, and nothing reads the store: a scene is a
// function of the overlay, the two switches and the camera, so what the sheet shows can be judged
// without drawing anything, and a frame is a redraw of this answer (PB-3).
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { ConditionColour, ConditionHatch } from "@/core/manual/law";
import { QUANTITY_BASES, weakestBasis, type QuantityBasis } from "@/core/offers/law";
import { exact, type Unit } from "@/core/units/canon";
import { screenAt } from "@/modules/takeoff/viewer-partition-overlay/scene";
import type { Camera } from "@/modules/takeoff/viewer/types";
import type {
  QuantityCondition,
  QuantityFill,
  QuantityLegend,
  QuantityLegendRow,
  QuantityOverlay,
  QuantityPlacement,
  QuantityScene,
  QuantitySum,
  QuantityToggles,
  QuantityUnmeasured,
} from "./types";

/* ------------------------------------------------------------------ conditions (I-634) */

/**
 * A rail class read as a condition: the element palette's colour it wears and the hatch that tells it
 * apart from a class sharing that colour (R-UI-060: colour is never the only channel). The chest's
 * eight colours are the element palette's (I-374), so a rail class borrows the one its member family
 * is drawn in; where two classes share a colour, the hatch differs.
 *
 * This table is the one home of "which condition does a rail's member stand under". A hand
 * measurement stands under the chest condition it was applied from (`chestCondition`); a later reader
 * of conditions extends this file, never a second table beside it (B-17).
 */
const CLASS_CONDITIONS: Readonly<Record<ElementType, { readonly colour: ConditionColour; readonly hatch: ConditionHatch }>> = Object.freeze({
  column: { colour: "column", hatch: "solid" },
  beam: { colour: "beam", hatch: "solid" },
  tie_beam: { colour: "beam", hatch: "diagonal" },
  lintel: { colour: "beam", hatch: "horizontal" },
  slab: { colour: "slab", hatch: "solid" },
  stair: { colour: "slab", hatch: "cross" },
  footing: { colour: "footing", hatch: "solid" },
  pile_cap: { colour: "footing", hatch: "diagonal" },
  pile: { colour: "footing", hatch: "dots" },
  shear_wall: { colour: "wall", hatch: "solid" },
  brick_wall: { colour: "wall", hatch: "cross" },
  opening: { colour: "opening", hatch: "solid" },
  surface: { colour: "generic", hatch: "solid" },
});

/** The condition a rail's member stands under: its class, read as one (I-634). */
export function classCondition(klass: ElementType): QuantityCondition {
  const worn = CLASS_CONDITIONS[klass];
  return { key: `class:${klass}`, source: "rail", class: klass, name: null, colour: worn.colour, hatch: worn.hatch };
}

/**
 * The condition a hand measurement stands under: the chest's own recipe, by the name the measurement
 * snapshotted. A measurement whose condition is no longer in the chest keeps its name, and wears the
 * generic colour — the name is what it was measured under, and it is never re-keyed to a class.
 */
export function chestCondition(stated: { readonly name: string; readonly class: ElementType; readonly colour: ConditionColour | null; readonly hatch: ConditionHatch | null }): QuantityCondition {
  return { key: `condition:${stated.name}`, source: "manual", class: stated.class, name: stated.name, colour: stated.colour ?? "generic", hatch: stated.hatch ?? "solid" };
}

/* ------------------------------------------------ a hand ring on the sheet it was traced on */

/** One window a paper sheet shows model space through: the model box it frames and the map onto the paper (`viewer/projection`'s `Window`). */
export type PaperWindow = {
  readonly model: readonly [number, number, number, number];
  readonly centre: readonly [number, number];
  readonly viewCentre: readonly [number, number];
  readonly scale: number;
};

/**
 * A hand measurement's rings as a paper sheet shows them (s-measure I-666): a ring traced on a
 * paper sheet is stated in model space (I-620), so it paints on that sheet through the one window
 * whose model box holds every point of its outer ring — `paper = centre + (model − viewCentre) × scale`,
 * the projection the viewer drew the sheet by. Null where no window holds the ring whole: it is not
 * shown on this sheet.
 */
export function ringsOnPaper(rings: readonly (readonly (readonly [number, number])[])[], windows: readonly PaperWindow[]): [number, number][][] | null {
  const outer = rings[0] ?? [];
  if (outer.length === 0) return null;
  const through = windows.find(({ model }) => outer.every(([x, y]) => x >= model[0] && x <= model[2] && y >= model[1] && y <= model[3]));
  if (through === undefined) return null;
  const { centre, viewCentre, scale } = through;
  return rings.map((ring) => ring.map(([x, y]) => [centre[0] + (x - viewCentre[0]) * scale, centre[1] + (y - viewCentre[1]) * scale] as [number, number]));
}

/* ------------------------------------------------------------- one placement's figures */

/** One published line, as the figures of a placement read it (the store's own columns). */
export type PlacementLine = {
  readonly kind: Kind;
  readonly coverage: string;
  readonly value: string | null;
  readonly unit: Unit;
  readonly quantityBasis: QuantityBasis;
  /** The `omitted` column as stored: `{ variable, code }` entries (L-QTY-02). */
  readonly omitted: readonly unknown[];
};

/** One queue item: a kind of the member declared excluded, by its registered cause (L-QTY-04). */
export type PlacementQueued = { readonly kind: Kind; readonly cause: string };

const COMPLETE = "COMPLETE";

/** Every `{ variable, code }` a partial line declared, read for the two strings each carries. */
function omissionsOf(stored: readonly unknown[]): { variable: string; code: string }[] {
  const held: { variable: string; code: string }[] = [];
  for (const entry of stored) {
    const variable = (entry as { variable?: unknown } | null)?.variable;
    const code = (entry as { code?: unknown } | null)?.code;
    if (typeof variable === "string" && typeof code === "string") held.push({ variable, code });
  }
  return held;
}

/** Each value once, in the order first met. */
function once<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/**
 * What one placement's lines amount to: per kind, the exact sum of its COMPLETE lines; per kind, what
 * was seen and not billed — a PARTIAL line's omissions, a queue item's cause — and the weakest basis
 * of what was measured (L-QTY-01).
 *
 * A kind with both a COMPLETE line and a partial one on the same member states both: the figure it
 * has, and that part of it was not billed. A partial line's value is null by the store's own CHECK and
 * is never added (L-QTY-02, L-QTY-07).
 */
export function figuresOf(lines: readonly PlacementLine[], queued: readonly PlacementQueued[] = []): { sums: QuantitySum[]; unmeasured: QuantityUnmeasured[]; basis: QuantityBasis | null } {
  const sums = new Map<string, { kind: Kind; unit: Unit; value: ReturnType<typeof exact>; lines: number }>();
  const unmeasured = new Map<Kind, { codes: string[]; variables: string[] }>();
  const bases: QuantityBasis[] = [];

  for (const line of lines) {
    if (line.coverage === COMPLETE && line.value !== null) {
      const at = `${line.kind}|${line.unit}`;
      const held = sums.get(at);
      if (held === undefined) sums.set(at, { kind: line.kind, unit: line.unit, value: exact(line.value), lines: 1 });
      else sums.set(at, { ...held, value: held.value.plus(exact(line.value)), lines: held.lines + 1 });
      bases.push(line.quantityBasis);
      continue;
    }
    const held = unmeasured.get(line.kind) ?? { codes: [], variables: [] };
    for (const omission of omissionsOf(line.omitted)) {
      held.codes.push(omission.code);
      held.variables.push(omission.variable);
    }
    unmeasured.set(line.kind, held);
  }
  for (const item of queued) {
    const held = unmeasured.get(item.kind) ?? { codes: [], variables: [] };
    held.codes.push(item.cause);
    unmeasured.set(item.kind, held);
  }

  return {
    sums: [...sums.values()].map((sum) => ({ kind: sum.kind, unit: sum.unit, value: sum.value.toFixed(), lines: sum.lines })),
    unmeasured: [...unmeasured.entries()].map(([kind, held]) => ({ kind, codes: once(held.codes), variables: once(held.variables) })),
    basis: bases.length === 0 ? null : weakestBasis(bases),
  };
}

/* ------------------------------------------------------------------------- the legend */

/**
 * The legend of the visible sheet (R-TO-044), keyed by condition (I-634): per condition, how many
 * of its placements carry a figure, the exact per-kind sum of those figures — measured scope, and
 * never a grand total across kinds or conditions (L-QTY-07) — and, where the switch shows the
 * unmeasured, how many carry a kind seen and not billed, with the codes and variables it was left
 * for. A condition all of whose placements were left unmeasured still has its row while the switch
 * is on: what was seen is said, not hidden.
 *
 * The rows stand in the order their conditions are first met on the sheet; the bases in the palette's
 * own order (R-UI-002), each once.
 */
export function legendOf(overlay: Pick<QuantityOverlay, "placements">, toggles: QuantityToggles): QuantityLegend {
  type Row = { condition: QuantityCondition; measured: number; totals: Map<string, { kind: Kind; unit: Unit; value: ReturnType<typeof exact>; lines: number }>; unmeasured: number; codes: string[]; variables: string[] };
  const rows = new Map<string, Row>();
  const bases = new Set<QuantityBasis>();

  for (const placement of overlay.placements) {
    const held: Row = rows.get(placement.condition.key) ?? { condition: placement.condition, measured: 0, totals: new Map(), unmeasured: 0, codes: [], variables: [] };
    if (placement.sums.length > 0) {
      held.measured += 1;
      for (const sum of placement.sums) {
        const at = `${sum.kind}|${sum.unit}`;
        const total = held.totals.get(at);
        if (total === undefined) held.totals.set(at, { kind: sum.kind, unit: sum.unit, value: exact(sum.value), lines: sum.lines });
        else held.totals.set(at, { ...total, value: total.value.plus(exact(sum.value)), lines: total.lines + sum.lines });
      }
    }
    if (placement.basis !== null) bases.add(placement.basis);
    if (placement.unmeasured.length > 0) {
      held.unmeasured += 1;
      for (const kind of placement.unmeasured) {
        held.codes.push(...kind.codes);
        held.variables.push(...kind.variables);
      }
    }
    rows.set(placement.condition.key, held);
  }

  const legendRows: QuantityLegendRow[] = [];
  for (const held of rows.values()) {
    if (held.measured === 0 && !toggles.unmeasured) continue;
    legendRows.push({
      condition: held.condition,
      measured: held.measured,
      totals: [...held.totals.values()].map((total) => ({ kind: total.kind, unit: total.unit, value: total.value.toFixed(), lines: total.lines })),
      unmeasured: toggles.unmeasured ? held.unmeasured : 0,
      codes: toggles.unmeasured ? once(held.codes) : [],
      variables: toggles.unmeasured ? once(held.variables) : [],
    });
  }
  return { rows: legendRows, bases: QUANTITY_BASES.filter((basis) => bases.has(basis)) };
}

/* -------------------------------------------------------------------------- the scene */

/** One world box as a screen rectangle: the two corners mapped, then read as an origin and a size. */
function rectOf(camera: Camera, box: QuantityPlacement["box"]): QuantityFill["rect"] {
  const [left, bottom] = screenAt(camera, box.min);
  const [right, top] = screenAt(camera, box.max);
  return { x: Math.min(left, right), y: Math.min(top, bottom), width: Math.abs(right - left), height: Math.abs(bottom - top) };
}

/**
 * The placements of this sheet, mapped onto the canvas as it stands right now.
 *
 * `quantities: false` answers nothing at all — the switch gates paint and nothing else. A placement
 * with a figure is filled in its condition's colour and wears its basis (colour and glyph); one with
 * no figure is painted only while `unmeasured` is on, hatched and never filled — it was seen and not
 * billed, and a fill would read as a quantity (L-QTY-07). A placement with both is filled and, while
 * the switch is on, hatched over.
 */
export function quantityScene(overlay: QuantityOverlay, toggles: QuantityToggles, camera: Camera): QuantityScene {
  if (!toggles.quantities) return { fills: [] };
  const fills: QuantityFill[] = [];
  for (const placement of overlay.placements) {
    const seen = placement.unmeasured.length > 0;
    if (placement.sums.length === 0 && !(seen && toggles.unmeasured)) continue;
    fills.push({
      key: placement.key,
      colour: placement.condition.colour,
      hatch: placement.condition.hatch,
      rings: placement.rings.map((ring) => ring.map((point) => screenAt(camera, point))),
      rect: rectOf(camera, placement.box),
      basis: placement.sums.length === 0 ? null : placement.basis,
      unmeasured: seen && toggles.unmeasured,
    });
  }
  return { fills };
}

/** What one scene amounts to, as the canvas publishes it after a frame (Decision Part 6 § 7). */
export type QuantityCounts = { readonly filled: number; readonly hatched: number };

/** The counts the canvas wears, read off the scene rather than off the paint (the partition overlay's rule). */
export function quantityCounts(scene: QuantityScene): QuantityCounts {
  return {
    filled: scene.fills.filter((fill) => fill.basis !== null).length,
    hatched: scene.fills.filter((fill) => fill.unmeasured).length,
  };
}
