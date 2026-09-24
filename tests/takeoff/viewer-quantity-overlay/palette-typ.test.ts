/**
 * viewer.md Part 6 (I-637): the paper's palette is GENERATED, following `tokens.css`.
 *
 * `documents/base/palette.typ` is `emitPaletteTyp()`'s answer byte for byte — a colour or a glyph
 * moved in its one home moves the template in the same commit, or this is red — and the pinned
 * renderer reads it: a template that imports it and sets every entry compiles to a PDF.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { compileTypst, discardRender, stageRender } from "../../../src/core/documents/typst";
import { BASIS_GLYPHS } from "../../../src/ui/primitives/core/basis";
import { emitPaletteTyp } from "../../../src/ui/palette-typ";
import { lightTokens } from "../../../src/ui/tokens";

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const PALETTE = join(ROOT, "documents/base/palette.typ");

describe("the paper's palette is generated from the one home of every colour", () => {
  test("documents/base/palette.typ is emitPaletteTyp()'s answer, byte for byte", () => {
    expect(readFileSync(PALETTE, "utf8"), "regenerate the template: see src/ui/palette-typ.ts").toBe(emitPaletteTyp());
  });

  test("it carries every basis with its light colour and its glyph, and every element colour", () => {
    const emitted = emitPaletteTyp();
    for (const [basis, glyph] of Object.entries(BASIS_GLYPHS)) {
      expect(emitted, `${basis}'s colour`).toContain(`${basis}: "${lightTokens[`--basis-${basis.toLowerCase()}`]}",`);
      expect(emitted, `${basis}'s glyph`).toContain(`${basis}: ${JSON.stringify(glyph)},`);
    }
    for (const [name, value] of Object.entries(lightTokens).filter(([token]) => token.startsWith("--element-"))) {
      expect(emitted, `${name}`).toContain(`${name.replace("--element-", "")}: "${value}",`);
    }
  });

  test("the pinned renderer reads it: a template that sets every entry compiles", async () => {
    const template = join(ROOT, "tests/takeoff/viewer-quantity-overlay/support/palette-probe.typ");
    const staged = await stageRender({ template, payload: new TextEncoder().encode("{}") });
    try {
      const pdf = await compileTypst(staged);
      expect(new TextDecoder().decode(pdf.slice(0, 5)), "the renderer answered a PDF").toBe("%PDF-");
    } finally {
      await discardRender(staged.dir);
    }
  }, 120_000);
});
