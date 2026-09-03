/**
 * AC-5(a)(b) — `src/ui/tokens.ts` selects a theme's value in ONE place, and publishes only what a
 * caller uses (debt-src-ui-10imkdv, debt-src-ui-1bvuo2x).
 *
 * AC-5(c) — that no Datum value moved — is verified by `src/ui/tokens.test.ts`, which this
 * increment leaves unedited: it already compares `emitTokensCss()` with the committed
 * `src/ui/tokens.css` byte for byte and walks both tables. Re-deriving that here would be a second,
 * weaker idea of the same guarantee (ARCH-02), so this file grades only the surface.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT, productModule } from "../../server/support/wire";
import { sourceFilesUnder } from "./support/files";
import { lex } from "./support/source-text";

const TOKENS_MODULE = "src/ui/tokens.ts";
/** The type the sweep makes module-private; held as a literal so this file's code never spells it. */
const PRIVATE_TYPE = "TokenTable";
/** The one selection the criterion fixes as having a single home. */
const SELECTION = 'theme === "light"';

const tokensSource = (): string => readFileSync(join(REPO_ROOT, TOKENS_MODULE), "utf8");

describe("AC-5: tokens.ts has one theme selection and three exports", () => {
  test("AC-5(a): the theme is chosen in exactly one place", () => {
    const occurrences = tokensSource().split(SELECTION).length - 1;
    expect(occurrences, `${TOKENS_MODULE} chooses a theme's value in one helper both callers use (B-17)`).toBe(1);
  });

  test("AC-5(b): the module publishes exactly its three values and no type", async () => {
    const module = await productModule<Record<string, unknown>>(TOKENS_MODULE);
    expect(Object.keys(module).sort()).toEqual(["darkTokens", "emitTokensCss", "lightTokens"]);

    const { code } = lex(tokensSource(), "ts");
    expect(code, `${TOKENS_MODULE} exports no type`).not.toMatch(/\bexport\s+type\b/);
    expect(code.includes(`export { type ${PRIVATE_TYPE}`), "and does not re-export it inline").toBe(false);
    expect(code.includes(`export type ${PRIVATE_TYPE}`), "and does not export it by name").toBe(false);

    const files = [
      ...sourceFilesUnder(join(REPO_ROOT, "src"), [".ts", ".tsx"]),
      ...sourceFilesUnder(join(REPO_ROOT, "tests"), [".ts", ".tsx"]),
    ];
    expect(files.length, "there is source to scan").toBeGreaterThan(0);
    // Comments and string literals are blanked first: a suite may name what it asserts is gone, and
    // only a real reference to the identifier is a fourth surface (Q-17, B-17).
    const naming = files.filter((file) => {
      const { code } = lex(readFileSync(file, "utf8"), "ts");
      return new RegExp(`\\b${PRIVATE_TYPE}\\b`).test(code);
    });
    expect(naming.map((file) => file.slice(REPO_ROOT.length + 1)).filter((file) => file !== TOKENS_MODULE)).toEqual([]);
  });
});
