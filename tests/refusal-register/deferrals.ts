/**
 * Q-07's other half: a registered code no executed test names yet is deferred **by name**, with the
 * owner who will exercise it. A deferral is a stated owner and a reason, never a blanket — a code
 * that is neither exercised nor listed here fails the register.
 */
export const DEFERRED_CODES: Readonly<Record<string, string>> = Object.freeze({
  SIGNED_OUT:
    "the identity lane, which has landed — spine.auth's signed-in doors raise it for a missing, unknown or revoked session, and db/__tests__/auth-door.test.ts and journey J-001a walk that refusal end to end. Nothing is owed here any more: the unit lane already names the code too (src/core/errors/taxonomy.test.ts, tests/ui/refusal-state/in-dialog.test.ts), so the exercise branch is what admits it on this tree and this entry admits nothing. It stays because the register's own AC-2 (d) test names SIGNED_OUT as the code that proves the deferral branch works at all (tests/refusal-register/register.test.ts) — asked of a corpus that names nothing, this is the entry that answers. Removing it is that test's to allow, not this file's.",
});
