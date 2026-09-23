// L-CAD-05: the EntityGraph is versioned (v2 as the floor) and mirrored in Zod. This is that
// mirror, and its one home (ARCH-02, B-17) — every TypeScript stage that reads an artifact reads
// it through this schema rather than re-describing the vocabulary.
//
// The Python half lives at cad/src/vextrus_cad/model.py and validates the same committed fixtures.
// The two are deliberately the same shape stated twice, once per runtime, because the artifact
// crosses a process boundary: `cad/` writes it and stops (L-CAD-01), and nothing but the file
// itself carries the contract between them. Keep them in step field for field.
//
// Every record is strict. An artifact is a closed vocabulary, so a key the mirror does not know is
// a drift signal, not a payload to carry: refusing it here is what stops a second dialect forming.
//
// Two versions are admitted, for two doors (I-415). v3 is what the extractor writes, and it
// REQUIRES its facts wherever they apply: a v3 text without its rotation, or a v3 block reference
// without its identity, is a broken artifact rather than an old one. v2 is the floor: an artifact
// stored before v3 keeps reading (the stored-read path, `./artifact`), carrying none of v3's facts —
// a v2 document spelling one is two dialects in one file. The ingest door
// (`src/modules/takeoff/ingest/cli.ts`) takes only the current version from the CLI, so a stale cad
// install cannot write v2 into the store unnoticed. The bump mints no key: L-CAD-02 scopes a key
// to the extractor's version and parameter-set hash, and neither moved.
//
// This module validates; it reads no meaning. Schedule reconstruction, view law, grid, placement,
// convention profiles and notation parsing are stages over the parsed artifact (L-CAD-01), and
// none of them belongs in the shape.
import { z } from "zod";

/** The version the extractor writes, and the only one the ingest door takes from it (L-CAD-05). */
export const ENTITYGRAPH_VERSION = 3;

/** The oldest version this mirror still reads: an artifact stored before v3 (L-CAD-05's floor). */
export const ENTITYGRAPH_FLOOR = 2;

/**
 * The closed source-key scheme a DXF ingest mints (L-CAD-02). Exported because the store's ingest
 * record closes its own scheme column on what an extractor can mint, and one list read by both is
 * the only way the two cannot drift (B-17).
 */
export const INGEST_SCHEME = "DXF_HANDLE";

const SCHEME = INGEST_SCHEME;

/**
 * A source key: the scheme, then the file's own handle in uppercase hex (L-CAD-02). The scheme
 * rides the key rather than the drawing, so it is spelled per key here as it is in the artifact.
 */
const SOURCE_KEY = new RegExp(`^${SCHEME}:[0-9A-F]+$`);

/** The extractor identity half that pins the parameter set: a sha256 digest. */
const PARAMETER_SET_HASH = /^[0-9a-f]{64}$/i;

/** Which link of L-CAD-05's chain resolved an entity's colour. */
const COLOUR_SOURCES = ["truecolor", "explicit", "bylayer", "byblock"] as const;

/** The closed `$INSUNITS` map L-CAD-02 spells out; an unmapped code reports null and a flag. */
const UNITS = ["unitless", "inch", "foot", "mm", "cm", "m"] as const;

/** Model space or a named paper layout — the two kinds of space an entity can sit in. */
const LAYOUT_KINDS = ["model", "paper"] as const;

const sourceKey = z.string().regex(SOURCE_KEY);

/** A colour channel as the artifact carries it: an integer, never a spelled colour. */
const channel = z.number().int().min(0).max(255);

const point = z.tuple([z.number(), z.number()]);

/** A per-DXF-type tally, as the fidelity counters carry them (R-TO-001). */
const counts = z.record(z.string(), z.number().int().min(0));

/** Colour resolved server-side, with the link of the chain that resolved it (L-CAD-05). */
const colourSchema = z.strictObject({
  rgb: z.tuple([channel, channel, channel]),
  source: z.enum(COLOUR_SOURCES),
});

/** An angle as the artifact spells one: counter-clockwise degrees in the world, in [0, 360). */
const turn = z.number().min(0).lt(360);

/** A single-line text's horizontal alignment, DXF group 72: left, center, right, aligned, middle, fit. */
const halign = z.number().int().min(0).max(5);

/** A single-line text's vertical alignment, DXF group 73 (74 on an attribute): baseline, bottom, middle, top. */
const valign = z.number().int().min(0).max(3);

/** An MTEXT's attachment point, DXF group 71: 1-9, top-left to bottom-right, row by row. */
const attachment = z.number().int().min(1).max(9);

/**
 * A block reference's identity (v3): the block it names, the sha256 of that block's content, and
 * where and how it places it — in one canonical spelling, so two references that place a block
 * alike carry the same record however the DXF spelled them (I-416). `at` is where the block's
 * base lands in the world; `rotation` the world angle of the block's own x axis; `scale` the length
 * each block axis is scaled to (a length, never negative); `mirrored` whether the reference
 * reflects the block. `definition_sha256` is null where the drawing does not define the block, or
 * where the definition reaches a block cycle or nests past the explode depth cap.
 */
const blockSchema = z.strictObject({
  name: z.string().min(1),
  definition_sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
  at: point,
  rotation: turn,
  scale: z.tuple([z.number().min(0), z.number().min(0)]),
  mirrored: z.boolean(),
});

/**
 * One layer's visibility as the layer table states it (v3, I-417). Restated, never applied. The
 * name is the drawing's own, empty where the table spells it empty — as a drawn record's `layer` is
 * admitted — so a restated fact never refuses a drawing v2 took.
 */
const layerSchema = z.strictObject({
  name: z.string(),
  on: z.boolean(),
  frozen: z.boolean(),
  plot: z.boolean(),
});

/**
 * What every drawn record carries, original or synthesised. The per-type fields are optional
 * because they are facts about a type rather than about every entity: only text carries `text` and
 * a world height, only path-shaped geometry carries `points`, only a closing type carries
 * `closed`, and only a closed ring carries its shoelace `area`.
 *
 * v3's facts are optional in the SHAPE because a v2 artifact carries none of them; the version rules
 * below say where v3 requires each one. A text carries its world `rotation`; a single-line text its
 * `halign`/`valign` and, aligned anywhere but left on its baseline, the `align_point` that places it
 * (world coordinates; the record's anchor in `points` stays its insert); an MTEXT its `attachment`;
 * an original block reference its `block`; and a dimension the `override` text its drawing states.
 */
const drawnFields = {
  type: z.string().min(1),
  space: z.string().min(1),
  layer: z.string(),
  colour: colourSchema,
  text: z.string().optional(),
  height: z.number().optional(),
  points: z.array(point).optional(),
  closed: z.boolean().optional(),
  area: z.number().optional(),
  rotation: turn.optional(),
  halign: halign.optional(),
  valign: valign.optional(),
  attachment: attachment.optional(),
  align_point: point.optional(),
  block: blockSchema.optional(),
  override: z.string().min(1).optional(),
};

/** An original entity — the atom a source key names, and the only extraction surface (L-CAD-03). */
const entitySchema = z.strictObject({ key: sourceKey, ...drawnFields });

/**
 * Derived paint: a synthesised entity carrying `src`, its parent instance's key (L-CAD-03). It
 * carries no key of its own, because it is not an atom a source key names — the strictness here is
 * what keeps exploded paint out of the extraction surface.
 */
const derivedSchema = z.strictObject({ src: sourceKey, ...drawnFields });

/**
 * Block attributes collect separately from the geometry the instance painted (L-CAD-03). In v3 each
 * carries how it is turned and aligned; an attribute carries no anchor in the artifact, so no
 * alignment point either.
 */
const blockAttributeSchema = z.strictObject({
  src: sourceKey,
  tag: z.string().min(1),
  text: z.string(),
  height: z.number(),
  rotation: turn.optional(),
  halign: halign.optional(),
  valign: valign.optional(),
});

/**
 * The drawn-record fields only v3 carries. Exported with the other two lists below so a test's
 * stand-in extractor writes and strips v3 by these lists rather than a second spelling of them.
 */
export const V3_RECORD_FIELDS = ["rotation", "halign", "valign", "attachment", "align_point", "block", "override"] as const;

/** The block-attribute fields only v3 carries. */
export const V3_ATTRIBUTE_FIELDS = ["rotation", "halign", "valign"] as const;

/** The top-level keys only v3 carries, and every v3 artifact does. */
export const V3_TOP_LEVEL_KEYS = ["layers"] as const;

/** The DXF type whose alignment is one attachment point rather than a (halign, valign) pair. */
const MTEXT = "MTEXT";

/** The only type a block identity or a dimension's override text is stated on. */
const INSERT = "INSERT";
const DIMENSION = "DIMENSION";

type Issue = { readonly path: readonly (string | number)[]; readonly message: string };
type DrawnRecord = z.infer<typeof entitySchema> | z.infer<typeof derivedSchema>;
type AttributeRecord = z.infer<typeof blockAttributeSchema>;

/** The v3 fields a record carries, in the order the list above names them. */
function carried(record: object, fields: readonly string[]): string[] {
  return fields.filter((field) => field in record);
}

/**
 * What the version says a drawn record must and must not carry (I-415) — the same rules the
 * Python mirror's `_v3_record` states, rule for rule. `original` is whether the record is an
 * original entity: only an original block reference carries its identity.
 */
function drawnIssues(record: DrawnRecord, version: number, original: boolean): string[] {
  if (version < 3) {
    const present = carried(record, V3_RECORD_FIELDS);
    return present.length === 0 ? [] : [`carries ${present.join(", ")}, which a v${version} artifact never carries`];
  }
  const issues: string[] = [];
  if (record.text !== undefined) {
    if (record.rotation === undefined) issues.push("is missing rotation, which every v3 text carries");
    if (record.type === MTEXT) {
      if (record.attachment === undefined) issues.push("is missing attachment, which every v3 MTEXT carries");
      const stray = carried(record, ["halign", "valign", "align_point"]);
      if (stray.length > 0) issues.push(`carries ${stray.join(", ")}, which an MTEXT states as its attachment`);
    } else {
      if (record.halign === undefined || record.valign === undefined) issues.push("is missing halign or valign, which every v3 single-line text carries");
      if (record.attachment !== undefined) issues.push("carries attachment, which only an MTEXT states");
      const leftOnBaseline = (record.halign ?? 0) === 0 && (record.valign ?? 0) === 0;
      if (leftOnBaseline && record.align_point !== undefined) issues.push("carries align_point, yet is aligned left on its baseline");
      if (!leftOnBaseline && record.align_point === undefined) issues.push("is missing align_point, which places a text not aligned left");
    }
  } else {
    const stray = carried(record, ["rotation", "halign", "valign", "attachment", "align_point"]);
    if (stray.length > 0) issues.push(`carries ${stray.join(", ")}, which only a text carries`);
  }
  if (original && record.type === INSERT) {
    if (record.block === undefined) issues.push("is missing block, which every v3 block reference carries");
  } else if (record.block !== undefined) {
    issues.push("carries block, which only an original block reference carries");
  }
  if (record.override !== undefined && record.type !== DIMENSION) issues.push("carries override, which only a dimension states");
  return issues;
}

/** What the version says a block attribute must and must not carry. */
function attributeIssues(record: AttributeRecord, version: number): string[] {
  const present = carried(record, V3_ATTRIBUTE_FIELDS);
  if (version < 3) return present.length === 0 ? [] : [`carries ${present.join(", ")}, which a v${version} artifact never carries`];
  return present.length === V3_ATTRIBUTE_FIELDS.length ? [] : [`is missing ${V3_ATTRIBUTE_FIELDS.filter((field) => !present.includes(field)).join(", ")}, which every v3 attribute carries`];
}

/** Every version rule an artifact breaks, with where it broke. */
function versionIssues(graph: {
  readonly entitygraph_version: number;
  readonly layers?: unknown;
  readonly entities: readonly DrawnRecord[];
  readonly derived: readonly DrawnRecord[];
  readonly block_attributes: readonly AttributeRecord[];
}): Issue[] {
  const version = graph.entitygraph_version;
  const issues: Issue[] = [];
  for (const key of V3_TOP_LEVEL_KEYS) {
    if (version < 3 && graph[key] !== undefined) issues.push({ path: [key], message: `a v${version} artifact never carries ${key}` });
    if (version >= 3 && graph[key] === undefined) issues.push({ path: [], message: `is missing ${key}, which every v3 artifact carries` });
  }
  graph.entities.forEach((record, index) => {
    for (const message of drawnIssues(record, version, true)) issues.push({ path: ["entities", index], message });
  });
  graph.derived.forEach((record, index) => {
    for (const message of drawnIssues(record, version, false)) issues.push({ path: ["derived", index], message });
  });
  graph.block_attributes.forEach((record, index) => {
    for (const message of attributeIssues(record, version)) issues.push({ path: ["block_attributes", index], message });
  });
  return issues;
}

/** The extractor identity a key is scoped to, pinned per ingest record (L-CAD-02). */
const ingestSchema = z.strictObject({
  scheme: z.literal(SCHEME),
  tool: z.string().min(1),
  tool_version: z.string().min(1),
  parameter_set_hash: z.string().regex(PARAMETER_SET_HASH),
});

/**
 * `$INSUNITS` as reported: the header code as it stands, the unit it names, and a flag. A code the
 * closed map does not name reports null plus the flag — never "unitless", which is itself a code
 * (L-CAD-02).
 */
const insunitsSchema = z
  .strictObject({
    code: z.number().int(),
    unit: z.enum(UNITS).nullable(),
    unmapped: z.boolean(),
  })
  .refine((insunits) => insunits.unmapped === (insunits.unit === null), {
    error: "insunits.unmapped must be set exactly when no unit was mapped",
  });

/** A space's extents, robust: strays took no part in them and were counted (L-CAD-05). */
const bboxSchema = z.strictObject({ min: point, max: point });

/**
 * One window a paper layout opens onto model space, as the VIEWPORT itself states it: where it
 * stands on the paper, which piece of model space it looks at and at what height, whether it is
 * switched on, its twist and whether a non-rectangular boundary clips it. Inventory rather than
 * paint — it frames what is drawn and draws nothing — and it restates no derived figure: the scale
 * is `size[1] / view_height`, and the projecting is the consumer's (L-CAD-05).
 */
const viewportSchema = z.strictObject({
  handle: z.string().min(1),
  on: z.boolean(),
  centre: point,
  size: point,
  view_centre: point,
  view_height: z.number().positive(),
  twist: z.number(),
  clipped: z.boolean(),
});

/**
 * The layout inventory: model space and every content-bearing paper layout (L-CAD-05). `viewports`
 * is optional because an artifact read before windows were inventoried carries no key; a paper
 * layout with no window onto model space carries an empty list, and model space carries one too.
 */
const layoutSchema = z.strictObject({
  name: z.string().min(1),
  kind: z.enum(LAYOUT_KINDS),
  bbox: bboxSchema.nullable(),
  strays_rejected: z.number().int().min(0),
  viewports: z.array(viewportSchema).optional(),
});

/**
 * One space's fidelity counters — what the extraction lost, and where (R-TO-001).
 *
 * `conversion_losses` is the DWG lane's own loss: how many of each class the LibreDWG conversion in
 * front of the ingest did not carry onto this space, reconciled class by class against the census
 * (L-CAD-04). Optional because it is a fact about a conversion — a DXF ingest crosses none, and a
 * conversion that reconciled cleanly lost nothing — so an artifact written before this, or written
 * from a DXF, carries no key. A space the conversion emptied altogether carries a counters row of
 * its own: the loss is named even where no layout was left to name it on.
 */
const counterSchema = z.strictObject({
  space: z.string().min(1),
  explode_truncated: z.boolean(),
  explode_losses: counts,
  flatten_capped: counts,
  conversion_losses: counts.optional(),
});

/**
 * The whole artifact. The top-level key set is closed, and the cross-record rules L-CAD-02 and
 * L-CAD-03 state — one key minted once, and every synthesised piece naming an original — are
 * checked here because no single record can see them. So are the version rules: which of v3's facts
 * a record must carry, and that a v2 artifact carries none of them.
 */
export const entityGraphSchema = z
  .strictObject({
    entitygraph_version: z.union([z.literal(ENTITYGRAPH_FLOOR), z.literal(ENTITYGRAPH_VERSION)]),
    ingest: ingestSchema,
    insunits: insunitsSchema,
    layers: z.array(layerSchema).optional(),
    layouts: z.array(layoutSchema),
    dropped_layouts: z.array(z.string().min(1)),
    entities: z.array(entitySchema),
    derived: z.array(derivedSchema),
    block_attributes: z.array(blockAttributeSchema),
    counters: z.array(counterSchema),
  })
  .superRefine((graph, ctx) => {
    for (const issue of versionIssues(graph)) ctx.addIssue({ code: "custom", path: [...issue.path], message: issue.message });

    const minted = new Set<string>();
    graph.entities.forEach((entity, index) => {
      if (minted.has(entity.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["entities", index, "key"],
          message: `${entity.key} is minted twice (L-CAD-02)`,
        });
      }
      minted.add(entity.key);
    });

    for (const [key, records] of [
      ["derived", graph.derived],
      ["block_attributes", graph.block_attributes],
    ] as const) {
      records.forEach((record: { src: string }, index: number) => {
        if (!minted.has(record.src)) {
          ctx.addIssue({
            code: "custom",
            path: [key, index, "src"],
            message: `${record.src} names no original entity (L-CAD-03)`,
          });
        }
      });
    }
  });

/** An EntityGraph artifact — v3, or a stored v2 at the floor — as both runtimes agree it is shaped. */
export type EntityGraph = z.infer<typeof entityGraphSchema>;
