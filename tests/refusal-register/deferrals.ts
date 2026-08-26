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
  SIGNED_OUT:
    "the auth/session increment — it is the one that maps an expired session to this refusal and renders the sign-in remedy (ARCH-03, B-21); it has since landed, and the code is exercised by name, so this entry stands as the register's worked example of the deferral branch rather than as an amnesty anything relies on.",
});
