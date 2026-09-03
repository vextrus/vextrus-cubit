/**
 * The compile-time half of this sweep's acceptance, as conditional types: three criteria are about
 * what `tsc --noEmit` accepts, and a type is not observable through a call. A wrong assertion fails
 * as `TS2344: Type 'false' does not satisfy the constraint 'true'` on the line that names the rule.
 *
 * No error-suppression directive is used or named anywhere in this directory (Q-08): a negative is
 * written as `Expect<Not<Assignable<…>>>`, which needs none.
 *
 * One home for these four operators (B-17): every suite here imports them rather than restating
 * them beside its own assertions.
 */

/** The assertion itself: instantiating it with anything but `true` is the compile error. */
export type Expect<T extends true> = T;

/** Is A assignable to B? Tuple-wrapped so a union in A does not distribute. */
export type Assignable<A, B> = [A] extends [B] ? true : false;

export type Not<T extends boolean> = T extends true ? false : true;

/** Identity of two types, not merely mutual assignability. */
export type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/**
 * Does `Shape` carry exactly `Keys` and no other key? A value-direction assignability check alone
 * is satisfied by `Record<string, …>` and by `any`, so key exactness is asserted in both
 * directions beside it.
 */
export type KeyedExactlyBy<Shape, Keys> = [Exclude<Keys, keyof Shape>] extends [never]
  ? [Exclude<keyof Shape, Keys>] extends [never]
    ? true
    : false
  : false;
