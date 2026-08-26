/**
 * Public acceptance for the closed refusal taxonomy (R-SPINE-062, Q-07, ARCH-03, B-21):
 * AC-1, and the transport-vocabulary half of AC-2 (c).
 *
 * The registry is loaded by absolute path rather than by a static specifier — the same contract
 * `src/core/format.test.ts` and `tests/ui/primitives-overlay-data/support` use: a module the
 * product does not provide yet must fail as an assertion naming the file, never as an unreadable
 * resolution error.
 *
 * Nothing here freezes today's roster (B-19). The shape rules are derived by walking whatever the
 * registry holds; only the three codes this increment is required to register, and the two foreign
 * names AC-2 (c) names, are asserted by name. A later increment that adds a code passes this file
 * unchanged — and fails it the moment the new entry breaks a rule.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const ERRORS_MODULE = "src/core/errors.ts";
const VOCABULARY_MODULE = "src/core/errors/transport-vocabulary.ts";

/** The closed sets this increment's spec makes tree law (AC-1). */
const SEVERITIES = ["error", "warning", "info"] as const;
const SURFACES = ["inline", "banner", "dialog"] as const;

/** The codes AC-1 requires the registry to contain — "at least", never "exactly". */
const REQUIRED_CODES = ["PRECISION_NOT_APPLIED", "CHARACTER_NOT_COVERED", "SIGNED_OUT"] as const;

/** The session refusal whose remedy ARCH-03 / B-21 fix as sign-in. */
const SIGNED_OUT = "SIGNED_OUT";

/** The two foreign names AC-2 (c) requires the vocabulary table to declare. */
const FOREIGN_NAMES = ["INTERNAL_SERVER_ERROR", "DATABASE_URL"] as const;

/** Q-07's refusal shape, verbatim from the increment's interfaces. */
const REFUSAL_SHAPE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;

interface RefusalEntryShape {
  code: string;
  message: string;
  remedy: string;
  severity: string;
  surface: string;
}

interface ErrorsModule {
  REFUSALS: Record<string, RefusalEntryShape>;
  refusalOf: (code: string) => RefusalEntryShape;
}

interface VocabularyEntry {
  vocabulary: string;
  codes: readonly string[];
}

interface VocabularyModule {
  TRANSPORT_VOCABULARY: readonly VocabularyEntry[];
}

async function productModule<T>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(
    existsSync(abs) && statSync(abs).isFile(),
    `${relative} is missing from the checkout — the product does not provide it yet`,
  ).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

const loadErrors = (): Promise<ErrorsModule> => productModule<ErrorsModule>(ERRORS_MODULE);
const loadVocabulary = (): Promise<VocabularyModule> => productModule<VocabularyModule>(VOCABULARY_MODULE);

/** Every registered code, read off the registry rather than transcribed (B-19). */
const codesOf = (mod: ErrorsModule): string[] => Object.keys(mod.REFUSALS);

const nonEmpty = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;

describe("AC-1: the closed registry and its lookup", () => {
  test("AC-1: src/core/errors.ts exports REFUSALS and refusalOf", async () => {
    const mod = await loadErrors();
    expect(typeof mod.REFUSALS, "REFUSALS is the registry object (R-SPINE-062)").toBe("object");
    expect(mod.REFUSALS, "REFUSALS is the registry object (R-SPINE-062)").not.toBeNull();
    expect(typeof mod.refusalOf, "refusalOf is the registry's lookup").toBe("function");
    expect(codesOf(mod).length, "a closed taxonomy with no codes registers nothing").toBeGreaterThan(0);
  });

  test("AC-1: every entry's key equals its code and carries message, remedy, severity and surface", async () => {
    const mod = await loadErrors();
    for (const key of codesOf(mod)) {
      const entry = mod.REFUSALS[key] as RefusalEntryShape | undefined;
      expect(entry, `REFUSALS["${key}"] holds an entry`).toBeTruthy();
      const held = entry as RefusalEntryShape;
      expect(held.code, `REFUSALS["${key}"].code equals its key — the registry is keyed by the code itself`).toBe(key);
      expect(REFUSAL_SHAPE.test(key), `"${key}" is refusal-shaped (Q-07's literal shape)`).toBe(true);
      expect(nonEmpty(held.message), `${key} carries a non-empty English message (R-SPINE-062)`).toBe(true);
      expect(nonEmpty(held.remedy), `${key} carries a non-empty remedy hint (R-SPINE-062)`).toBe(true);
      expect(SEVERITIES as readonly string[], `${key}'s severity is drawn from the closed set`).toContain(held.severity);
      expect(SURFACES as readonly string[], `${key}'s surface hint is drawn from the closed set`).toContain(held.surface);
    }
  });

  test("AC-1: refusalOf answers with the registry's own entry for every registered code", async () => {
    const mod = await loadErrors();
    for (const key of codesOf(mod)) {
      expect(mod.refusalOf(key), `refusalOf("${key}") answers the registered entry, not a copy of some other code`).toEqual(
        mod.REFUSALS[key],
      );
    }
  });

  test("AC-1: the registry contains at least the three codes this increment registers", async () => {
    const mod = await loadErrors();
    const registered = codesOf(mod);
    for (const code of REQUIRED_CODES) {
      expect(registered, `${code} is registered by this increment (R-SPINE-062)`).toContain(code);
    }
  });

  test("AC-1: SIGNED_OUT's remedy directs the user to sign in (ARCH-03, B-21)", async () => {
    const mod = await loadErrors();
    const entry = mod.refusalOf(SIGNED_OUT);
    expect(
      /sign[\s-]?in/i.test(entry.remedy),
      `an expired session's remedy is sign-in, not a retry — got "${entry.remedy}" (ARCH-03, B-21)`,
    ).toBe(true);
  });
});

describe("AC-2 (c): the transport-vocabulary table tells foreign from orphan", () => {
  test("AC-2: every declared vocabulary names itself and declares at least one code", async () => {
    const { TRANSPORT_VOCABULARY } = await loadVocabulary();
    expect(Array.isArray(TRANSPORT_VOCABULARY), "TRANSPORT_VOCABULARY is a list of declared vocabularies").toBe(true);
    expect(TRANSPORT_VOCABULARY.length, "a vocabulary table that declares nothing declares no foreign name").toBeGreaterThan(0);
    for (const entry of TRANSPORT_VOCABULARY) {
      expect(nonEmpty(entry.vocabulary), "a declared vocabulary is named — Q-07 asks which foreign vocabulary a name belongs to").toBe(true);
      expect(Array.isArray(entry.codes) && entry.codes.length > 0, `vocabulary "${entry.vocabulary}" declares at least one code`).toBe(true);
      for (const code of entry.codes) {
        expect(nonEmpty(code), `vocabulary "${entry.vocabulary}" declares no empty code`).toBe(true);
      }
    }
  });

  test("AC-2: INTERNAL_SERVER_ERROR and DATABASE_URL are declared foreign, so the scan can never read them as orphans", async () => {
    const { TRANSPORT_VOCABULARY } = await loadVocabulary();
    const declared = new Set(TRANSPORT_VOCABULARY.flatMap((entry) => [...entry.codes]));
    for (const name of FOREIGN_NAMES) {
      expect(
        declared.has(name),
        `${name} is refusal-shaped but foreign — it is declared once in TRANSPORT_VOCABULARY (Q-07), never registered and never an orphan`,
      ).toBe(true);
    }
  });

  test("AC-2: no name is both a registered refusal and a declared foreign code", async () => {
    const mod = await loadErrors();
    const { TRANSPORT_VOCABULARY } = await loadVocabulary();
    const registered = new Set(codesOf(mod));
    for (const entry of TRANSPORT_VOCABULARY) {
      for (const code of entry.codes) {
        expect(
          registered.has(code),
          `"${code}" is declared foreign by vocabulary "${entry.vocabulary}" and also registered as a refusal — the scan could not tell "foreign, declared" from a refusal (Q-07)`,
        ).toBe(false);
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * inc-009 (the identity core): the four codes the auth doors answer with.
 *
 * B-20 — this increment changes taxonomy law, so it owns the acceptance the old law froze. The
 * expected copy is not transcribed here: it is read out of the Decision that fixes it
 * (docs/design/s-auth.md § 3), so the registry and the Decision cannot drift apart, and a later
 * Decision that re-baselines a line re-baselines this assertion with it (B-19, B-20).
 * ------------------------------------------------------------------ */

/** The Decision this increment commits, whose § 3 table fixes the new entries verbatim. */
const S_AUTH_DECISION = "docs/design/s-auth.md";

/** The four codes AC-2 requires this increment to register. */
const AUTH_CODES = ["CREDENTIALS_NOT_VALID", "TOKEN_NOT_VALID", "RATE_LIMITED", "ACCOUNT_ALREADY_EXISTS"] as const;

interface DecidedEntry {
  code: string;
  severity: string;
  surface: string;
  message: string;
  remedy: string;
}

/** Strip a markdown cell down to its text: the Decision bolds the copy it fixes. */
const cellText = (cell: string): string => cell.trim().replace(/^\*\*/, "").replace(/\*\*$/, "").trim();

/** Every refusal the Decision's registry table fixes — derived from the document, never listed. */
function decidedRefusals(): DecidedEntry[] {
  const path = join(REPO_ROOT, S_AUTH_DECISION);
  expect(existsSync(path), `${S_AUTH_DECISION} is committed by this increment — it is the Decision these entries are read from (B-20)`).toBe(true);
  const decided: DecidedEntry[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed.replace(/^\|/, "").replace(/\|$/, "").split("|").map(cellText);
    if (cells.length !== 5) continue;
    const [code, severity, surface, message, remedy] = cells;
    if (code === undefined || !REFUSAL_SHAPE.test(code)) continue;
    decided.push({ code, severity: severity ?? "", surface: surface ?? "", message: message ?? "", remedy: remedy ?? "" });
  }
  return decided;
}

describe("AC-2 (inc-009): the four codes the identity core registers", () => {
  test("AC-2: every code the Decision fixes is registered with exactly the decided message, remedy, severity and surface", async () => {
    const mod = await loadErrors();
    const decided = decidedRefusals();
    // The reading is checked before it is trusted: a table this file failed to parse would assert
    // nothing at all, and pass while the registry drifted.
    const read = decided.map((entry) => entry.code);
    for (const code of AUTH_CODES) {
      expect(read, `${code}'s entry is fixed by ${S_AUTH_DECISION} § 3 — the table read: ${read.join(", ") || "no rows"}`).toContain(code);
    }
    for (const entry of decided) {
      expect(codesOf(mod), `${entry.code} is registered in src/core/errors.ts (R-SPINE-062, AC-2)`).toContain(entry.code);
      const held = mod.refusalOf(entry.code);
      expect(held.message, `${entry.code}'s message is the one ${S_AUTH_DECISION} § 3 decided`).toBe(entry.message);
      expect(held.remedy, `${entry.code}'s remedy is the one ${S_AUTH_DECISION} § 3 decided`).toBe(entry.remedy);
      expect(held.severity, `${entry.code}'s severity is the one ${S_AUTH_DECISION} § 3 decided`).toBe(entry.severity);
      expect(held.surface, `${entry.code}'s surface is the one ${S_AUTH_DECISION} § 3 decided`).toBe(entry.surface);
    }
  });
});
