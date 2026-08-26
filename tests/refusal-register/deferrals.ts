/**
 * Q-07's other half: a registered code no executed test names yet is deferred **by name**, with the
 * owner who will exercise it. A deferral is a stated owner and a reason, never a blanket — a code
 * that is neither exercised nor listed here fails the register.
 *
 * The roster is empty today, and an empty roster is the healthy state: every code the taxonomy
 * holds is named by an executed test, so nothing is owed to a future increment. SIGNED_OUT stood
 * here until this increment — the one its own text named as owner — landed, and a deferral whose
 * named owner has already shipped can never be cleared by anyone, so the amnesty would have been
 * permanent. It is gone because the code is exercised by name now (src/core/errors/taxonomy.test.ts,
 * tests/ui/refusal-state/in-dialog.test.ts), and because R-SPINE-007 makes it live from the first
 * server increment — it may never be deferred again. The deferral branch itself stays proved:
 * register.test.ts exercises it on a corpus it supplies, so no code need be parked here to keep the
 * mechanism honest (B-19).
 */
export const DEFERRED_CODES: Readonly<Record<string, string>> = Object.freeze({});
