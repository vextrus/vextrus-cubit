/**
 * The notation grammar against the fixture's OWN corpus (R-TO-031, L-CAD-08): every string F-RCC6-BNBC
 * draws — 3,102 of them, sheet by sheet — read by the product's parser and judged against the family
 * the fixture declared when it drew it.
 *
 * Why this suite and not the GRAMMAR table alone: the table is what its author had SEEN, and an author
 * writes the shape he remembers. The corpus is what a set actually carries. Run for the first time,
 * it found 308 strings the table could not read and 89 it read wrongly — a fifth of the mark roster
 * missing from every bill, and a phantom member minted off the title block of all 27 sheets.
 *
 * A string may end in one of three places and nowhere else:
 *   READ    — it reads as the question its family asks, and states the figure the fixture authored;
 *   TRAP    — it is a registered trap of `fixtures/rcc6-bnbc/traps.json`, which says how it reads;
 *   ALLOWED — `corpus-allow.json` names it and says WHY it is not read yet.
 * The allowlist is a debt, not a licence: this suite freezes its size, so it can only shrink. An
 * entry nothing uses fails too, so a form that learns to read a string cannot leave its excuse behind.
 *
 * Nothing here opens a store, a clock or a model: the grammar is total over strings.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { readNotation, type NotationKind } from "@/modules/takeoff/partition/notation/grammar";

type Entry = {
  readonly sheet: string;
  readonly raw: string;
  readonly family: string;
  readonly fact: null | Record<string, string>;
  readonly trap: string | null;
};
type Allowance = { readonly raw: string; readonly family: string; readonly why: string };

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const corpus = read("../../../fixtures/rcc6-bnbc/notation.corpus.json") as { strings: readonly Entry[] };
const traps = read("../../../fixtures/rcc6-bnbc/traps.json") as { traps: readonly { id: string }[] };
const allowlist = read("./corpus-allow.json") as { readonly frozen: number; readonly strings: readonly Allowance[] };

/** What each family of the fixture's declaration asks, in the grammar's own kinds. A family the
 * grammar has no question for (plain, number, section, thickness, grid) must read as NOTHING — except
 * as a `reference`, which is the reading that says "this points at a sheet and measures nothing". */
const ASKS: Readonly<Record<string, readonly NotationKind[]>> = Object.freeze({
  diameter: ["bar_diameter", "bar_group", "spacing", "compound"],
  bar_call: ["bar_group", "spacing", "compound"],
  spiral: ["spacing"],
  length: ["dimension_ft_in", "bar_diameter", "span_fraction"],
  level: ["dimension_ft_in", "level_range"],
  range: ["level_range"],
  mark: ["mark"],
  grade: ["grade_fc", "grade_fy"],
  cover: ["cover"],
  count: ["spacing"],
});

const REGISTERED = new Set(traps.traps.map((trap) => trap.id));
const allowed = (entry: Entry): Allowance | undefined =>
  allowlist.strings.find((one) => one.raw === entry.raw && one.family === entry.family);

/** Every figure a reading states, however deep the reading nests them — a compound states its parts'. */
function figuresOf(parsed: unknown): readonly number[] {
  if (typeof parsed === "number") return [parsed];
  if (Array.isArray(parsed)) return parsed.flatMap((one) => figuresOf(one));
  if (parsed !== null && typeof parsed === "object") return Object.values(parsed).flatMap((one) => figuresOf(one));
  return [];
}

/** What the grammar made of one string, as this suite judges it. */
function verdictOf(entry: Entry): { readonly ok: boolean; readonly why: string } {
  const reading = readNotation(entry.raw);
  const asks = ASKS[entry.family];
  if (asks === undefined) {
    if (!reading.ok || reading.kind === "reference") return { ok: true, why: "" };
    return { ok: false, why: `FALSE READING as ${reading.kind}/${reading.form}: ${JSON.stringify(reading.parsed)}` };
  }
  if (!reading.ok) return { ok: false, why: `UNREAD at token ${JSON.stringify(reading.token)}` };
  if (!asks.includes(reading.kind)) return { ok: false, why: `read as ${reading.kind}, which is not what a ${entry.family} asks` };
  const authored = entry.fact !== null && "authored" in entry.fact ? Number(entry.fact.authored) : null;
  if (authored !== null && Number.isFinite(authored)) {
    const figures = figuresOf(reading.parsed);
    if (!figures.some((figure) => Math.abs(figure - authored) <= 0.01)) {
      return { ok: false, why: `states ${JSON.stringify(figures)} where the fixture authored ${authored}` };
    }
  }
  return { ok: true, why: "" };
}

const tally = { read: 0, trap: 0, allowed: 0 };
const unaccounted: string[] = [];
const usedAllowances = new Set<string>();
for (const entry of corpus.strings) {
  const verdict = verdictOf(entry);
  if (verdict.ok) {
    tally.read += 1;
    continue;
  }
  if (entry.trap !== null && REGISTERED.has(entry.trap)) {
    tally.trap += 1;
    continue;
  }
  const excuse = allowed(entry);
  if (excuse !== undefined) {
    tally.allowed += 1;
    usedAllowances.add(`${excuse.family}\t${excuse.raw}`);
    continue;
  }
  unaccounted.push(`${entry.family}\t${entry.sheet}\t${JSON.stringify(entry.raw)}\t${verdict.why}`);
}

describe("the fixture's own 3,102 drawn strings, read by the product's grammar", () => {
  test("every string reads as its family asks, or is a registered trap, or is an allowance that says why", () => {
    // The numbers are the point of the suite, so they are ASSERTED rather than printed: a pass that
    // reads fewer strings than the last one is a regression even when nothing is unaccounted for.
    const numbers = `read=${tally.read} trap=${tally.trap} allowed=${tally.allowed} of ${corpus.strings.length}`;
    expect(unaccounted, `a string neither read, nor trapped, nor allowed (${numbers})`).toStrictEqual([]);
    expect(numbers).toBe("read=3067 trap=8 allowed=27 of 3102");
  });

  test("the allowlist is a ratchet: it may shrink and may not grow", () => {
    expect(allowlist.strings.length, "an allowance is a debt; adding one is adding debt").toBeLessThanOrEqual(allowlist.frozen);
    expect(allowlist.frozen, "the freeze is lowered with the allowance it retires").toBe(allowlist.strings.length);
  });

  test("every allowance is spent — a form that learns to read a string does not keep its excuse", () => {
    const unspent = allowlist.strings.filter((one) => !usedAllowances.has(`${one.family}\t${one.raw}`));
    expect(unspent, "these strings read now: their allowances belong deleted").toStrictEqual([]);
  });

  test("every allowance says which string, which family and why", () => {
    for (const one of allowlist.strings) {
      expect(one.raw.length, "an allowance names the string").toBeGreaterThan(0);
      expect(one.why.length, `"${one.raw}" says why it is not read`).toBeGreaterThan(20);
    }
  });

  test("no allowance excuses a string every drawing of which the fixture registered as a trap", () => {
    const doubled = allowlist.strings.filter((one) => {
      const drawn = corpus.strings.filter((entry) => entry.raw === one.raw && entry.family === one.family);
      return drawn.length > 0 && drawn.every((entry) => entry.trap !== null && REGISTERED.has(entry.trap));
    });
    expect(doubled, "a trap says how a string reads; an allowance says it does not read — never both for the same string").toStrictEqual([]);
  });
});
