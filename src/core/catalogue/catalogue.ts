// L-MEA-04: the work-item catalogue — for each kind, what the work item is, the canonical SI unit
// and dimension it is measured in, and the precision a document rounds it to.
//
// The catalogue is total over `Kind` by construction: `Record<Kind, …>` makes a kind without an
// entry a `tsc` failure, so the enum and this table cannot drift. Unit and dimension agree by
// construction too — an entry names its dimension, and the type of its `unit` is that dimension's
// canonical, read from the canon (L-FRM-06). There is no way to write `dimension: "AREA"` beside
// `unit: "m3"` here.
//
// The precision is the document's, not the arithmetic's: it says how many decimals a printed bill
// carries for this kind, and a volume is quoted finer than a length because the same relative error
// is worth more money on it. A count is a whole number.
import { CANONICAL_UNITS, type CanonicalUnitOf, type Dimension } from "../units/canon";
import { type Kind } from "./kinds";

/** One catalogue entry, measured in one dimension, carrying that dimension's canonical unit. */
type Measured<D extends Dimension> = {
  description: string;
  unit: CanonicalUnitOf<D>;
  dimension: D;
  precision: number;
};

/** A catalogue entry for any of the five dimensions — the union, so unit and dimension stay paired. */
export type CatalogueEntry = { [D in Dimension]: Measured<D> }[Dimension];

/** The catalogue, total over `Kind`. */
export const CATALOGUE: Readonly<Record<Kind, CatalogueEntry>> = Object.freeze({
  excavation: {
    description: "Earth excavation in all kinds of soil, including shoring and dewatering as required",
    unit: CANONICAL_UNITS.VOLUME,
    dimension: "VOLUME",
    precision: 3,
  },
  backfilling: {
    description: "Backfilling around and over completed work with approved excavated earth, in layers, watered and compacted",
    unit: CANONICAL_UNITS.VOLUME,
    dimension: "VOLUME",
    precision: 3,
  },
  "sand-filling": {
    description: "Filling with approved local sand in layers, watered and compacted to the specified density",
    unit: CANONICAL_UNITS.VOLUME,
    dimension: "VOLUME",
    precision: 3,
  },
  "brick-soling": {
    description: "Single layer of picked jhama brick flat soling laid on prepared bed, joints filled with sand",
    unit: CANONICAL_UNITS.AREA,
    dimension: "AREA",
    precision: 2,
  },
  "lean-concrete": {
    description: "Lean cement concrete bed with brick chips, laid and levelled under structural work",
    unit: CANONICAL_UNITS.VOLUME,
    dimension: "VOLUME",
    precision: 3,
  },
  "concrete-casting": {
    description: "Reinforced cement concrete of the specified grade, mixed, placed, vibrated and cured",
    unit: CANONICAL_UNITS.VOLUME,
    dimension: "VOLUME",
    precision: 3,
  },
  reinforcement: {
    description: "Deformed steel bar reinforcement cut, bent, placed and tied in position, including binding wire",
    unit: CANONICAL_UNITS.MASS,
    dimension: "MASS",
    precision: 2,
  },
  formwork: {
    description: "Shuttering and centering to the specified finish, including props, and its removal",
    unit: CANONICAL_UNITS.AREA,
    dimension: "AREA",
    precision: 2,
  },
  brickwork: {
    description: "First-class brickwork in cement mortar, including raking joints and curing",
    unit: CANONICAL_UNITS.VOLUME,
    dimension: "VOLUME",
    precision: 3,
  },
  plastering: {
    description: "Cement plaster of the specified thickness and mix, finished smooth and cured",
    unit: CANONICAL_UNITS.AREA,
    dimension: "AREA",
    precision: 2,
  },
  tiling: {
    description: "Tile work of the specified size laid in cement mortar, jointed, grouted and cleaned",
    unit: CANONICAL_UNITS.AREA,
    dimension: "AREA",
    precision: 2,
  },
  painting: {
    description: "Paint of the specified type over prepared and primed surface, in the specified number of coats",
    unit: CANONICAL_UNITS.AREA,
    dimension: "AREA",
    precision: 2,
  },
  waterproofing: {
    description: "Waterproofing treatment of the specified system, including preparation, laps and protective screed",
    unit: CANONICAL_UNITS.AREA,
    dimension: "AREA",
    precision: 2,
  },
  "false-ceiling": {
    description: "Suspended ceiling of the specified board on a levelled metal grid, including hangers and access panels",
    unit: CANONICAL_UNITS.AREA,
    dimension: "AREA",
    precision: 2,
  },
  skirting: {
    description: "Skirting of the specified material and height, laid and finished flush with the wall face",
    unit: CANONICAL_UNITS.LENGTH,
    dimension: "LENGTH",
    precision: 2,
  },
  railing: {
    description: "Railing and handrail of the specified material and height, fabricated, fixed and finished",
    unit: CANONICAL_UNITS.LENGTH,
    dimension: "LENGTH",
    precision: 2,
  },
  pipework: {
    description: "Pipe of the specified material and bore, laid or fixed in position, including jointing and testing",
    unit: CANONICAL_UNITS.LENGTH,
    dimension: "LENGTH",
    precision: 2,
  },
  "sanitary-ware": {
    description: "Sanitary appliance of the specified make, supplied and set complete with its fittings",
    unit: CANONICAL_UNITS.COUNT,
    dimension: "COUNT",
    precision: 0,
  },
  "electrical-point": {
    description: "Wiring point of the specified type drawn in concealed conduit, complete with switch and accessories",
    unit: CANONICAL_UNITS.COUNT,
    dimension: "COUNT",
    precision: 0,
  },
  "structural-steel": {
    description: "Structural steel section fabricated, erected and fixed in position, including connections",
    unit: CANONICAL_UNITS.MASS,
    dimension: "MASS",
    precision: 2,
  },
} satisfies Record<Kind, CatalogueEntry>);
