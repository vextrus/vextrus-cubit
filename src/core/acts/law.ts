// L-ACT-03 as data: the closed permission enum, the roles that bundle it, the act-type enum and the
// total map from an act type to the permission it moves. Nothing here touches a database — the law
// is a value, so the seam's guard, a screen's disclosure and a certificate all read the same one
// (ARCH-02, B-17).

/**
 * The act types the product renders. L-ACT-02 makes the pairs a total map over this enum and "a type
 * without a rendering a compile error", so a member belongs here once — and only once — it has a
 * rendering in `ACT_MAP` and a permission in `ACT_PERMISSION`.
 */
export const ACT_TYPES = ["ASSIGN_PARTICIPANT_ROLE"] as const;

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
  LEAD: Object.freeze(["PIN_SET", "AUTHOR_LEVEL_STACK", "SET_BILL_BOUNDARY", "ADMINISTER_SAMPLE", "SIGN"] as const),
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
