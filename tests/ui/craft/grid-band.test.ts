/**
 * A work-surface grid fills its band (session 7's craft re-look, R-UI-080/083, Direction §5 rule 3).
 *
 * The DataTable draws each column at its own width and runs its header — with the column chooser's
 * `⋯` at the far end — the whole width of the grid. Where the widths summed short of the grid, the
 * header ran on over an empty band: S-Home's row `⋯` floated 360 px from the header's own `⋯`,
 * S-Audit's third evidence chip was cut beside 230 px of empty track, S-Project's addresses were cut
 * beside ~750 px of it, and S-Documents' one door was cut to "Op" at 1280. Each screen now names the
 * column that takes the remainder — its width a floor, never a cap — and S-Project's regions stand as
 * tall as their rows.
 *
 * Geometry is not observable under jsdom, so the proof reads the stylesheets the screens are drawn
 * by, through the rubric's own reader (`tests/support/stylesheet.ts`, B-17).
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { declaredValue, ruleBody } from "../../support/stylesheet";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
// white-box: the remainder a column takes is layout, which jsdom does not perform: the only reading
// of it this lane can take is the declaration the browser is handed.
const sheet = (path: string): string => readFileSync(join(REPO_ROOT, path), "utf8");

/** Each screen's grid, by the rule that hands its remainder to the column the Decision names. */
const BANDS = [
  {
    screen: "S-Home (I-140 as amended): Name, Client and District share the remainder",
    path: "src/app/(app)/t/[tenant]/home/home.css",
    selector: ".cx-home-table .cx-table-row > .cx-table-cell:nth-child(-n + 3)",
  },
  {
    screen: "S-Project (I-147 as amended): each table's last column — Subject, Role — takes it",
    path: "src/app/(app)/t/[tenant]/p/[project]/home/project-home.css",
    selector: ".cx-project-table .cx-table-row > .cx-table-cell:last-child",
  },
  {
    screen: "S-Audit (I-347): Cited evidence, the log's last column, takes it",
    path: "src/app/(app)/t/[tenant]/p/[project]/audit/audit.css",
    selector: ".cx-audit-acts .cx-table-row > .cx-table-cell:last-child",
  },
  {
    screen: "S-Documents (I-348): Acts cited, §1's remainder column, takes it",
    path: "src/app/(app)/t/[tenant]/p/[project]/documents/documents.css",
    selector: ".cx-documents-grid .cx-table-row > .cx-table-cell:nth-child(5)",
  },
] as const;

describe("a work-surface grid fills its band", () => {
  test.each(BANDS)("$screen", ({ path, selector }) => {
    expect(declaredValue(sheet(path), selector, "flex-grow"), `${selector} grows into the band its header already spans`).toBe("1");
  });

  test("the primitive's cells still hold their own widths: a column grows from its width, never below it", () => {
    // The remainder rules above are only a floor if the table's own cells do not shrink.
    expect(declaredValue(sheet("src/ui/primitives/data/data.css"), ".cx-table-cell", "flex")).toBe("none");
  });
});

describe("S-Project (I-369): the activity table is the work surface, and the roster stands as tall as its rows", () => {
  const css = sheet("src/app/(app)/t/[tenant]/p/[project]/home/project-home.css");

  test("the activity region, holding its table, takes the room main leaves and scrolls its RECENT_ACTIVITY_LIMIT rows inside itself", () => {
    expect(declaredValue(css, ".cx-project-region:nth-of-type(1):has(> .cx-project-table)", "flex")).toBe("1 1 0");
  });

  test("an activity region holding the empty state stands as tall as it is, so the roster never sits detached at the foot", () => {
    expect(declaredValue(css, ".cx-project-region:nth-of-type(1)", "flex")).toBe("none");
  });

  test("the roster is the region that may give up height, scrolling inside its own table", () => {
    expect(declaredValue(css, ".cx-project-region", "min-block-size")).toBe("0");
    expect(declaredValue(css, ".cx-project-region", "flex"), "no region is told to grow into main").toBeNull();
  });
});

describe("s-audit I-347: a chip's name ends in an ellipsis inside its own measure, never mid-glyph", () => {
  const css = sheet("src/app/(app)/t/[tenant]/p/[project]/audit/subject-chips.css");

  test("the chip's measure is a block with one line that can end in an ellipsis", () => {
    const measure = ".cx-subject-chip .cx-id-chip-value";
    expect(declaredValue(css, measure, "display")).toBe("block");
    expect(declaredValue(css, measure, "overflow")).toBe("hidden");
    expect(declaredValue(css, measure, "text-overflow")).toBe("ellipsis");
    expect(declaredValue(css, measure, "white-space")).toBe("nowrap");
  });
});

describe("s-audit I-427: at 1280 the count stands whole, and every chip shown gives up width evenly", () => {
  // Measured in the product's own Chromium at the post-widening 424 px cell (the Affirm-scale row,
  // three 24-character captions and ten subjects): before, `+7` stood at 482–506 px of a 424 px cell,
  // clipped by the row's own box, and the third chip read "R…"; after, the three chips take 120 px each
  // and `+7` stands at 392–416, whole. Layout is not observable under jsdom, so this reads the rules.
  const css = sheet("src/app/(app)/t/[tenant]/p/[project]/audit/subject-chips.css");
  const audit = sheet("src/app/(app)/t/[tenant]/p/[project]/audit/audit.css");

  test("the row clips nothing, and neither screen wraps it in a box that does", () => {
    expect(declaredValue(css, ".cx-subject-chips", "overflow"), "the row holding the count is no clipping box").toBeNull();
    expect(ruleBody(audit, ".cx-audit-act-evidence"), "S-Audit's evidence cell adds no clipping box of its own around the row").toBeNull();
  });

  test("the chips shown are the one box that clips, and it gives up width down to nothing before the count gives up any", () => {
    expect(declaredValue(css, ".cx-subject-chips-shown", "overflow")).toBe("hidden");
    // WCAG 2.2 SC 2.5.8: a chip is 20 px and its copy button's target 24, reaching 2 px past it above
    // and below; a clipping box as short as the chip cut the top and bottom of every copy target.
    const copyTarget = declaredValue(sheet("src/ui/primitives/core/core.css"), ".cx-id-chip-copy", "height");
    expect(copyTarget, "the IdChip's copy target states its height").toBe("var(--space-6)");
    expect(declaredValue(css, ".cx-subject-chips-shown", "min-block-size"), "the box that clips is as tall as a copy target").toBe(copyTarget);
    expect(declaredValue(css, ".cx-subject-chips-shown", "min-inline-size")).toBe("0");
    expect(declaredValue(css, ".cx-subject-chips-shown", "flex")).toBe("0 1 auto");
    expect(declaredValue(css, ".cx-subject-chips-more", "flex"), "the count never shrinks").toBe("none");
  });

  test("every chip starts from nothing and takes an equal share, never more than its own name needs, down to its copy target and a glyph", () => {
    expect(declaredValue(css, ".cx-subject-chip", "flex")).toBe("1 1 0");
    expect(declaredValue(css, ".cx-subject-chip", "max-inline-size")).toBe("max-content");
    expect(declaredValue(css, ".cx-subject-chip", "min-inline-size")).toBe("calc(var(--space-6) * 2)");
    expect(ruleBody(css, ".cx-subject-chip-tail"), "no chip is singled out as the one that is squeezed").toBeNull();
  });
});

describe("the polish the re-look carried (session 7's relook-final, C1)", () => {
  test("S-Audit (I-428): a filter's trigger fills the 180 px its Select stands in, so the row keeps its 12 px rhythm", () => {
    const css = sheet("src/app/(app)/t/[tenant]/p/[project]/audit/audit.css");
    expect(declaredValue(css, ".cx-audit-select", "min-width")).toBe("180px");
    expect(declaredValue(css, ".cx-audit-select > .cx-select-trigger", "flex"), "the class lands on the wrapper; the trigger is what the eye reads").toBe("1 1 auto");
  });

  test("S-Home (I-140 as amended): the row's ⋯ stands at its cell's trailing edge, under the header's own", () => {
    const css = sheet("src/app/(app)/t/[tenant]/home/home.css");
    const well = ".cx-home-table .cx-table-cell[data-control] > .cx-table-cell-text";
    expect(declaredValue(css, well, "display")).toBe("flex");
    expect(declaredValue(css, well, "justify-content")).toBe("flex-end");
    expect(declaredValue(css, well, "align-items")).toBe("center");
  });

  test("S-Project (I-369 as amended): the activity region ends on a rule, and the roster stands a 12 px seam below it", () => {
    const css = sheet("src/app/(app)/t/[tenant]/p/[project]/home/project-home.css");
    expect(declaredValue(css, ".cx-project-region:nth-of-type(1):has(> .cx-project-table)", "border-block-end")).toBe("var(--hairline)");
    // The seam BETWEEN regions is their parent's gap (`.cx-project`), not a region's own internal gap,
    // which happens to be the same token and says nothing about the space between two regions.
    expect(declaredValue(css, ".cx-project", "gap"), "the page's region gap the seam adds to").toBe("var(--space-1)");
    expect(declaredValue(css, ".cx-project-region + .cx-project-region", "margin-block-start"), "4 + 8 = 12").toBe("var(--space-2)");
  });
});
