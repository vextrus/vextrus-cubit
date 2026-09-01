/**
 * AC-3, the half the refusal registry answers for: the four entries this increment appends to
 * src/core/errors.ts, each with copy a person can act on.
 *
 * It sits beside the module rather than in the database lane on purpose. Q-07's register
 * (tests/refusal-register/register.test.ts) reads its corpus of "executed tests that name a code"
 * from `src/` and `tests/` only, so a registered code named nowhere but `db/__tests__` is a code
 * the register reports as unexercised. AC-3 says each of the four is "named by an executed test":
 * this is that test, and the live behaviour each code answers for is proved in
 * db/__tests__/tenancy-roles.law.live.test.ts (the seam) and against the wire beside it.
 *
 * B-19: the roster is not frozen anywhere. Every question below is asked of whatever `REFUSALS`
 * holds, so a code a later increment registers is judged by the same rules without an edit here —
 * the only four spelled are the four this increment's criterion names, which is the point of the
 * file.
 */
import { describe, expect, it } from "vitest";
import { REFUSALS } from "../../../../core/errors";

/** The four entries AC-3 appends. Each is a literal the increment spec states in public (B-12). */
const WORKSPACE_PERMISSION_NOT_HELD = "WORKSPACE_PERMISSION_NOT_HELD";
const SELF_REMOVAL_NOT_ALLOWED = "SELF_REMOVAL_NOT_ALLOWED";
const WORKSPACE_WOULD_HAVE_NO_OWNER = "WORKSPACE_WOULD_HAVE_NO_OWNER";
const ORIGIN_NOT_VERIFIED = "ORIGIN_NOT_VERIFIED";

const APPENDED: readonly string[] = [WORKSPACE_PERMISSION_NOT_HELD, SELF_REMOVAL_NOT_ALLOWED, WORKSPACE_WOULD_HAVE_NO_OWNER, ORIGIN_NOT_VERIFIED];

/** The registry as a plain bag, so a code that is not yet registered is a missing entry and not a type error. */
const registry = REFUSALS as unknown as Readonly<Record<string, { code: string; message: string; remedy: string; severity: string; surface: string }>>;

describe("AC-3: the four refusal entries this increment appends", () => {
  for (const code of APPENDED) {
    it(`AC-3: ${code} is registered with a message and a remedy`, () => {
      const entry = registry[code];
      expect(entry, `${code} must be registered in src/core/errors.ts — the taxonomy is closed, so a code that is not there does not exist (R-SPINE-062, B-06)`).toBeDefined();
      expect(entry?.code, `${code}'s entry must carry its own key as its code, so a seam can read the value off the register instead of re-spelling it (Q-07)`).toBe(code);
      expect((entry?.message ?? "").trim(), `${code} must carry a non-empty message — what was refused, in one sentence a person reads`).not.toBe("");
      expect((entry?.remedy ?? "").trim(), `${code} must carry a non-empty remedy — the sentence that says what resolves it`).not.toBe("");
    });
  }

  it("AC-3: the appended entries obey the same shape as every other entry in the register", () => {
    // The shape is derived from the entries the register already holds rather than transcribed:
    // whatever severities and surfaces the taxonomy uses today are what a new entry may use, so a
    // later increment that widens either is not fought by this file (B-19).
    const codes = Object.keys(registry);
    const severities = new Set(codes.map((code) => registry[code]?.severity ?? ""));
    const surfaces = new Set(codes.map((code) => registry[code]?.surface ?? ""));

    for (const code of APPENDED) {
      const entry = registry[code];
      expect(entry, `${code} is not registered, so its shape cannot be judged`).toBeDefined();
      expect([...severities], `${code}'s severity must be one the register already uses`).toContain(entry?.severity ?? "");
      expect([...surfaces], `${code}'s surface must be one the register already uses`).toContain(entry?.surface ?? "");
    }
  });

  it("AC-3: exactly these four are appended — the increment adds no fifth code of its own", () => {
    // Stated as a rule about THIS node's four rather than as a frozen roster of the register: the
    // register may hold any number of codes, and every one of the four named above must be in it.
    const registered = Object.keys(registry);
    for (const code of APPENDED) {
      expect(registered, `${code} is one of the four entries AC-3 appends`).toContain(code);
    }
    expect(new Set(APPENDED).size, "the four appended codes are four distinct codes").toBe(APPENDED.length);
  });
});
