/**
 * AC-5(d): a stylesheet travels with the thing it styles.
 *
 * `ruleset.css` dresses `RulesetSettingsSection`. Loaded from the route's `page.tsx` instead, the
 * rules ship for every request of that route whether or not the section renders, and the section
 * cannot be mounted anywhere else — the gallery, another screen — without its own appearance. One
 * component, one sheet, imported by the component (B-17).
 */
import { describe, expect, test } from "vitest";
import { importsOf } from "./support/sources";

const DIR = "src/app/(app)/t/[tenant]/p/[project]/settings/ruleset";
const SECTION = `${DIR}/ruleset-settings-section.tsx`;
const PAGE = `${DIR}/page.tsx`;
const SHEET = "./ruleset.css";

describe("AC-5: the ruleset sheet is imported by the section it dresses", () => {
  test("AC-5: ruleset-settings-section.tsx imports ./ruleset.css and page.tsx does not", () => {
    // white-box: AC-5(d) — which module pulls a side-effect CSS import is a fact of the module
    // graph; jsdom loads no stylesheets, so no render can observe it.
    const inSection = importsOf(SECTION).map((record) => record.specifier);
    expect(inSection, `${SECTION} must carry its own appearance — a section mounted without its sheet is an unstyled section`).toContain(SHEET);

    const inPage = importsOf(PAGE).map((record) => record.specifier);
    expect(inPage, `${PAGE} must not load ${SHEET}: the sheet belongs to the section, and loading it here ships it whether the section renders or not`).not.toContain(SHEET);
  });
});
