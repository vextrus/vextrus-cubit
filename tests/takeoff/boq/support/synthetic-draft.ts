/**
 * A draft payload of any size, built by this file and by nothing the product owns (interfaces:
 * `tests/takeoff/boq/support/synthetic-draft.ts`, test contract: `syntheticDraftPayload`).
 *
 * MECHANICS ONLY. PERF-311 renders 5,000 lines of it through the real pinned renderer, and the
 * numbering suite reads the same builder at a size a person can check by hand — one payload shape,
 * so a render that copes with the large one is the same document as the small one.
 *
 * Every figure is deterministic and already at its kind's `documentPrecision`, because the document
 * kind's `present()` refuses a quantity that is not (interfaces, `PRECISION_NOT_APPLIED`): this is
 * an INPUT the suites hand over, never an expectation they grade.
 */
import { SIX_BILLS, TAXONOMY_VERSION, type PayloadGroupShape, type PayloadLineShape, type PayloadSectionShape, type PayloadShape } from "./draft-shapes";

/** One (class, kind) pair a section may carry, with the unit and the precision its kind is written at. */
type Pair = { class: string; kind: string; unit: string; precision: number; description: string };

/**
 * The pairs the builder draws from — every one a real `ELEMENT_TYPES` × `KINDS` pair, so the
 * numbering's `ELEMENT_TYPES`-then-`KINDS` order is exercised and `WORK_ITEM_CATALOGUE[kind]`
 * answers a precision for each.
 */
export const SYNTHETIC_PAIRS: readonly Pair[] = Object.freeze([
  { class: "column", kind: "rcc.concrete", unit: "m3", precision: 3, description: "Column · Concrete" },
  { class: "column", kind: "rcc.formwork", unit: "m2", precision: 2, description: "Column · Formwork" },
  { class: "beam", kind: "rcc.concrete", unit: "m3", precision: 3, description: "Beam · Concrete" },
  { class: "slab", kind: "rcc.formwork", unit: "m2", precision: 2, description: "Slab · Formwork" },
  { class: "pile_cap", kind: "rcc.concrete", unit: "m3", precision: 3, description: "Pile cap · Concrete" },
  { class: "brick_wall", kind: "masonry.brickwork", unit: "m3", precision: 3, description: "Brick wall · Brickwork" },
  { class: "surface", kind: "finish.plaster", unit: "m2", precision: 2, description: "Surface · Plaster" },
  { class: "surface", kind: "finish.paint", unit: "m2", precision: 2, description: "Surface · Paint" },
]);

/** The level labels the synthetic lines stand on — the stack a mid-rise names, nothing more. */
export const SYNTHETIC_LEVELS: readonly string[] = Object.freeze(["FDN", "GF", "1F", "2F", "3F", "4F"]);

/** A figure that is stable, non-trivial and already rounded to `precision` places. */
function figureAt(seed: number, precision: number): string {
  const whole = 1 + (seed % 97);
  const fraction = (seed * 37) % 10 ** precision;
  return precision === 0 ? String(whole) : `${whole}.${String(fraction).padStart(precision, "0")}`;
}

/** The sum of a group's or a section's figures, at the same precision, as a decimal string. */
function totalAt(values: readonly string[], precision: number): string {
  const scale = 10 ** precision;
  const sum = values.reduce((carried, value) => carried + Math.round(Number(value) * scale), 0);
  return (sum / scale).toFixed(precision);
}

/**
 * A payload of exactly `lines` lines spread over the six sections and several groups each.
 *
 * The spread is round-robin over (section × pair), so every section holds a line at any size past
 * the section count and the group ordinals the numbering derives are never all 1.
 */
export function syntheticDraftPayload(lines: number, o: { project?: string; campaignId?: string; setRevisionId?: string; coverage?: string } = {}): PayloadShape {
  const perSection: PayloadLineShape[][][] = SIX_BILLS.map(() => SYNTHETIC_PAIRS.map(() => []));

  for (let index = 0; index < lines; index += 1) {
    const section = index % SIX_BILLS.length;
    const pairIndex = Math.floor(index / SIX_BILLS.length) % SYNTHETIC_PAIRS.length;
    const pair = SYNTHETIC_PAIRS[pairIndex] as Pair;
    const level = SYNTHETIC_LEVELS[index % SYNTHETIC_LEVELS.length] as string;
    const ordinal = (perSection[section] as PayloadLineShape[][])[pairIndex] as PayloadLineShape[];
    ordinal.push({
      lineId: `ln-${String(index).padStart(6, "0")}`,
      objectKey: `${pair.class}/${level}/${String(index).padStart(6, "0")}`,
      level,
      quantity: figureAt(index + 1, pair.precision),
      unit: pair.unit,
      coverage: "COMPLETE",
      quantityBasis: "MEASURED",
      selectionBasis: "TRANSCRIBED",
      decidedBy: `OVERRIDE:${pair.class}`,
    });
  }

  const sections: PayloadSectionShape[] = [];
  SIX_BILLS.forEach((bill, sectionIndex) => {
    const groups: PayloadGroupShape[] = [];
    SYNTHETIC_PAIRS.forEach((pair, pairIndex) => {
      const held = ((perSection[sectionIndex] as PayloadLineShape[][])[pairIndex] as PayloadLineShape[]) ?? [];
      if (held.length === 0) return;
      groups.push({
        class: pair.class,
        kind: pair.kind,
        description: pair.description,
        unit: pair.unit,
        lines: held,
        subtotals: [{ unit: pair.unit, value: totalAt(held.map((line) => line.quantity ?? "0"), pair.precision) }],
      });
    });
    if (groups.length === 0) return;
    const units = [...new Set(groups.map((group) => group.unit))];
    sections.push({
      bill,
      label: `${bill.charAt(0)}${bill.slice(1).toLowerCase()}`,
      groups,
      subtotals: units.map((unit) => {
        const precision = (SYNTHETIC_PAIRS.find((pair) => pair.unit === unit) as Pair).precision;
        return {
          unit,
          value: totalAt(
            groups.filter((group) => group.unit === unit).flatMap((group) => group.lines.map((line) => line.quantity ?? "0")),
            precision,
          ),
        };
      }),
    });
  });

  return {
    title: "Draft BOQ — unpriced",
    project: o.project ?? "Sattva Court",
    campaignId: o.campaignId ?? "33333333-3333-4333-8333-333333333333",
    setRevisionId: o.setRevisionId ?? "44444444-4444-4444-8444-444444444444",
    taxonomyVersion: TAXONOMY_VERSION,
    coverage: o.coverage ?? "INCOMPLETE",
    sections,
    unclassified: { label: "Unclassified", lines: [] },
  };
}
