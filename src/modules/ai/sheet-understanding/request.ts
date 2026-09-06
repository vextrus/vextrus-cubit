// R-AI-001, L-AI-01: the question one silent sheet is asked, and the entities an answer to it may
// cite. Pure and total over the artifact: the same graph and layout name make the same request, so
// the request hash a recorded answer is filed under is a fact about the sheet rather than about the
// run (L-AI-01 replays deterministically from fixtures).
import type { EntityGraph } from "../../../core/entitygraph/schema";
import { canonicalJson, type ModelRequest } from "../../../core/model";
import { DISCIPLINES } from "../../../core/sheets";
import { UNDERSTANDING_MODEL } from "./law";

/**
 * What the model is told it is doing. It states the shape of the answer and the citation rule,
 * because L-AI-02 refuses an answer that is neither — an uncited reading is UNSOURCED and a citation
 * naming anything but this sheet's own entities is SOURCE_UNRESOLVED, and a model that was not told
 * so would spend tokens on answers nobody can accept.
 */
const SYSTEM = [
  "You read one sheet of a construction drawing set from the entities an extractor recovered from it.",
  "The deterministic title-block grammar found no readable text on this sheet, so what the sheet is must be read from the records below: block attributes, exploded paint and any text the grammar could not take.",
  'Answer with a JSON object of exactly {"payload": {...}, "sources": [...]}.',
  '`payload` names exactly four fields: `number` (the sheet number as the title block states it, or null), `title` (a non-blank sheet title), `discipline` (one of ' + DISCIPLINES.join(", ") + "), and `captions` (the view captions the sheet carries, as an array of strings, empty where it carries none).",
  "`sources` is a non-empty array of the `key` values of the entities you read the answer out of. Cite only keys that appear on this sheet in the records below; a block attribute is cited by the `src` key of the block it belongs to.",
  "Propose a reading. Do not conclude, do not measure, and where the sheet does not say something, say so with null or an empty array rather than supplying it.",
].join("\n");

/** The records a reading can be made out of: everything on the sheet that carries text. */
type SaidRecord = { key: string; type: string; layer: string; text: string; height: number };

/** One block attribute of a block standing on the sheet, named by the block's own key (L-CAD-03). */
type SaidAttribute = { src: string; tag: string; text: string; height: number };

/**
 * The sheet as the model is shown it: which layout it is, every text-bearing record standing on it,
 * and a census of everything else by type.
 *
 * The census rather than the records themselves: a sheet carries tens of thousands of drawn
 * primitives and none of them says what the sheet is, so sending them would spend a tenant's tokens
 * on paint. What a reading is made out of — text, exploded text, block attributes — is sent whole.
 */
type SheetEvidence = {
  layout: { name: string; kind: string };
  entities: SaidRecord[];
  derived: SaidRecord[];
  blockAttributes: SaidAttribute[];
  census: Record<string, number>;
};

/**
 * The question this module asks about one sheet. `params` is left absent: the request carries the
 * whole of what is asked, and a sampling knob turned per call would make two runs two requests.
 */
export function sheetUnderstandingRequest(graph: EntityGraph, layoutName: string): ModelRequest {
  return {
    modelId: UNDERSTANDING_MODEL,
    system: SYSTEM,
    messages: [{ role: "user", content: canonicalJson(evidenceOn(graph, layoutName)) }],
  };
}

/**
 * Every entity key the artifact stands on this layout — the set a citation is resolved against
 * (L-AI-02: sources are resolved against the artifact before a proposal is returned).
 *
 * Scoped to the sheet rather than to the whole artifact: a reading of THIS sheet resting on an
 * entity of another one is evidence for a different sheet, and the keys are the artifact's own
 * either way.
 */
export function citableKeysOn(graph: EntityGraph, layoutName: string): string[] {
  return graph.entities.filter((entity) => entity.space === layoutName).map((entity) => entity.key);
}

/** The sheet's own evidence, in artifact order at every depth. */
function evidenceOn(graph: EntityGraph, layoutName: string): SheetEvidence {
  const standing = graph.entities.filter((entity) => entity.space === layoutName);
  const keys = new Set(standing.map((entity) => entity.key));
  const census: Record<string, number> = {};
  for (const entity of standing) census[entity.type] = (census[entity.type] ?? 0) + 1;

  return {
    layout: { name: layoutName, kind: graph.layouts.find((layout) => layout.name === layoutName)?.kind ?? "paper" },
    entities: standing.filter(said).map((entity) => ({ key: entity.key, type: entity.type, layer: entity.layer, text: (entity.text ?? "").trim(), height: entity.height ?? 0 })),
    // Exploded paint is named by the block it came out of, which is the key a citation of it names.
    derived: graph.derived.filter((record) => record.space === layoutName && said(record)).map((record) => ({ key: record.src, type: record.type, layer: record.layer, text: (record.text ?? "").trim(), height: record.height ?? 0 })),
    blockAttributes: graph.block_attributes.filter((attribute) => keys.has(attribute.src) && attribute.text.trim() !== "").map((attribute) => ({ src: attribute.src, tag: attribute.tag, text: attribute.text.trim(), height: attribute.height })),
    census,
  };
}

/** Does this record carry text a reading could be made out of? Whitespace is not text. */
function said(record: { text?: string }): boolean {
  return (record.text ?? "").trim() !== "";
}
