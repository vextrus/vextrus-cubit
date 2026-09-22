// What a contested schedule cell may be read AS, and nothing else (R-TO-031, L-AI-03).
//
// The roster is closed and it is CODE's, not the model's: a model asked about a cell chooses one of
// the readings the notation grammar already found for it, or says the cell states none. So the seven
// sentences below are the whole vocabulary an answer can come back in — a reading outside them is
// MALFORMED at the seam rather than stored (L-AI-02).
//
// It lives beside the candidates rather than in `@/core/model`: the attributes are the notation
// grammar's own kinds folded onto what a schedule states about a member, and the grammar is this
// module's (ARCH-01 lets core name neither). The adapter is told each candidate's sentence ON the
// request instead of spelling it a second time, so this file is the one home of the words (B-17).
//
// Pure: no store, no clock, no model.

/**
 * The attributes a schedule cell can state about the member its row names. Closed: a schedule says
 * what the member IS, never how many stand (L-CAD-08, I-251), so nothing here is a count.
 */
export const CELL_ATTRIBUTES = ["section", "main", "ties", "ties-end", "ties-mid", "band", "mark"] as const;

/** One of the seven. */
export type CellAttribute = (typeof CELL_ATTRIBUTES)[number];

/**
 * What each attribute MEANS, in the words the question carries. They travel on the request so the
 * adapter composes `"<the cell's own words>" — <the sentence>` without holding a second spelling of
 * this roster; a sentence edited here is a different question, which is exactly what it should be
 * (the request hash is taken over the content, L-AI-01).
 */
export const CELL_ATTRIBUTE_MEANS: Readonly<Record<CellAttribute, string>> = Object.freeze({
  section: "the member's section: its width by depth, or the size this schedule states for it",
  main: "the member's main reinforcement: the group of longitudinal bars",
  ties: "the member's ties or stirrups: the bar and the spacing it is set at",
  "ties-end": "the ties in the END zone, where the schedule states two spacings",
  "ties-mid": "the ties in the MIDDLE zone, where the schedule states two spacings",
  band: "the band of floors this row's reading is carried over",
  mark: "the member's own mark: what this row names",
});

/**
 * How many readings of ONE cell are offered. A cell of a structural schedule states one thing, two
 * where a draughtsman stacked two texts, and a cell the grammar found a dozen readings of is a cell
 * nobody should be asked about — the cap is a bound on the question, never a silent truncation of an
 * answer (the sheet reading's `CANDIDATE_CAP` for the same reason).
 */
export const CANDIDATE_CAP = 12;

/**
 * How many cells of one row are put in one request. The row's noul rides with them, so a row is one
 * question set and one ledger row however wide the schedule is drawn.
 */
export const CONTESTED_CELL_CAP = 8;

/**
 * The probability at or above which a row's header judgment is worth showing a reader at all. A Noul
 * near 0.5 says nothing a person can use (docs.typesafe.ai/primitives/noul), and this is the ONE
 * threshold the product applies — presentational, and never on the write path: every proposal is
 * offered for disposition whatever its confidence, because abstention is the caller's decision and
 * not the seam's (L-AI-02).
 *
 * Provisional at 0.5 and moved only on the recorded corpus, never on a hunch.
 */
export const HEADER_SHOWN_AT = 0.5;
