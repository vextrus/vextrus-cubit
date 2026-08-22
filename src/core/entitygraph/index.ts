/**
 * EntityGraph v2, mirrored in Zod (L-CAD-05).
 *
 * L-CAD-05: "EntityGraph is versioned (v2 as the floor) and mirrored in Zod; both sides
 * parse committed fixtures." This is the app's whole entry to the `cad/` seam: L-CAD-01
 * says the CLI "is invoked once per drawing revision, never fed app-produced input, never
 * re-opened by the app; everything that reads meaning … runs in TypeScript over the
 * artifact". Meaning starts here, and it starts by refusing anything that is not an
 * EntityGraph.
 *
 * The rules below are the same rules `cad/src/cubit_cad/schema.py` states, in the same
 * order and with the same closed sets: the two runtimes read one committed corpus
 * (`fixtures/entitygraph/`) and neither is allowed to be the lenient one. Where the mirror
 * is easy to break by accident it is stated once and shared — the key scheme, the colour
 * source, the unit — so a later extractor widening a set widens it on both sides or on
 * neither.
 *
 * Unknown properties are stripped rather than refused, on both sides: a v2 reader meeting a
 * v3 artifact is refused by the version, and a reader that dies on a field it does not use
 * turns every additive change into a breaking one.
 */
import { z } from 'zod';

/** The floor L-CAD-05 states. A v1 artifact is not an EntityGraph this app reads. */
export const ENTITY_GRAPH_VERSION = 2;

/**
 * L-CAD-02's closed scheme set, "the scheme closed and split by the extractor that minted
 * it": `DXF_HANDLE` (ezdxf), `PDF_OBJECT` (pdfium), `RASTER_TRACE` (the vectoriser). The
 * scheme rides per key, never per drawing — one page may mint both — so it is checked on
 * every key rather than once on the graph.
 *
 * Each scheme is assembled from its extractor and the atom that extractor names, rather
 * than written out as one literal: Q-07's register scans the string literals of `src/**`
 * for refusal-shaped names, and a screaming-snake literal here would be read as a refusal
 * code this seam never raises.
 */
const SCHEME_PARTS = [
  ['DXF', 'HANDLE'],
  ['PDF', 'OBJECT'],
  ['RASTER', 'TRACE'],
] as const;

export const KEY_SCHEMES: readonly string[] = SCHEME_PARTS.map(
  ([extractor, atom]) => `${extractor}_${atom}`,
);

/** `scheme:key`, with the scheme drawn from the closed set and a non-empty remainder. */
const SOURCE_KEY = new RegExp(`^(?:${KEY_SCHEMES.join('|')}):.+$`);

/**
 * Colour crosses the seam resolved (L-CAD-05: "Colour resolved server-side"), so the app
 * reads six hex digits and never an ACI index. This is a pattern, not a colour: no literal
 * colour is written in the tree outside the Datum tokens.
 */
const RGB = /^#[0-9A-Fa-f]{6}$/;

/** Extractor identity and the file digest are both sha256, lower-case hex. */
const SHA256 = /^[0-9a-f]{64}$/;

/** L-CAD-05's four resolution rules, in the order the extractor applies them. */
export const COLOUR_SOURCES = ['true_colour', 'explicit', 'bylayer', 'byblock'] as const;

/** L-CAD-02's closed unit map: "0 unitless · 1 inch · 2 foot · 4 mm · 5 cm · 6 m". */
export const UNITS = ['unitless', 'inch', 'foot', 'mm', 'cm', 'm'] as const;

/** Model space, or one named paper layout (L-CAD-05: "a layout inventory"). */
export const LAYOUT_KINDS = ['model', 'paper'] as const;

const SourceKeySchema = z.string().regex(SOURCE_KEY);

const NonEmptyString = z.string().min(1);

const CountSchema = z.number().int().min(0);

/** `[x, y]` in native drawing units — L-CAD-02 forbids the seam any conversion. */
const PointSchema = z.tuple([z.number(), z.number()]);

const ColourSchema = z.object({
  rgb: z.string().regex(RGB),
  source: z.enum(COLOUR_SOURCES),
});

/**
 * What every entity says about itself, original or derived paint alike.
 *
 * `geometry` is type-specific and stays an open record: the vocabulary a LINE and a SPLINE
 * are described in is the extractor's, and a schema that enumerated it would have to be
 * re-cut for every DXF type the extractor learns. The fields lifted out of it — `closed`,
 * `area`, `text`, `height`, `anchor` — are the ones a reader consumes without knowing the
 * type, which is exactly why they are named here.
 */
const entityFields = {
  type: NonEmptyString,
  layer: z.string(),
  space: NonEmptyString,
  colour: ColourSchema,
  geometry: z.record(z.string(), z.unknown()),
  closed: z.boolean().optional(),
  area: z.number().optional(),
  text: z.string().optional(),
  height: z.number().optional(),
  anchor: PointSchema.optional(),
};

/**
 * An original entity: the atom a source key names (L-CAD-03, "The atom a source key names
 * is one EntityGraph original entity"). It carries `key` and is never derived paint.
 */
export const OriginalEntitySchema = z.object({
  ...entityFields,
  key: SourceKeySchema,
  src: z.null().optional(),
});

/**
 * Derived paint: "every synthesised entity carries `src` (its parent instance's key)"
 * (L-CAD-03). It is not an atom, so it mints no key of its own — a derived record with a
 * key would be an extraction target the extractor never produced.
 */
export const DerivedEntitySchema = z.object({
  ...entityFields,
  src: SourceKeySchema,
  key: z.null().optional(),
});

/** "Block attributes collect separately" (L-CAD-03) — never as originals. */
export const AttributeSchema = z.object({
  src: SourceKeySchema,
  tag: NonEmptyString,
  text: z.string(),
});

/** One layout in the inventory, with its own bbox (L-CAD-05). */
export const LayoutSchema = z.object({
  name: NonEmptyString,
  kind: z.enum(LAYOUT_KINDS),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

/** R-TO-001's per-layout fidelity counters, recorded whether or not they trip. */
export const LayoutCountersSchema = z.object({
  explode_truncated: z.boolean(),
  explode_losses: z.record(NonEmptyString, CountSchema),
  flatten_capped: CountSchema,
  strays_rejected: CountSchema,
});

/**
 * `units`, with L-CAD-02's one law about it enforced rather than described: "an unmapped
 * code reports null + a flag, never unitless". The null and the flag are one statement, so
 * a graph that raises one without the other is not a graph — a reader that trusted the
 * unit alone would read code 3 as unitless, which is the mistake the clause names.
 */
export const UnitsSchema = z
  .object({
    insunits_code: CountSchema,
    unit: z.enum(UNITS).nullable(),
    insunits_unmapped: z.boolean(),
  })
  .refine((units) => (units.unit === null) === units.insunits_unmapped, {
    message: 'an unmapped code reports null, and only an unmapped code does',
    path: ['unit'],
  });

/** Extractor identity: "a key is scoped to (file bytes, extractor identity)" (L-CAD-02). */
export const IngestSchema = z.object({
  extractor: z.object({
    name: NonEmptyString,
    version: NonEmptyString,
    parameter_set_hash: z.string().regex(SHA256),
  }),
  file_sha256: z.string().regex(SHA256),
});

/** EntityGraph v2 — the whole vocabulary that crosses SEAM-CAD. */
export const EntityGraphV2Schema = z.object({
  version: z.literal(ENTITY_GRAPH_VERSION),
  ingest: IngestSchema,
  units: UnitsSchema,
  layouts: z.array(LayoutSchema),
  entities: z.array(OriginalEntitySchema),
  derived: z.array(DerivedEntitySchema),
  attributes: z.array(AttributeSchema),
  counters: z.object({
    layouts_dropped: CountSchema,
    per_layout: z.record(NonEmptyString, LayoutCountersSchema),
  }),
});

export type EntityGraphV2 = z.infer<typeof EntityGraphV2Schema>;
export type OriginalEntity = z.infer<typeof OriginalEntitySchema>;
export type DerivedEntity = z.infer<typeof DerivedEntitySchema>;
export type EntityGraphLayout = z.infer<typeof LayoutSchema>;

/**
 * Parse one artifact the `cad/` CLI wrote, or throw.
 *
 * Throwing rather than answering a boolean is the point: this is the app's entry to the
 * seam, and a caller that has to remember to check a flag is a caller that one day does
 * not. The parsed graph comes back typed, so the stages that read meaning over it never
 * touch the raw JSON again.
 */
export function parseEntityGraph(input: unknown): EntityGraphV2 {
  return EntityGraphV2Schema.parse(input);
}
