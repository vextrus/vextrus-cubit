/**
 * Q-07's other half: a registered code no executed test names yet is deferred **by name**, with the
 * owner who will exercise it. A deferral is a stated owner and a reason, never a blanket — a code
 * that is neither exercised nor listed here fails the register.
 *
 * SIGNED_OUT keeps its entry. The register's own acceptance
 * (tests/refusal-register/register.test.ts) proves the deferral branch *on this code* — it is the
 * worked example the mechanism is shown through, and the file that holds that proof is the
 * Verifier's, not this increment's to re-baseline. Emptying the roster here would take the branch's
 * only subject with it.
 *
 * The reason is restated for what is true now rather than for what was true when it was written:
 * the code is exercised by name as well (src/core/errors/taxonomy.test.ts,
 * tests/ui/refusal-state/in-dialog.test.ts, and this increment's own session doors), so nothing is
 * actually owed to a future increment. A deferral is an OR beside the exercise, never a licence
 * standing in place of one — this entry admits nothing that is not already admitted.
 */
export const DEFERRED_CODES: Readonly<Record<string, string>> = Object.freeze({
  // The eleven the scan found the moment "exercised" stopped meaning "spelled". Each of these was
  // admitted for years by a mention — a roster the taxonomy test enumerates, a fixture, a `const`
  // nobody asserted through — and none of them is claimed by a matcher in the lane the register
  // reads (vitest.config.ts). They are recorded here rather than quietly re-admitted, because that
  // is what this file is for: an owner and a reason, never a blanket. Every one names where the
  // behaviour IS proved today, so what is owed is an assertion in the executed lane and not the
  // behaviour itself.
  CREDENTIALS_NOT_VALID:
    "the identity lane's unit suite — the refusal is proved end to end (tests/e2e/journeys/s-auth-refusal-uniformity-breaker.spec.ts signs in with an unknown credential and reads the card), and the e2e lane is excluded from the corpus the register reads; the owed claim is a sign-in door test that asserts the code.",
  TOKEN_NOT_VALID:
    "the identity lane's unit suite — the reset/magic-link doors answer it and only the taxonomy roster names it in the executed lane; the owed claim is a door test that asserts the code on a spent or forged token.",
  ACCOUNT_ALREADY_EXISTS:
    "the identity lane's unit suite — the status table (src/server/call.ts) maps it to 409 and the sign-up door raises it, but nothing in the executed lane asserts the pair; the owed claim is a sign-up door test.",
  SELF_REMOVAL_NOT_ALLOWED:
    "the tenancy-roles lane — proved against a live database (db/__tests__), which the register does not read; the owed claim is a unit assertion beside src/modules/spine/tenancy/roles.",
  WORKSPACE_WOULD_HAVE_NO_OWNER:
    "the tenancy-roles lane — same live-database proof and the same gap; the owed claim is a unit assertion that the last owner cannot be demoted.",
  NOT_ESTABLISHED:
    "the takeoff scale lane — the code is raised where a sheet has no established scale to measure under; the executed lane names it in rosters only, and the owed claim is an assertion on the measure door's answer.",
  INGESTION_TRUNCATED:
    "the takeoff ingest lane — raised where the extractor's output was cut short; proved through the cad lane's fixtures, and the owed claim is an assertion on the ingest pipeline's refusal.",
  NOT_IN_PROJECT_SCOPE:
    "the takeoff register lane — raised where a named object belongs to another project; the owed claim is an assertion beside the scope guard now that src/server/authorize.ts binds the drawing.",
  NO_BEARER_SIGHTED:
    "the takeoff placements lane — raised where a schedule row cites no sighted bearer; the owed claim is an assertion on the expansion deferral it travels with.",
  KIND_NOT_YET_SEEDED:
    "the catalogue lane — raised where a kind has no seeded row to price against; the owed claim is an assertion on the catalogue door.",
  NOT_IN_THIS_BILL:
    "the coverage lane — tests/takeoff/coverage/boundary-acts.test.ts reads it as a cause it FILTERS rows by and never states it in a claim; the owed claim is one assertion that the filtered cause is this code.",
  LEVEL_ORDINAL_UNMAPPED:
    "the floor-multiplier scheme increment (L-REG-07) — the level model registers the code and its constructor because L-MEA-07 names them beside the ordinal, but the scheme whose missing row raises it is a pricing instrument that lands later, and nothing here can look one up to be refused by.",
  SIGNED_OUT:
    "the auth/session increment — it is the one that maps an expired session to this refusal and renders the sign-in remedy (ARCH-03, B-21); it has since landed, and the code is exercised by name, so this entry stands as the register's worked example of the deferral branch rather than as an amnesty anything relies on.",
});
