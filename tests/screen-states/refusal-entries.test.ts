/**
 * The drift guard on `src/ui/screen-states/refusal-entries.ts`. ARCH-01 forbids `src/ui` a value
 * import of `src/core`, so the register's entries are authored there as data — which makes them a
 * second copy of sentences whose home is `REFUSALS` (B-17). Nothing in the product can bind the two,
 * because binding them is the import ARCH-01 refuses; a test is under no such rule, so the binding
 * lives here: every field of every declared entry is compared to the register's own entry, and a
 * message or remedy edited in `src/core/errors.ts` reds this file instead of quietly leaving the
 * screens showing a stale sentence.
 *
 * The codes are read from the declaration, never listed here — a code added to or dropped from the
 * declaration is graded by the same comparison without an edit (B-19).
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import type { RefusalCode } from "../../src/core/errors";
import { REFUSAL_ENTRIES } from "../../src/ui/screen-states/refusal-entries";

/** Every field of an entry — the whole record, so a field added to the register is compared too. */
const FIELDS = ["code", "message", "remedy", "severity", "surface"] as const;

describe("B-17: the declared refusal entries are the register's, field for field", () => {
  test("every declared code is one the register owns", () => {
    const declared = Object.keys(REFUSAL_ENTRIES);
    expect(declared.length, "there is an entry to grade").toBeGreaterThan(0);
    for (const code of declared) {
      expect(Object.keys(REFUSALS), `${code} is registered`).toContain(code);
    }
  });

  test("each declared entry carries the register's own message, remedy, severity and surface", () => {
    for (const code of Object.keys(REFUSAL_ENTRIES) as RefusalCode[]) {
      const declared = REFUSAL_ENTRIES[code as keyof typeof REFUSAL_ENTRIES];
      const registered = REFUSALS[code];
      expect(registered, `${code} is registered`).toBeDefined();
      for (const field of FIELDS) {
        expect(declared[field], `${code}.${field} is the register's`).toBe(registered[field]);
      }
      expect(declared.code, `${code} is filed under its own code`).toBe(code);
    }
  });

  test("no field of a registered entry escapes the comparison", () => {
    for (const code of Object.keys(REFUSAL_ENTRIES) as RefusalCode[]) {
      const registeredFields = Object.keys(REFUSALS[code]).toSorted();
      expect(registeredFields, `${code}'s fields are all compared above`).toEqual([...FIELDS].toSorted());
    }
  });
});
