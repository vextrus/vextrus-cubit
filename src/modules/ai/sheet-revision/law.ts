// R-TO-004's revision reading: how current one sheet's issue state is, and how a model's answer is
// read back into one. Pure — it names no store, no clock and no seam, so the same wire answer
// decodes to the same reading forever.
//
// The five LEVELS are this module's own words and they travel ON the request (`./request`), so the
// adapter composes the score's criteria from them without holding a second spelling (B-17, the
// schedule cell's precedent). A level edited here is a different question, which is exactly what it
// should be: the request hash is taken over the content (L-AI-01), so a reworded spectrum earns its
// own fixture rather than replaying an answer given to another one.
//
// Nothing here is a date computation. The levels describe printed SITUATIONS — what the sheet's
// strip states against what its own table's last row states against what the set prints beside it —
// and no ordering, no clock and no calendar arithmetic is derived from the answer.
import type { DecodeResult } from "@/core/model";
import type { ModelId } from "@/core/model-ledger.types";

/** Any JSON value — what a transport carried, before it is read as anything. */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * The model a sheet's issue state is read by. AS-05 pins `claude-sonnet-5` to cheap classification,
 * and choosing one candidate off a sheet's own strip and placing it on a five-level spectrum is
 * exactly that; the Jev call is billed under that pinned id until the owner's amendment lands
 * (`docs/decisions/as-05-jev-amendment.md`), and nothing here adds Jev to AS-05 or invents a rate.
 */
export const REVISION_RECENCY_MODEL: ModelId = "claude-sonnet-5";

/**
 * The spectrum, lowest first. Each level is one concrete situation a reader could check on the paper
 * itself, none overlapping and none naming a degree (docs.typesafe.ai/primitives/score, read
 * 2026-09-22: "Describe situations, not degrees"; "The order of the array is the numbering").
 *
 * Level 0 is reachable and is not the same as a sheet nobody could ask about: a sheet whose only
 * revision evidence is the date its title block files it under prints no revision MARK and no
 * revision ROW, and that is the situation level 0 names. A sheet that prints neither is never asked
 * at all — its only answer would cite nothing, and the seam refuses an uncited reading (L-AI-02).
 */
export const RECENCY_LEVELS: readonly string[] = Object.freeze([
  "The sheet prints no revision mark and no revision row at all, while other sheets of the set print both.",
  "The sheet's revision table ends at a row whose description says the issue was for approval, permit or comment, while other sheets of the set print a later row describing an issue for construction.",
  "The sheet's title-block revision mark names a revision earlier than the last row its own revision table prints — the strip and the table disagree about what this sheet is.",
  "The sheet's revision mark matches the last row of its own revision table, but that row's mark is earlier than the marks the other sheets of the set print.",
  "The sheet's revision mark matches the last row of its own revision table, and that mark is the one the rest of the set prints too.",
]);

/** The highest level of the spectrum, derived from the roster so the two cannot drift. */
export const TOP_LEVEL = RECENCY_LEVELS.length - 1;

/**
 * What one sheet's issue state amounts to, as the model read it: which level of the spectrum the
 * sheet's printed evidence sits at, where on it the answer's own distribution fell, and the words of
 * the candidate the reading was made out of.
 *
 * `level` is a level of `RECENCY_LEVELS` and `score` the position between them; they are two facts
 * about one answer rather than two readings, and a caller showing a person the level shows the
 * sentence `RECENCY_LEVELS[level]` beside it. `evidence` is the candidate's own words, which is what
 * the proposal's source key names — a reading nobody could point at is not one (L-AI-02).
 */
export type RevisionRecency = {
  readonly level: number;
  readonly score: number;
  readonly evidence: string;
};

/** The fields a reading names, sorted — the key set a model's payload must carry, exactly. */
const READING_FIELDS = ["evidence", "level", "score"] as const;

/**
 * A model's payload as a recency reading, or the detail that says why it is not one (L-AI-02: a
 * decoder answers a result and never throws — a throw would be a fault, not a refusal).
 *
 * The key set is exact because the reading is a closed shape: a payload carrying a fourth field is a
 * model answering a question this module did not ask, and one missing a field is a reading with a
 * hole in it. A level outside the spectrum is refused rather than clamped — a clamped level would
 * publish a reading the model did not give — and a blank evidence is refused because a reading whose
 * words nobody can check is not a reading of this sheet.
 */
export function readRevisionRecency(payload: JsonValue): DecodeResult<RevisionRecency> {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, detail: `a revision recency reading is an object naming ${READING_FIELDS.join(", ")}` };
  }
  const named = Object.keys(payload).sort();
  if (named.length !== READING_FIELDS.length || READING_FIELDS.some((field, index) => named[index] !== field)) {
    return { ok: false, detail: `a revision recency reading names exactly ${READING_FIELDS.join(", ")}, and this one names ${named.join(", ") || "nothing"}` };
  }

  const level = payload["level"];
  if (typeof level !== "number" || !Number.isInteger(level) || level < 0 || level > TOP_LEVEL) {
    return { ok: false, detail: `${JSON.stringify(level)} is no level of this spectrum — the levels are 0 to ${TOP_LEVEL}` };
  }

  const score = payload["score"];
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > TOP_LEVEL) {
    return { ok: false, detail: `${JSON.stringify(score)} is no position on this spectrum — a score falls between 0 and ${TOP_LEVEL}` };
  }

  const evidence = payload["evidence"];
  if (typeof evidence !== "string" || evidence.trim() === "") {
    return { ok: false, detail: "a recency reading rests on the words of one candidate the sheet prints, and a blank one states nothing" };
  }

  return { ok: true, value: Object.freeze({ level, score, evidence: evidence.trim() }) };
}
