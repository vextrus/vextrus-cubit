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
// This module validates; it reads no meaning. Schedule reconstruction, view law, grid, placement,
// convention profiles and notation parsing are stages over the parsed artifact (L-CAD-01), and
// none of them belongs in the shape.
import { z } from "zod";

/** The version floor both mirrors demand, and the only version this schema admits (L-CAD-05). */
export const ENTITYGRAPH_VERSION = 2;

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

/**
 * What every drawn record carries, original or synthesised. The per-type fields are optional
 * because they are facts about a type rather than about every entity: only text carries `text` and
 * a world height, only path-shaped geometry carries `points`, only a closing type carries
 * `closed`, and only a closed ring carries its shoelace `area`.
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
};

/** An original entity — the atom a source key names, and the only extraction surface (L-CAD-03). */
const entitySchema = z.strictObject({ key: sourceKey, ...drawnFields });

/**
 * Derived paint: a synthesised entity carrying `src`, its parent instance's key (L-CAD-03). It
 * carries no key of its own, because it is not an atom a source key names — the strictness here is
 * what keeps exploded paint out of the extraction surface.
 */
const derivedSchema = z.strictObject({ src: sourceKey, ...drawnFields });

/** Block attributes collect separately from the geometry the instance painted (L-CAD-03). */
const blockAttributeSchema = z.strictObject({
  src: sourceKey,
  tag: z.string().min(1),
  text: z.string(),
  height: z.number(),
});

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

/** The layout inventory: model space and every content-bearing paper layout (L-CAD-05). */
const layoutSchema = z.strictObject({
  name: z.string().min(1),
  kind: z.enum(LAYOUT_KINDS),
  bbox: bboxSchema.nullable(),
  strays_rejected: z.number().int().min(0),
});

/** One space's fidelity counters — what the extraction lost, and where (R-TO-001). */
const counterSchema = z.strictObject({
  space: z.string().min(1),
  explode_truncated: z.boolean(),
  explode_losses: counts,
  flatten_capped: counts,
});

/**
 * The whole artifact. The top-level key set is closed, and the cross-record rules L-CAD-02 and
 * L-CAD-03 state — one key minted once, and every synthesised piece naming an original — are
 * checked here because no single record can see them.
 */
export const entityGraphSchema = z
  .strictObject({
    entitygraph_version: z.literal(ENTITYGRAPH_VERSION),
    ingest: ingestSchema,
    insunits: insunitsSchema,
    layouts: z.array(layoutSchema),
    dropped_layouts: z.array(z.string().min(1)),
    entities: z.array(entitySchema),
    derived: z.array(derivedSchema),
    block_attributes: z.array(blockAttributeSchema),
    counters: z.array(counterSchema),
  })
  .superRefine((graph, ctx) => {
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

/** An EntityGraph v2 artifact, as both runtimes agree it is shaped. */
export type EntityGraph = z.infer<typeof entityGraphSchema>;
