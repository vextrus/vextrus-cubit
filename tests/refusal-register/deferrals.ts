/**
 * Q-07's other half: a registered code no executed test names yet is deferred **by name**, with the
 * owner who will exercise it. A deferral is a stated owner and a reason, never a blanket — a code
 * that is neither exercised nor listed here fails the register.
 */
export const DEFERRED_CODES: Readonly<Record<string, string>> = Object.freeze({
  SIGNED_OUT:
    "the auth/session increment — it is the one that maps an expired session to this refusal and renders the sign-in remedy (ARCH-03, B-21); until it lands, no flow can raise a session refusal to exercise.",
});
