// L-ACT-03 as data: the closed permission enum, the roles that bundle it, the act-type enum and the
// total map from an act type to the permission it moves. Nothing here touches a database — the law
// is a value, so the seam's guard, a screen's disclosure and a certificate all read the same one
// (ARCH-02, B-17).

/**
 * The act types the product renders. L-ACT-02 makes the pairs a total map over this enum and "a type
 * without a rendering a compile error", so a member belongs here once — and only once — it has a
 * rendering in `ACT_MAP` and a permission in `ACT_PERMISSION`.
 */
export const ACT_TYPES = [
  "ASSIGN_PARTICIPANT_ROLE",
  "CONFIRM_DISCIPLINE",
  "CONFIRM_VIEW_TYPE",
  "PIN_DRAWING_SET",
  "AFFIRM_SCALE",
  "INSERT_LEVEL",
  "REPUDIATE_LEVEL",
  "AUTHOR_STOREY_HEIGHT",
  "AUTHOR_TYPICAL_RANGE",
  "TRANSCRIBE_SHEET_NOTES",
  "CORROBORATE",
  "REPUDIATE",
  "HOLD_OUT_OF_BILL",
  "DECLARE_NOT_IN_PROJECT_SCOPE",
  // AM-04: minting a new immutable rule-set edition for a project. L-MEA-01's "authoring mints a
  // new edition, never updates one, and is its own permission" is what makes it an act type of its
  // own rather than a shape of ADMINISTER_PROJECT.
  "AUTHOR_RULESET_EDITION",
  // AM-06 §1: entering a site fact — a reading no drawing carries — is a human write that changes
  // what the machine would derive, so it is an act type of its own; the permission it moves is the
  // project-fact one L-ACT-03 already cuts, and no new permission is minted for it.
  "AUTHOR_SITE_FACT",
] as const;

/** One act type, drawn from the enum above. */
export type ActType = (typeof ACT_TYPES)[number];

/** L-ACT-03's closed permission enum, in the order the clause cuts it — on what an act moves. */
export const PERMISSIONS = [
  "PIN_SET",
  "AUTHOR_LEVEL_STACK",
  "AUTHOR_PROJECT_FACT",
  "MEASURE",
  "SET_BILL_BOUNDARY",
  "ADMINISTER_SAMPLE",
  "ENTER_BLIND_FIGURE",
  "REVIEW",
  "SIGN",
  "ADMINISTER_PROJECT",
  "ADMINISTER_BOOK",
  "PRICE",
  "BID",
  // AM-04 cuts this one beside the twelve: authoring a rule-set edition is its own permission
  // (L-MEA-01), and authoring a rate library's parameter values stays ADMINISTER_BOOK.
  "AUTHOR_RULE_SET",
] as const;

/** One permission, drawn from the closed enum above. */
export type Permission = (typeof PERMISSIONS)[number];

/** L-ACT-03's shipped roles — "roles bundle permissions and are the only thing a human picks". */
export const ROLES = ["MEASURER", "REVIEWER", "LEAD", "ESTIMATOR", "BID_MANAGER", "PRINCIPAL"] as const;

/** One role, drawn from the closed enum above. */
export type Role = (typeof ROLES)[number];

/**
 * L-ACT-03: "A total map act type → permission sits beside the total act map." Keyed by the enum
 * itself, so an act type that moves nothing anyone can hold does not compile.
 */
export const ACT_PERMISSION: Readonly<Record<ActType, Permission>> = Object.freeze({
  ASSIGN_PARTICIPANT_ROLE: "ADMINISTER_PROJECT",
  // L-REG-03: an unconfirmed drawing is not walked, so confirming a sheet's discipline is what a
  // person does before they may measure it — the same permission the measuring itself moves.
  CONFIRM_DISCIPLINE: "MEASURE",
  // L-CAD-06: what a view IS decides what may be measured off it — only a layout-plan-class view
  // yields instances — so confirming a class a model proposed is what a person does before they may
  // measure it, and it moves the permission the measuring itself moves.
  CONFIRM_VIEW_TYPE: "MEASURE",
  // L-ACT-03 cuts PIN_SET on exactly this: "PIN_SET (PIN_DRAWING_SET, REPIN_DRAWING_SET)".
  PIN_DRAWING_SET: "PIN_SET",
  // L-MEA-05: a view no act names measures nothing, so affirming what a drawing measures in is what
  // a person does before anything is measured off it — it moves the permission the measuring moves.
  AFFIRM_SCALE: "MEASURE",
  // L-ACT-03 cuts AUTHOR_LEVEL_STACK on exactly this: "AUTHOR_LEVEL_STACK (INSERT_LEVEL,
  // REPUDIATE_LEVEL)". Authoring the stack is not measuring — an ordinal is what the register keys
  // to and what the floor-multiplier scheme prices off (L-MEA-07) — so the LEAD holds it.
  INSERT_LEVEL: "AUTHOR_LEVEL_STACK",
  REPUDIATE_LEVEL: "AUTHOR_LEVEL_STACK",
  // L-ACT-03 cuts AUTHOR_PROJECT_FACT on "AUTHOR_STOREY_HEIGHT and later project facts": a storey
  // height is a correctable attribute of the project, read rather than authored into identity
  // (L-REG-02), and the MEASURER who reads a drawing is who states it.
  AUTHOR_STOREY_HEIGHT: "AUTHOR_PROJECT_FACT",
  // AM-06 §1, verbatim: the act "enters under the existing AUTHOR_PROJECT_FACT permission (no new
  // permission)". A site fact is one of L-ACT-03's "later project facts" — a reading about the
  // project that no drawing carries — so the MEASURER who reads the site states it.
  AUTHOR_SITE_FACT: "AUTHOR_PROJECT_FACT",
  // L-ACT-03 cuts MEASURE on exactly this: "MEASURE (… AUTHOR_TYPICAL_RANGE …)". Stating which
  // floors a typical plan is typical of is a reading of the drawing — it registers the members on
  // every floor of the range (L-CAD-07) — so it moves the permission the measuring itself moves.
  AUTHOR_TYPICAL_RANGE: "MEASURE",
  // L-ACT-03 cuts MEASURE on exactly this: "MEASURE (… TRANSCRIBE_SHEET_NOTES …)". Reading the
  // detailing figures off a sheet's general notes is a reading of the drawing — the figures reach
  // every bar the bill carries (AM-03) — so it moves the permission the measuring itself moves.
  TRANSCRIBE_SHEET_NOTES: "MEASURE",
  // R-TO-051: a reading recorded against a register object, and a judgement that an object is
  // nothing, are both readings of what was measured off the drawing — so both move the permission
  // the measuring itself moves.
  CORROBORATE: "MEASURE",
  REPUDIATE: "MEASURE",
  // L-ACT-03 cuts SET_BILL_BOUNDARY on exactly this: "SET_BILL_BOUNDARY (HOLD_OUT_OF_BILL)".
  HOLD_OUT_OF_BILL: "SET_BILL_BOUNDARY",
  // The clause's enum is closed and names only the hold there, but declaring a kind outside the
  // project is the same boundary decision over the same cell on L-QTY-05's other axis — what this
  // project's certificate speaks about — so it moves the permission the hold moves rather than a
  // fourteenth the law does not cut.
  DECLARE_NOT_IN_PROJECT_SCOPE: "SET_BILL_BOUNDARY",
  // AM-04, verbatim: AUTHOR_RULE_SET "carrying the act type AUTHOR_RULESET_EDITION". The amendment
  // replaces the staged reading that moved this act under ADMINISTER_PROJECT.
  AUTHOR_RULESET_EDITION: "AUTHOR_RULE_SET",
});

/**
 * The bundles, exactly as L-ACT-03 fixes them: "No shipped role bundles two permissions the law
 * holds apart", and ADMINISTER_PROJECT is deliberately PRINCIPAL-only so "a project holds at least
 * one PRINCIPAL at every moment" stays load-bearing. PRINCIPAL is derived from the enum rather than
 * listed — the law says "all", and "all" has to keep meaning all as the enum is cut wider.
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = Object.freeze({
  MEASURER: Object.freeze(["MEASURE", "AUTHOR_PROJECT_FACT", "ENTER_BLIND_FIGURE"] as const),
  REVIEWER: Object.freeze(["REVIEW"] as const),
  // AM-04 bundles AUTHOR_RULE_SET "into LEAD and PRINCIPAL and into no other shipped role" —
  // PRINCIPAL takes it by holding all, so LEAD is the one bundle that names it.
  LEAD: Object.freeze(["PIN_SET", "AUTHOR_LEVEL_STACK", "SET_BILL_BOUNDARY", "ADMINISTER_SAMPLE", "SIGN", "AUTHOR_RULE_SET"] as const),
  ESTIMATOR: Object.freeze(["PRICE"] as const),
  BID_MANAGER: Object.freeze(["BID"] as const),
  PRINCIPAL: PERMISSIONS,
});

/** Is this string one of the roles the law declares? A grant naming anything else bundles nothing. */
export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Every permission a set of held roles bundles together (L-ACT-03: roles are what a human picks). */
export function permissionsOf(roles: Iterable<Role>): ReadonlySet<Permission> {
  const held = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) held.add(permission);
  }
  return held;
}
