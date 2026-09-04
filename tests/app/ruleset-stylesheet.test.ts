// The rule-set settings section (R-SPINE-012) is exported for any screen to compose, but its
// stylesheet was loaded by the route that happens to render it today — so the second consumer gets
// the markup with none of the styling.
import { expect, test } from "vitest";
import { importsOf } from "./support/source-facts";

const SECTION = "src/app/(app)/t/[tenant]/p/[project]/settings/ruleset/ruleset-settings-section.tsx";
const PAGE = "src/app/(app)/t/[tenant]/p/[project]/settings/ruleset/page.tsx";

test("AC-5(d): the section carries its own stylesheet, and the page no longer carries it for it", () => {
  // white-box: AC-5(d) — a stylesheet import has no runtime observable under jsdom; which module
  // declares the dependency is the whole criterion.
  const imported = (file: string): boolean => importsOf(file).some((line) => line.specifier === "./ruleset.css");

  expect(imported(SECTION), `${SECTION} does not import its own ruleset.css`).toBe(true);
  expect(imported(PAGE), `${PAGE} still imports ruleset.css on the section's behalf`).toBe(false);
});
