/**
 * Q-07's other half: a registered code no executed test names yet is deferred **by name**, with the
 * owner who will exercise it. A deferral is a stated owner and a reason, never a blanket — a code
 * that is neither exercised nor listed here fails the register.
 */
export const DEFERRED_CODES: Readonly<Record<string, string>> = Object.freeze({
  DETAIL_NOT_GIVEN:
    "the identity lane — spine.auth's creating doors (signUp, resetPassword) answer it for a field that arrives blank, and the seam refuses a whitespace-only workspace name with it (R-SPINE-002, R-SPINE-062). Every door that raises it needs a live database and a real request, so the proofs walk it in the database suite and in journey J-001a; neither lane is collected by the unit lane that asks this question, so the deferral is what admits the code here and names where it is exercised.",
  SIGNED_OUT:
    "the identity lane — spine.auth's signed-in doors raise it for a missing, unknown or revoked session and the sign-in remedy renders from the register (ARCH-03, B-21). The proofs that walk that refusal live in the database suite and in journey J-001a, neither of which the unit lane collects, so the deferral is what admits the code here and names where it is actually exercised.",
});
