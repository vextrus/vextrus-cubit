// @vitest-environment jsdom
/**
 * AC-4 — BasisChip renders R-UI-002's pair, and the glyph table has one home (B-17).
 *
 * The seven is not a frozen roster: R-UI-002 fixes the palette at seven bases and names each
 * glyph, so pinning the total here pins it to the thing that defines it. The chips themselves are
 * looped from the product's own exported table, so a basis added to the law is exercised the day
 * the table carries it.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, within } from "@testing-library/react";
import {
  BASES,
  BASIS_GLYPH_LAW,
  BASIS_MODULE,
  TESTIDS,
  cssRules,
  loadBarrel,
  loadBasisModule,
  primitiveStylesheets,
  productSrcFiles,
  readRepoFile,
  varRefs,
} from "./support/primitives";
import { el, mount } from "./support/render";

/** A rule that styles one named basis (variants select on data attributes — Decision §1). */
const basisOfRule = (selector: string): string | undefined =>
  /data-basis\s*[~|^$*]?=\s*["']?([A-Z]+)["']?/.exec(selector)?.[1];

afterEach(() => {
  cleanup();
});

describe("AC-4: BASIS_GLYPHS is the single home of the R-UI-002 glyph table", () => {
  test("AC-4: basis.ts exports the seven bases with the clause's glyphs", async () => {
    const mod = await loadBasisModule();
    const table = mod.BASIS_GLYPHS;
    expect(table, `${BASIS_MODULE} must export BASIS_GLYPHS — the single home of the R-UI-002 glyph table`).toBeTypeOf("object");
    expect(
      Object.keys(table ?? {}).sort(),
      "R-UI-002 fixes the basis palette at seven; the glyph table carries exactly those seven",
    ).toEqual([...BASES].sort());
    expect(table, "R-UI-002 names each basis's glyph verbatim, so it survives greyscale and colour-blindness").toEqual(BASIS_GLYPH_LAW);
  });

  test("AC-4: no second glyph table exists in src/ (B-17)", async () => {
    const mod = await loadBasisModule();
    const glyphs = Object.values(mod.BASIS_GLYPHS ?? {});
    expect(glyphs.length, "the glyph table is empty").toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of productSrcFiles().filter((f) => /\.(ts|tsx|mts|css)$/.test(f) && f !== BASIS_MODULE)) {
      const text = readRepoFile(file);
      const found = glyphs.filter((glyph) => text.includes(glyph));
      if (found.length > 0) offenders.push(`${file}: ${found.join(" ")}`);
    }
    expect(
      offenders,
      `B-17: the basis glyphs exist exactly once — ${BASIS_MODULE} — and every chip, cell, overlay and document reads them from there`,
    ).toEqual([]);
  });

  test("AC-4: no second basis-colour table exists in src/ (B-17)", () => {
    readRepoFile(BASIS_MODULE); // the single home must exist before "no second home" means anything
    const offenders: string[] = [];
    for (const file of productSrcFiles().filter((f) => /\.(ts|tsx|mts)$/.test(f) && f !== "src/ui/tokens.ts")) {
      if (readRepoFile(file).includes("--basis-")) offenders.push(file);
    }
    expect(
      offenders,
      "B-17: the basis colours are token values; a TypeScript module that maps a basis to a colour is a second home",
    ).toEqual([]);
  });
});

describe("AC-4: BasisChip renders the pair (R-UI-002)", () => {
  test("AC-4: every basis in the table renders its glyph, its label and its data-basis", async () => {
    const [barrel, basis] = await Promise.all([loadBarrel(), loadBasisModule()]);
    const table = basis.BASIS_GLYPHS ?? {};
    const names = Object.keys(table);
    expect(names.length, "the glyph table is empty, so this loop would be vacuous").toBeGreaterThan(0);
    for (const name of names) {
      const container = mount(el(barrel, "BasisChip", { basis: name }));
      const chip = within(container).getByTestId(TESTIDS.basisChip);
      expect(chip.getAttribute("data-basis"), `BasisChip must report data-basis for ${name}`).toBe(name);
      const glyph = within(chip).getByTestId(TESTIDS.basisGlyph);
      expect(
        glyph.textContent,
        `R-UI-002: the glyph rides with the colour for ${name}, taken from the single BASIS_GLYPHS home`,
      ).toBe(table[name]);
      expect(
        chip.textContent ?? "",
        `R-UI-002: the pair is glyph AND label — the chip for ${name} must carry its name`,
      ).toContain(name);
      cleanup();
    }
  });

  test("AC-4: each basis is coloured only through its own var(--basis-…) token", () => {
    const basisTokens = new Set(BASES.map((b) => `--basis-${b.toLowerCase()}`));
    const wrong: string[] = [];
    const styled = new Set<string>();
    for (const file of primitiveStylesheets()) {
      for (const rule of cssRules(readRepoFile(file))) {
        const basis = basisOfRule(rule.selector);
        if (basis === undefined || rule.body.includes("{")) continue;
        const own = `--basis-${basis.toLowerCase()}`;
        for (const name of varRefs(rule.body)) {
          if (!basisTokens.has(name)) continue;
          if (name === own) styled.add(basis);
          else wrong.push(`${file} { ${rule.selector} } var(${name})`);
        }
      }
    }
    expect(wrong, "R-UI-002: a basis wears its own colour and no other").toEqual([]);
    expect(
      [...styled].sort(),
      "every basis in R-UI-002's palette is coloured through its matching var(--basis-…) token",
    ).toEqual([...BASES].sort());
  });
});
