/**
 * Public acceptance for L-FRM-06's unit canon: AC-5 — the two tiers, the one factor per unit, the
 * five exact constants, the quotient-derived pairs, the rate bases that are not units, and the
 * canon as the tree's only home for a conversion literal.
 *
 * The five constants are spelled here because L-FRM-06 spells them: they are the law's own text,
 * and acceptance that derived them from the module it judges would prove nothing. This is the one
 * file the literal scan below exempts besides the canon itself — AC-5 says so — plus one literal
 * forgiven by name to the clause that orders it (see SANCTIONED_LITERALS). The scan is validated
 * against a planted tree in the same run, so it cannot pass by matching nothing.
 *
 * Nothing else here is a transcription. Which units exist is read from the canon's own tables, and
 * the quotient rule is checked over every same-dimension pair those tables yield (B-19).
 */
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { CANON_MODULE, REPO_ROOT, loadCanon, stringRoster } from "../../catalogue/__tests__/support/wire";

/** The five exact constants, as L-FRM-06 states them. */
const M3_PER_CFT = 0.028316846592;
const M_PER_FT = 0.3048;
const M2_PER_SFT = 0.09290304;
const KG_PER_MT = 1000;
const KG_PER_LB = 0.45359237;

/** The five, and the unit each converts from — the law's own pairing. */
const EXACT: readonly { unit: string; factor: number; dimension: string }[] = [
  { unit: "cft", factor: M3_PER_CFT, dimension: "VOLUME" },
  { unit: "ft", factor: M_PER_FT, dimension: "LENGTH" },
  { unit: "sft", factor: M2_PER_SFT, dimension: "AREA" },
  { unit: "MT", factor: KG_PER_MT, dimension: "MASS" },
  { unit: "lb", factor: KG_PER_LB, dimension: "MASS" },
];

/** The dimensions and canonicals L-FRM-06 closes, in the order AC-5 names them. */
const DIMENSION_ROSTER = ["MASS", "VOLUME", "LENGTH", "AREA", "COUNT"] as const;
const CANONICAL_ROSTER: Readonly<Record<string, string>> = { MASS: "kg", VOLUME: "m3", LENGTH: "m", AREA: "m2", COUNT: "pcs" };

/** Rate bases are not units (L-FRM-06), and no unit table may carry one. */
const RATE_BASES = ["job", "LS", "hour", "per % cft"] as const;

/** Unit codes the test contract requires the canon to know, packaging tier included. */
const REQUIRED_CODES = ["kg", "m3", "m", "m2", "pcs", "cft", "ft", "sft", "MT", "lb", "bag", "drum", "coil"] as const;

/** This file and the canon: the two AC-5 exempts from the literal scan. */
const THIS_FILE = fileURLToPath(import.meta.url);
const CANON_FILE = resolve(REPO_ROOT, CANON_MODULE);

/**
 * The constants a conversion literal outside the canon would spell. The integer 1000 is deliberately
 * not scanned for: as a bare integer it is a millisecond in half the tree, and a ban on it would
 * refuse code that converts nothing. It is held to the canon by the "one home" case instead.
 */
const SCANNED_FACTORS: readonly number[] = [M3_PER_CFT, M_PER_FT, M2_PER_SFT, KG_PER_LB];

/**
 * One reading, over raw source. L-FRM-06 draws no delimiter distinction: a factor spelled in quotes
 * is the same fact in a costume, and in a tree whose idiom is decimal-string arithmetic (B-07) the
 * quotes are exactly where arithmetic reaches it. So the sweep below reads the file as written —
 * strings included.
 *
 * A conversion a Bible clause itself orders is not an unlawful literal, but it is forgiven by name
 * and never by blanket blindness: one exact file, one exact literal, one clause. R-SPINE-010 states
 * the project's target GFA in "m² and sft display", so the m²→sft display factor `src/core/format.ts`
 * holds is that clause's own instruction. Nothing else in that file, and no other file, is forgiven.
 */
const SANCTIONED_LITERALS: readonly { file: string; literal: string; clause: string; why: string }[] = [
  {
    file: resolve(REPO_ROOT, "src/core/format.ts"),
    literal: "10.7639",
    clause: "R-SPINE-010",
    why: "target GFA is stated in m² and sft display, so the display factor is the clause's own instruction",
  },
];

type Sanction = { file: string; literal: string; clause: string; why: string };

/** The literals one file is forgiven by name, if any. */
function sanctionedIn(file: string, sanctions: readonly Sanction[]): ReadonlySet<string> {
  return new Set(sanctions.filter((entry) => entry.file === file).map((entry) => entry.literal));
}

/** Every .ts/.tsx file under a directory, absolute and sorted. */
function sourceFiles(root: string): string[] {
  const found: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;
    for (const entry of readdirSync(current)) {
      const absolute = join(current, entry);
      if (statSync(absolute).isDirectory()) {
        if (entry !== "node_modules") stack.push(absolute);
        continue;
      }
      if (absolute.endsWith(".ts") || absolute.endsWith(".tsx")) found.push(absolute);
    }
  }
  return found.sort();
}

/**
 * Every conversion literal found under `root`, outside `exempt`: the constants spelled verbatim, and
 * any decimal literal within a ten-thousandth of one of them or of its reciprocal — an inverse
 * hard-coded elsewhere is the same law broken from the other side. Quoted or bare makes no
 * difference; only a `sanctions` entry naming this file *and* this literal is passed over.
 */
function conversionLiteralFindings(root: string, exempt: ReadonlySet<string>, sanctions: readonly Sanction[] = SANCTIONED_LITERALS): string[] {
  const findings: string[] = [];
  for (const file of sourceFiles(root)) {
    if (exempt.has(file)) continue;
    const forgiven = sanctionedIn(file, sanctions);
    const source = readFileSync(file, "utf8");
    const where = file.split(sep).join("/");
    for (const factor of SCANNED_FACTORS) {
      if (forgiven.has(String(factor))) continue;
      if (source.includes(String(factor))) findings.push(`${where} spells the conversion constant ${String(factor)} — the canon is its only home (L-FRM-06)`);
    }
    for (const match of source.matchAll(/\d+\.\d+/g)) {
      if (forgiven.has(match[0])) continue;
      const literal = Number(match[0]);
      if (!Number.isFinite(literal) || literal === 0) continue;
      for (const factor of SCANNED_FACTORS) {
        for (const candidate of [factor, 1 / factor]) {
          if (Math.abs(literal - candidate) / candidate < 1e-4) {
            findings.push(`${where} spells ${match[0]}, a conversion factor (or its inverse) — every conversion is a quotient of the canon's factors (L-FRM-06)`);
          }
        }
      }
    }
  }
  return [...new Set(findings)];
}

describe("AC-5: the unit canon", () => {
  test("AC-5: DIMENSIONS and CANONICAL_UNITS are the two tiers' physical half, exactly", async () => {
    const { DIMENSIONS, CANONICAL_UNITS } = await loadCanon();
    expect([...stringRoster(DIMENSIONS, "DIMENSIONS")], "DIMENSIONS is MASS, VOLUME, LENGTH, AREA, COUNT (L-FRM-06)").toEqual([...DIMENSION_ROSTER]);
    for (const dimension of DIMENSION_ROSTER) {
      expect(CANONICAL_UNITS[dimension], `${dimension}'s canonical unit is ${CANONICAL_ROSTER[dimension]}`).toBe(CANONICAL_ROSTER[dimension]);
    }
    expect(Object.keys(CANONICAL_UNITS).sort(), "CANONICAL_UNITS carries one canonical per dimension and nothing else").toEqual([...DIMENSION_ROSTER].sort());
  });

  test("AC-5: EXACT_FACTORS holds exactly the five constants L-FRM-06 states", async () => {
    const { EXACT_FACTORS } = await loadCanon();
    const numbers: number[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === "number") {
        numbers.push(value);
        return;
      }
      if (value === null || typeof value !== "object") return;
      const members = value instanceof Map ? [...value.values()] : value instanceof Set ? [...value] : Object.values(value as Record<string, unknown>);
      for (const member of members) walk(member);
    };
    walk(EXACT_FACTORS);
    expect(numbers.sort((left, right) => left - right), "EXACT_FACTORS holds the five exact conversion constants and no other number").toEqual([...EXACT.map((entry) => entry.factor)].sort((left, right) => left - right));
  });

  test("AC-5: toCanonical answers one factor per unit — 1 for each canonical, the exact constant for each of the five", async () => {
    const { CANONICAL_UNITS, toCanonical } = await loadCanon();
    for (const [dimension, canonical] of Object.entries(CANONICAL_UNITS)) {
      const answered = toCanonical(canonical);
      expect(answered.ok, `toCanonical("${canonical}") must resolve — it is ${dimension}'s canonical unit`).toBe(true);
      if (!answered.ok) continue;
      expect(answered.factor, `a canonical unit converts to itself: toCanonical("${canonical}").factor is 1`).toBe(1);
      expect(answered.dimension, `toCanonical("${canonical}").dimension is ${dimension}`).toBe(dimension);
    }
    for (const { unit, factor, dimension } of EXACT) {
      const answered = toCanonical(unit);
      expect(answered.ok, `toCanonical("${unit}") must resolve`).toBe(true);
      if (!answered.ok) continue;
      expect(answered.factor, `toCanonical("${unit}").factor is the exact constant L-FRM-06 states`).toBe(factor);
      expect(answered.dimension, `${unit} measures ${dimension}`).toBe(dimension);
    }
  });

  test("AC-5: the canon knows every unit code the contract names, packaging tier included", async () => {
    const { toCanonical } = await loadCanon();
    for (const code of REQUIRED_CODES) {
      const answered = toCanonical(code);
      const known = answered.ok || answered.code !== "UNIT_UNKNOWN";
      expect(known, `"${code}" is a unit the canon knows — a packaging unit refuses for want of a product factor, never for being unknown`).toBe(true);
    }
  });

  test("AC-5: every same-dimension pair converts as the quotient of its two factors", async () => {
    const canon = await loadCanon();
    const candidates = new Set<string>([...REQUIRED_CODES, ...Object.values(canon.CANONICAL_UNITS), ...stringRoster(canon.UNIT_ABBREVIATIONS, "UNIT_ABBREVIATIONS")]);
    const resolved = [...candidates]
      .map((unit) => ({ unit, answer: canon.toCanonical(unit) }))
      .flatMap((entry) => (entry.answer.ok ? [{ unit: entry.unit, factor: entry.answer.factor, dimension: entry.answer.dimension }] : []));
    expect(resolved.length, "the canon must resolve at least the canonical units and the five exact ones").toBeGreaterThanOrEqual(EXACT.length + Object.keys(canon.CANONICAL_UNITS).length);

    let pairs = 0;
    for (const from of resolved) {
      for (const to of resolved) {
        if (from.dimension !== to.dimension) continue;
        pairs += 1;
        const answered = canon.convert(1, from.unit, to.unit);
        expect(answered.ok, `convert(1, "${from.unit}", "${to.unit}") must answer — both are ${from.dimension}`).toBe(true);
        if (!answered.ok) continue;
        expect(answered.value, `convert(1, "${from.unit}", "${to.unit}") is the quotient of their factors, derived and never tabulated`).toBe(from.factor / to.factor);
      }
    }
    expect(pairs, "there is more than one same-dimension pair to derive").toBeGreaterThan(1);
  });

  test("AC-5: convert(1, 'ft', 'm') is exactly 0.3048, and each exact constant converts to its canonical", async () => {
    const { CANONICAL_UNITS, convert } = await loadCanon();
    const foot = convert(1, "ft", "m");
    expect(foot.ok && foot.value, "convert(1, 'ft', 'm') === 0.3048 exactly (L-FRM-06)").toBe(M_PER_FT);
    for (const { unit, factor, dimension } of EXACT) {
      const canonical = CANONICAL_UNITS[dimension];
      expect(canonical, `${dimension} must have a canonical unit`).toBeTypeOf("string");
      const answered = convert(1, unit, String(canonical));
      expect(answered.ok && answered.value, `convert(1, "${unit}", "${String(canonical)}") is the exact constant`).toBe(factor);
    }
  });

  test("AC-5: a rate basis is not a unit — job, LS, hour and per % cft appear in no unit table", async () => {
    const { CANONICAL_UNITS, UNIT_ABBREVIATIONS, toCanonical } = await loadCanon();
    const tabled = new Set([...Object.values(CANONICAL_UNITS), ...stringRoster(UNIT_ABBREVIATIONS, "UNIT_ABBREVIATIONS")].map((code) => code.toLowerCase()));
    for (const basis of RATE_BASES) {
      expect(tabled.has(basis.toLowerCase()), `"${basis}" is a rate basis, not a unit — no unit table may carry it (L-FRM-06)`).toBe(false);
      const answered = toCanonical(basis);
      expect(answered.ok, `toCanonical("${basis}") must not resolve — a rate basis has no factor`).toBe(false);
    }
  });

  test("AC-5: the canon is the one home of a conversion literal, and the scan that says so finds a planted one", async () => {
    await loadCanon();
    const canonSource = readFileSync(CANON_FILE, "utf8");
    for (const { factor } of EXACT) {
      expect(canonSource, `${CANON_MODULE} spells ${String(factor)} — the exact constants live here and nowhere else`).toContain(String(factor));
    }

    const planted = mkdtempSync(join(tmpdir(), "cubit-conversion-scan-"));
    const quotedInverse = (1 / M2_PER_SFT).toFixed(4);
    writeFileSync(join(planted, "offender.ts"), `export const cubicMetresPerCubicFoot = ${String(M3_PER_CFT)};\nexport const feetPerMetre = ${String(1 / M_PER_FT)};\n`, "utf8");
    writeFileSync(join(planted, "quoted.ts"), `export const squareFeetPerSquareMetre = "${quotedInverse}";\n`, "utf8");
    writeFileSync(join(planted, "innocent.ts"), `export const millisecondsPerSecond = 1000;\nexport const half = 0.5;\nexport const aspect = "1.7778";\n`, "utf8");
    const plantedFindings = conversionLiteralFindings(planted, new Set(), []);
    expect(plantedFindings.join("\n"), "the scan catches a conversion constant spelled bare").toContain("offender.ts");
    expect(plantedFindings.join("\n"), "the scan catches an inverse spelled in quotes — the delimiter changes nothing (L-FRM-06)").toContain("quoted.ts");
    expect(plantedFindings.length, "the scan must catch the bare constant, the bare inverse and the quoted inverse").toBeGreaterThanOrEqual(3);
    expect(plantedFindings.join("\n"), "the scan accuses no file that converts nothing").not.toContain("innocent.ts");

    // A sanction forgives one literal in one named file, and leaves every other finding standing.
    const narrowed = conversionLiteralFindings(planted, new Set(), [{ file: join(planted, "quoted.ts"), literal: quotedInverse, clause: "R-SPINE-010", why: "self-validation of the by-name exemption" }]);
    expect(narrowed.join("\n"), "the named sanction forgives the literal it names").not.toContain("quoted.ts");
    expect(narrowed.join("\n"), "and forgives nothing else — the exemption is by name, never blanket").toContain("offender.ts");

    const findings = conversionLiteralFindings(join(REPO_ROOT, "src"), new Set([CANON_FILE, THIS_FILE]));
    expect(findings, findings.join("\n")).toEqual([]);
  });
});
