// The two EntityGraph versions a test has to speak (L-CAD-05, I-415): v3, which the extractor
// writes and the ingest door alone takes from it, and the v2 floor an artifact stored before v3 is
// still read at. Plain TypeScript with no test-runner import, because the stand-in extractors that
// feed the ingest door live in three lanes — the unit and database stages (vitest) and the journeys
// (Playwright) — and all of them load this one home rather than each spelling the version rules.
//
// The versions and the lists of what v3 adds are read from the Zod mirror's own exports
// (src/core/entitygraph/schema.ts), their one home; only what a stage needs to write or strip them
// is stated here. The mirror parses every stand-in's drawing besides, so the two cannot part.
import {
  ENTITYGRAPH_FLOOR as FLOOR,
  ENTITYGRAPH_VERSION as CURRENT,
  V3_ATTRIBUTE_FIELDS,
  V3_RECORD_FIELDS,
  V3_TOP_LEVEL_KEYS,
} from "../../../src/core/entitygraph/schema";

export { V3_ATTRIBUTE_FIELDS, V3_RECORD_FIELDS, V3_TOP_LEVEL_KEYS };

/** A document or record as a stage builds one: keyed fields, read no more tightly than that. */
type Fields = Record<string, unknown>;

/** The one text type whose alignment is an attachment point rather than a (halign, valign) pair. */
const MTEXT = "MTEXT";

/** The block reference, whose identity no stage may leave to be invented. */
const INSERT = "INSERT";

/** What an MTEXT that states no attachment means: top left (DXF group 71's default). */
const TOP_LEFT = 1;

function recordsOf(value: unknown, what: string): Fields[] {
  if (!Array.isArray(value)) throw new Error(`${what} must be an array`);
  return value.map((record: unknown, index) => {
    if (typeof record !== "object" || record === null || Array.isArray(record)) throw new Error(`${what}[${String(index)}] must be an object`);
    return record as Fields;
  });
}

/**
 * A v3 artifact as the extractor wrote it before v3 — the same document less v3's facts, at the v2
 * floor. What a drawing stored before the bump looks like on the stored-read path, and what a stale
 * cad install writes at the ingest door.
 */
export function asStoredV2<T extends object>(graph: T): T {
  const stored = structuredClone(graph) as Fields;
  stored["entitygraph_version"] = FLOOR;
  for (const key of V3_TOP_LEVEL_KEYS) delete stored[key];
  for (const kind of ["entities", "derived"] as const) {
    for (const record of recordsOf(stored[kind], kind)) for (const field of V3_RECORD_FIELDS) delete record[field];
  }
  for (const record of recordsOf(stored["block_attributes"], "block_attributes")) {
    for (const field of V3_ATTRIBUTE_FIELDS) delete record[field];
  }
  return stored as T;
}

/**
 * A stage's drawing as the current extractor writes it: EntityGraph v3, stating the facts v3 carries
 * for the plainest drawing there is — which is the one every stand-in stage authors. Each text is
 * written square (rotation 0) and left on its baseline (halign 0, valign 0; an MTEXT attached top
 * left), each block attribute likewise, and the layer table names every layer a record is drawn on,
 * in the order first drawn, switched on, thawed and plotted. A fact the stage already states is kept
 * as stated, so a stage that turns or centres a text says so on the record and this leaves it alone.
 *
 * What this will not do is invent a block reference's identity: which block an INSERT names and
 * where it places it are the drawing's to state, so an original INSERT without its `block` is a stage
 * that has not said what it drew, and it is refused by name rather than filled.
 */
export function writtenAtV3<T extends object>(graph: T): T {
  const written = structuredClone(graph) as Fields;
  written["entitygraph_version"] = CURRENT;

  const drawnOn: string[] = [];
  for (const kind of ["entities", "derived"] as const) {
    for (const [index, record] of recordsOf(written[kind], kind).entries()) {
      const layer = record["layer"];
      // Empty is a name too: the mirrors admit the table row a drawing spells empty (I-415).
      if (typeof layer === "string" && !drawnOn.includes(layer)) drawnOn.push(layer);
      // A key holding `undefined` is no text: serialised, it is not there at all.
      if (record["text"] !== undefined) {
        record["rotation"] ??= 0;
        if (record["type"] === MTEXT) {
          record["attachment"] ??= TOP_LEFT;
        } else {
          record["halign"] ??= 0;
          record["valign"] ??= 0;
        }
      }
      if (kind === "entities" && record["type"] === INSERT && !("block" in record)) {
        throw new Error(`entities[${String(index)}] (${String(record["key"])}) is a block reference that states no block: a stage says which block it draws and where`);
      }
    }
  }
  for (const record of recordsOf(written["block_attributes"], "block_attributes")) {
    record["rotation"] ??= 0;
    record["halign"] ??= 0;
    record["valign"] ??= 0;
  }
  written["layers"] ??= drawnOn.map((name) => ({ name, on: true, frozen: false, plot: true }));
  return written as T;
}
