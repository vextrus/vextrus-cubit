/**
 * AC-5(d): a stylesheet travels with the thing it styles.
 *
 * `ruleset.css` dresses `RulesetSettingsSection`. Loaded from the route's `page.tsx` instead, the
 * rules ship for every request of that route whether or not the section renders, and the section
 * cannot be mounted anywhere else — the gallery, another screen — without its own appearance. One
 * component, one sheet, loaded by the component (B-17).
 *
 * Both halves are asked of the LOADER: the sheet is answered by a stand-in that records being
 * loaded, and the second half stands the section in so what is watched is the page's own graph. A
 * page that keeps the import beside a section that has gained one fails here (B-19).
 */
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { REPO_ROOT, productModule } from "../server/support/wire";

const DIR = "src/app/(app)/t/[tenant]/p/[project]/settings/ruleset";
const SECTION = `${DIR}/ruleset-settings-section.tsx`;
const PAGE = `${DIR}/page.tsx`;
const SHEET = `${DIR}/ruleset.css`;

/** Whether the sheet was pulled in by the module under import. */
let sheetLoaded = false;

beforeEach(() => {
  sheetLoaded = false;
  vi.resetModules();
  vi.doMock(join(REPO_ROOT, SHEET), () => {
    sheetLoaded = true;
    return { default: "" };
  });
});

afterEach(() => {
  vi.doUnmock(join(REPO_ROOT, SHEET));
  vi.doUnmock(join(REPO_ROOT, SECTION));
});

describe("AC-5: the ruleset sheet is loaded by the section it dresses", () => {
  test("AC-5: loading the section brings its own appearance with it", async () => {
    const module = await productModule<{ RulesetSettingsSection: unknown }>(SECTION);
    expect(typeof module.RulesetSettingsSection, `${SECTION} exports the section`).toBe("function");
    expect(sheetLoaded, `a section mounted without its sheet is an unstyled section — loading ${SECTION} did not bring ${SHEET} with it`).toBe(true);
  });

  test("AC-5: the route's page loads no stylesheet of its own", async () => {
    // The section is stood in for, so what is watched is the page's OWN graph: the sheet reaching
    // the browser through the section is the arrangement being asked for, not the defect.
    vi.doMock(join(REPO_ROOT, SECTION), () => ({ RulesetSettingsSection: () => null }));
    const page = await productModule<{ default: unknown }>(PAGE);
    expect(typeof page.default, `${PAGE} default-exports the route`).toBe("function");
    expect(sheetLoaded, `${PAGE} loads ${SHEET} itself: the rules then ship for every request of this route whether the section renders or not`).toBe(false);
  });
});
