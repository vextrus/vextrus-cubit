/**
 * The closed vocabulary the act seam cuts on (L-ACT-02, L-ACT-03, Q-07).
 *
 * Three tables and two derivations, and the shape of all five is decided by one hazard: Q-07's
 * refusal register reads every screaming-snake string literal under `src/` as a refusal code, so
 * a permission spelled in quotes anywhere outside `src/core/errors/` is an orphan and reddens
 * `pnpm verify`. Every name here is therefore an *unquoted identifier key* on a frozen table,
 * every type is derived from the table with `keyof typeof`, and every place that needs a name as
 * a value takes it from `names()` — which builds `{ K: K }` from the keys rather than repeating
 * them. Nothing in this file, or in anything above it, spells one.
 *
 * Frozen, not merely `readonly`: closed is a property of the vocabulary at runtime. A `readonly`
 * that vanishes at compile time still lets an importer add a permission to a role.
 */

/**
 * The names of a table's own keys, as values: `names(PERMISSIONS).ADMINISTER_PROJECT` is the
 * string `ADMINISTER_PROJECT`, arrived at without anybody writing it down twice.
 */
function names<T extends object>(table: T): { readonly [K in keyof T]: K } {
  const built = Object.fromEntries(Object.keys(table).map((key) => [key, key]));
  return Object.freeze(built) as { readonly [K in keyof T]: K };
}

/**
 * L-ACT-03's permission enum, in the clause's own order: "a closed permission enum cuts on what
 * an act moves". Thirteen, including the three the book, estimate and bid modules will need —
 * the clause names them, so the enum carries them, and it is the act types that arrive later.
 *
 * The value of each entry is `true` and carries no meaning of its own: the table is a set, and
 * what it says is which names are in it.
 */
export const PERMISSIONS = Object.freeze({
  PIN_SET: true,
  AUTHOR_LEVEL_STACK: true,
  AUTHOR_PROJECT_FACT: true,
  MEASURE: true,
  SET_BILL_BOUNDARY: true,
  ADMINISTER_SAMPLE: true,
  ENTER_BLIND_FIGURE: true,
  REVIEW: true,
  SIGN: true,
  ADMINISTER_PROJECT: true,
  ADMINISTER_BOOK: true,
  PRICE: true,
  BID: true,
} as const);

/** The closed enum, derived from the table so a permission cannot exist as a type alone. */
export type Permission = keyof typeof PERMISSIONS;

/** Each permission's own name as a value — the only lawful way to *mention* one. */
export const PERMISSION = names(PERMISSIONS);

/** What a role bundles: a set of permissions, written as a table for the same reason. */
export type PermissionBundle = Readonly<Partial<Record<Permission, boolean>>>;

/**
 * One bundle, frozen. The parameter's type is what makes a typo a compile error rather than a
 * role that quietly holds a permission nobody named: a key that is not a `Permission` is an
 * excess property on the literal and does not fit.
 */
function bundle(permissions: PermissionBundle): PermissionBundle {
  return Object.freeze(permissions);
}

/**
 * L-ACT-03's six roles, verbatim: "Roles bundle permissions and are the only thing a human
 * picks." PRINCIPAL is "all" — the permission table itself, copied, so a permission added to the
 * enum is one PRINCIPAL holds without an edit here.
 *
 * "No shipped role bundles two permissions the law holds apart": MEASURER measures and authors
 * the project facts a measurement needs, REVIEWER only reviews, LEAD moves the things a
 * measurer's work is bounded by and signs, and the two commercial roles are separate again.
 */
export const ROLE_BUNDLES = Object.freeze({
  MEASURER: bundle({ MEASURE: true, AUTHOR_PROJECT_FACT: true, ENTER_BLIND_FIGURE: true }),
  REVIEWER: bundle({ REVIEW: true }),
  LEAD: bundle({
    PIN_SET: true,
    AUTHOR_LEVEL_STACK: true,
    SET_BILL_BOUNDARY: true,
    ADMINISTER_SAMPLE: true,
    SIGN: true,
  }),
  ESTIMATOR: bundle({ PRICE: true }),
  BID_MANAGER: bundle({ BID: true }),
  PRINCIPAL: bundle({ ...PERMISSIONS }),
});

export type Role = keyof typeof ROLE_BUNDLES;

/** Each role's own name as a value. */
export const ROLE = names(ROLE_BUNDLES);

/**
 * The act types the tree can perform. M0 carries one — L-ACT-03's "ADMINISTER_PROJECT
 * (ASSIGN_PARTICIPANT_ROLE)" — and every later increment founds its own here, where the two
 * total maps beside it force it to answer for the new member.
 */
export const ACT_TYPES = Object.freeze({
  ASSIGN_PARTICIPANT_ROLE: true,
} as const);

export type ActType = keyof typeof ACT_TYPES;

/** Each act type's own name as a value. */
export const ACT_TYPE = names(ACT_TYPES);

/**
 * L-ACT-03: "A total map act type → permission sits beside the total act map."
 *
 * `satisfies` and not an annotation: `const m: Record<ActType, Permission>` would type-check
 * while widening the value's own type, so the map would stop being the closed thing it is and a
 * reader could no longer see which permission an act type needs from its type alone. As written,
 * an act type with no entry is a compile error and the entry's type is the permission itself.
 */
export const ACT_PERMISSIONS = {
  ASSIGN_PARTICIPANT_ROLE: PERMISSION.ADMINISTER_PROJECT,
} satisfies Record<ActType, Permission>;

/** Whether a role's bundle carries a permission — the whole of the permission check's arithmetic. */
export function roleHolds(role: Role, permission: Permission): boolean {
  return ROLE_BUNDLES[role][permission] === true;
}

/** Whether a string names a role, narrowing it when it does. */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && Object.hasOwn(ROLE_BUNDLES, value);
}

/** Whether a string names an act type, narrowing it when it does. */
export function isActType(value: unknown): value is ActType {
  return typeof value === 'string' && Object.hasOwn(ACT_TYPES, value);
}
