/**
 * AC-4(d) — the compile-time half of the input narrowing.
 *
 * `assignRoleInput` and `removeMemberInput` read a body through the module's own
 * `tenancyMutationFrom` and then narrow it BY KIND, so a mutation's resolver is handed the move it
 * dispatches and not the union of both. That is a statement about types, so it is proved where types
 * are checked: this file is a `.ts` (never a `.tsx`) so `tsc --noEmit` reaches it, and it carries no
 * suppression directive — a failed proof is a compile error, which is the whole point.
 *
 * The runtime half — what the readers actually return — is in tenancy-gate.test.ts.
 */
import type { assignRoleInput, removeMemberInput } from "../../src/server/routers/tenancy";

/** Exact type equality: two types that are mutually assignable can still differ, and this tells them apart. */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** A proof obligation: only `true` satisfies it, so a widened return type fails to compile. */
type Expect<T extends true> = T;

export type AssignRoleInputIsNarrowedToItsKind = Expect<Equal<ReturnType<typeof assignRoleInput>["kind"], "assignRole">>;

export type RemoveMemberInputIsNarrowedToItsKind = Expect<Equal<ReturnType<typeof removeMemberInput>["kind"], "removeMember">>;
