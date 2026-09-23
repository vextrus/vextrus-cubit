/**
 * The settings screens read as one frame (session 8, C8) — the template's seam, the rule every grid
 * in it ends by, and the three places the craft re-look and gate 2's pictures found the frame broken.
 *
 * - s-settings I-522: the section nav's rule stopped 24 px under the top bar and 24 px over the
 *   readout — it stood inside `shell-main`'s padding. The template takes that band back (a negative
 *   block margin of exactly main's padding) and pads its own two columns by it instead.
 * - s-settings I-523: a grid ends at its last column. Each grid in the settings area names the one
 *   column of prose that takes the width its fixed columns leave (the s-documents I-348 rule), so no
 *   frame runs on past its last column over an empty band while that prose truncates beside it.
 * - s-settings-participants I-524: the roster's outline hugs its rows while the region keeps the
 *   height the act and the record leave; the Role label stands on the first chip line.
 * - s-settings I-523: the invitation door never shrinks below its own label.
 *
 * Geometry is not observable under jsdom, so — as `settings-field-bound.test.ts` does — the proof reads
 * the declarations the browser is handed, through the craft rubric's own reader (B-17).
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { declaredValue, ruleBody } from "../../support/stylesheet";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
// white-box: I-522/b/c — seams, column shares and outlines are layout, which jsdom does not perform.
const sheet = (path: string): string => readFileSync(join(REPO_ROOT, path), "utf8");

const TEMPLATE = "src/app/(app)/t/[tenant]/settings/settings.css";
const PROJECT_SETTINGS = "src/app/(app)/t/[tenant]/p/[project]/settings";
const WORKSPACE_SETTINGS = "src/app/(app)/t/[tenant]/settings";

/** `shell-main`'s padding: the band the template takes back, stated once in the shell. */
const MAIN_PADDING = declaredValue(sheet("src/ui/shell/shell.css"), ".cx-shell-main", "padding") ?? "";

describe("s-settings I-522: the nav's rule runs the field's whole height", () => {
  test("main pads the field by one token — the band the template takes back", () => {
    expect(MAIN_PADDING).toBe("var(--space-6)");
  });

  test("the pane reaches through main's padding, above and below, by exactly that band", () => {
    const css = sheet(TEMPLATE);
    expect(declaredValue(css, ".cx-settings", "margin-block"), "a negative block margin of main's own padding").toBe(`calc(${MAIN_PADDING} * -1)`);
    expect(declaredValue(css, ".cx-settings", "min-height"), "and at least main's whole box tall, so the rule meets the readout").toBe(`calc(100% + ${MAIN_PADDING} * 2)`);
  });

  test("the nav keeps the rule and both columns keep their inset, by the same band", () => {
    const css = sheet(TEMPLATE);
    expect(declaredValue(css, ".cx-settings-nav", "border-inline-end"), "the seam is the nav's own hairline").toBe("var(--hairline)");
    for (const column of [".cx-settings-nav", ".cx-settings-content"]) {
      expect(declaredValue(css, column, "padding-block"), `${column} stands where it stood`).toBe(MAIN_PADDING);
    }
  });
});

/**
 * Every DataTable grid in the settings area, the sheet that draws it, and the one column that takes
 * the width its fixed columns leave — named by the column it IS, then addressed by its position (a
 * cell carries no column name).
 */
const REMAINDERS = [
  { grid: "Rule set · Parameters", path: `${PROJECT_SETTINGS}/ruleset/ruleset.css`, selector: ".cx-ruleset-table-primary .cx-table-row > .cx-table-cell:first-child", column: "Parameter" },
  { grid: "Rule set · Lineage", path: `${PROJECT_SETTINGS}/ruleset/ruleset.css`, selector: ".cx-ruleset-table-lineage .cx-table-row > .cx-table-cell:nth-child(2)", column: "Edition" },
  { grid: "Author edition", path: `${PROJECT_SETTINGS}/ruleset-author/ruleset-author.css`, selector: ".cx-ruleset-author-table .cx-table-row > .cx-table-cell:first-child", column: "Parameter" },
  { grid: "Participants · Current roles", path: `${PROJECT_SETTINGS}/participants/participants.css`, selector: ".cx-participants-table-fill .cx-table-row > .cx-table-cell:nth-child(2)", column: "Role" },
  { grid: "Participants · Role history", path: `${PROJECT_SETTINGS}/participants/participants.css`, selector: ".cx-participants-table-record .cx-table-row > .cx-table-cell:nth-child(3)", column: "Member" },
  { grid: "Members · roster", path: `${WORKSPACE_SETTINGS}/members/members.css`, selector: ".cx-members-table .cx-table-row > .cx-table-cell:nth-child(3)", column: "Role history" },
  { grid: "Members · Invitations", path: `${WORKSPACE_SETTINGS}/members/invitations/invitations.css`, selector: ".cx-invitations-table .cx-table-row > .cx-table-cell:first-child", column: "Email address" },
] as const;

describe("s-settings I-523: every settings grid ends at its last column", () => {
  test.each(REMAINDERS)("$grid: $column takes the width the fixed columns leave", ({ path, selector }) => {
    expect(declaredValue(sheet(path), selector, "flex-grow"), `${selector} is the grid's remainder`).toBe("1");
  });

  test.each([
    { frame: "Rule set · Parameters", path: `${PROJECT_SETTINGS}/ruleset/ruleset.css`, selector: ".cx-ruleset-table-primary .cx-table-rowgroup:last-child > .cx-table-row" },
    { frame: "Author edition", path: `${PROJECT_SETTINGS}/ruleset-author/ruleset-author.css`, selector: ".cx-ruleset-author-table .cx-table-rowgroup:last-child > .cx-table-row" },
    { frame: "Participants · Current roles", path: `${PROJECT_SETTINGS}/participants/participants.css`, selector: ".cx-participants-table-fill .cx-table-rowgroup:last-child > .cx-table-row" },
  ])("$frame: a hairline frame closes on its last row, one hairline thick", ({ path, selector }) => {
    expect(declaredValue(sheet(path), selector, "border-bottom-width"), "the last row's own hairline gives way to the frame's").toBe("0");
  });

  test("the Rule set's chain carries a class of its own, so its remainder cannot land on the parameters", () => {
    const section = sheet(`${PROJECT_SETTINGS}/ruleset/ruleset-settings-section.tsx`);
    expect(section).toContain('className="cx-ruleset-table cx-ruleset-table-lineage"');
  });
});

describe("s-settings I-523: a section line's controls keep their measure", () => {
  const css = sheet(`${WORKSPACE_SETTINGS}/members/invitations/invitations.css`);

  test("the invitation door never shrinks below its own label", () => {
    expect(declaredValue(css, ".cx-invitations-form > .cx-btn", "flex"), "the one primary on the line does not shrink").toBe("none");
    expect(declaredValue(css, ".cx-invitations-form > .cx-btn", "white-space"), "and its label is one line").toBe("nowrap");
  });

  test("the address field and the roster search state their 240 as a width, which a content-sized line reads", () => {
    expect(declaredValue(css, ".cx-invitations-email", "inline-size")).toBe("240px");
    expect(declaredValue(sheet(`${WORKSPACE_SETTINGS}/members/members.css`), ".cx-members-search", "inline-size")).toBe("240px");
  });
});

describe("s-settings-participants I-524: the roster's outline ends at its last row", () => {
  const css = sheet(`${PROJECT_SETTINGS}/participants/participants.css`);

  test("the region keeps the height the act and the record leave, and draws no outline of its own", () => {
    const region = ".cx-participants-table.cx-participants-table-fill";
    expect(declaredValue(css, region, "flex"), "the region still takes the fill (the work surface holds)").toBe("1 1 auto");
    expect(ruleBody(css, region)?.some((decl) => decl.prop.startsWith("border")), "no border round the region's empty track").toBe(false);
  });

  test("the grid's scroll box wears the hairline, as tall as what it holds", () => {
    const viewport = ".cx-participants-table-fill .cx-table-viewport";
    expect(declaredValue(css, viewport, "border"), "the outline").toBe("var(--hairline)");
    expect(declaredValue(css, viewport, "flex"), "sized to its header and rows, up to the region").toBe("0 1 auto");
    expect(declaredValue(css, ".cx-participants-table-fill .cx-table-rowgroup:last-child > .cx-table-row", "border-bottom-width"), "the last row's hairline gives way to the outline's").toBe("0");
  });

  test("a field's label stands level with its first chip line, wrapped or not", () => {
    expect(declaredValue(css, ".cx-participants-field-label", "align-self")).toBe("start");
    expect(declaredValue(css, ".cx-participants-field-label", "line-height"), "a line box one chip tall").toBe("var(--control-h)");
  });
});
