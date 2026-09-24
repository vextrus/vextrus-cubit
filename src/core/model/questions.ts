// The closed questions the product puts to a model, by name (L-AI-01, L-AI-03). A request names
// the one it is, the ledger records it, the calibration line is read per name, and the fixture
// corpus is rostered by it — one spelling, one home (B-17). A question added to the product is one
// line here, its Decision amendment and its recorded corpus; the name is a key for code and a reader,
// never sent to the model, whose question carries its whole meaning in its own instructions.
//
// The name is not hashed into the request's identity: the same evidence asked under a renamed
// question is the same request, and a recorded answer stays filed under the hash it was answered to.

/** The questions, by the key code files them under and the name the ledger records. */
export const MODEL_QUESTIONS = Object.freeze({
  /** A silent sheet's discipline, title and number, as three choices over its own texts (R-AI-001). */
  sheetReading: "sheet-reading",
  /** A silent view caption's class, as one choice over the view vocabulary (R-TO-030). */
  viewCaption: "view-caption",
  /** A contested schedule cell's reading over code-found candidates, and its row's standing (R-TO-031, L-CAD-08). */
  scheduleCell: "schedule-cell",
  /** A general-note clause's detailing class over R-TO-034's closed kinds, and whether its lap governs (R-TO-034). */
  noteClause: "note-clause",
  /** Why one unmeasured cell of the residue stands outside a boundary, over the declarable causes (R-TO-052). */
  coverageCause: "coverage-cause",
  /** A BOQ line's item description, chosen from the catalogue's closed list (L-BD-01, L-AI-03). */
  boqLineDescription: "boq-line-description",
  /** Whether one interpreted outline is the member its mark names, at the size the drawing states (L-QTY-04). */
  outlineCorroboration: "outline-corroboration",
  /** How current a sheet's issue state is, read off its revision marks against its set's (R-TO-004). */
  sheetRevisionRecency: "sheet-revision-recency",
  /** Which intent of S-Ask's roster a question the grammar could not route asks, and which named subject (R-AI-003, I-396). */
  askRoute: "ask-route",
  /** Which room type a room is, where the grammar reads none off its labels (R-TO-036, viewer.md I-688). */
  roomType: "room-type",
} as const);

/** One of the closed names above. */
export type ModelQuestion = (typeof MODEL_QUESTIONS)[keyof typeof MODEL_QUESTIONS];

/** The names, in the order the roster spells them. */
export const MODEL_QUESTION_NAMES: readonly ModelQuestion[] = Object.freeze(Object.values(MODEL_QUESTIONS));

/** Is this a question the product asks? The one predicate, for a request read off a file or a wire. */
export function isModelQuestion(value: unknown): value is ModelQuestion {
  return typeof value === "string" && (MODEL_QUESTION_NAMES as readonly string[]).includes(value);
}
