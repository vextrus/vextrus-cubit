/**
 * The questions J-000's m4-ask-the-drawings leg asks the F-RCC6-BNBC set (docs/design/s-ask.md §6),
 * in one home: the leg asks them in the running product, and the unit lane proves over the J-000
 * read-back that the grammar reads each one as the intent the leg expects — with no model asked, so
 * no recording ties the leg to a register M3 keeps moving (I-680).
 */

/** The storey the leg asks its quantity on — the ground storey the stack's first reading names. */
export const GOLDEN_ASK_STOREY = "GF";

export const GOLDEN_ASK = Object.freeze({
  /** A count, asked from ⌘K: every registered pile cap, in the foundation slot. */
  count: { question: "How many pile caps are there?", intent: "COUNT" },
  /** A quantity by storey: the column concrete on the ground floor's complete lines. */
  storey: { question: `What is the column concrete on ${GOLDEN_ASK_STOREY}?`, intent: "QUANTITY" },
  /** A sheet question: where the column schedule is drawn. */
  sheet: { question: "Which sheet has the column schedule?", intent: "SCHEDULE_SHEET" },
  /** A cost, refused by name. */
  refused: { question: "What will the column concrete cost?", code: "ASK_ESTIMATE_NOT_BUILT" },
} as const);
