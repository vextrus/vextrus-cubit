/**
 * s-settings-ruleset I-349 — the height a settings screen is bounded to is the field the frame
 * actually leaves it, read in the frame's own tokens.
 *
 * The craft re-look found the Rule set screen's Parameters grid showing 16 of its 17 rows at
 * 1440×900 with the frame's edge on row 16's divider, and 12½ at 1280×800, while ~40 px stood empty
 * under the Lineage: the three settings screens each bounded their column by
 * `100dvh − top bar − TOOL ROW − readout − 2 × section gap`. The settings frame renders no tool row —
 * the shell zeroes that track (`[data-toolbar="false"]`) — and the space above and below the column is
 * `shell-main`'s own padding, not the density's section gap. So the bound was 16 px short at compact
 * density, and 32 px of it was a band the pane never gave up.
 *
 * Geometry is not observable under jsdom, so the proof reads the stylesheets the screens are drawn by,
 * through the craft rubric's own reader (`tests/support/stylesheet.ts`, B-17).
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { declaredValue } from "../../support/stylesheet";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
// white-box: I-349 — a column's bound is layout, which jsdom does not perform: the only reading of it
// this lane can take is the declaration the browser is handed, read by the rubric's own reader.
const sheet = (path: string): string => readFileSync(join(REPO_ROOT, path), "utf8");

/** The three settings screens this area owns a column bound for, by the root each bounds. */
const BOUNDED = [
  { path: "src/app/(app)/t/[tenant]/p/[project]/settings/ruleset/ruleset.css", root: ".cx-ruleset" },
  { path: "src/app/(app)/t/[tenant]/p/[project]/settings/ruleset-author/ruleset-author.css", root: ".cx-ruleset-author" },
  { path: "src/modules/takeoff/site-facts-ui/site-facts.css", root: ".cx-site-facts" },
] as const;

/** `shell-main`'s padding, which is the space above and below every screen's column. */
const MAIN_PADDING = declaredValue(sheet("src/ui/shell/shell.css"), ".cx-shell-main", "padding");

describe("I-349: the settings column is bounded to the field the frame leaves it", () => {
  test("shell-main pads the field by one token, which is the term the bound subtracts twice", () => {
    expect(MAIN_PADDING, "shell.css states the field's padding as one token").toBe("var(--space-6)");
  });

  test.each(BOUNDED)("$root: viewport − top bar − readout − main's padding twice, and no tool row", ({ path, root }) => {
    const bound = declaredValue(sheet(path), root, "max-block-size");
    expect(bound, `${root} bounds its column (the grid is the region that gives up height)`).not.toBeNull();
    const said = (bound ?? "").replace(/\s+/g, " ");
    expect(said, "the frame renders no tool row, so its track is zero and takes nothing").not.toContain("--toolbar-h");
    expect(said, "the space above and below is main's padding, not the density's section gap").not.toContain("--gap-section");
    expect(said).toBe(`calc(100dvh - var(--topbar-h) - var(--status-h) - ${MAIN_PADDING ?? ""} * 2)`);
  });

  test("the three screens say the bound one way — a fourth spelling would be the drift this fixed", () => {
    const bounds = BOUNDED.map(({ path, root }) => declaredValue(sheet(path), root, "max-block-size"));
    expect(new Set(bounds).size).toBe(1);
  });
});

describe("s-settings-site-facts §1 as amended: the table is as tall as its rows (I-326's settings-area ruling)", () => {
  test("the table never grows past its rows — only shrinks, scrolling inside itself past the bound", () => {
    const css = sheet("src/modules/takeoff/site-facts-ui/site-facts.css");
    expect(declaredValue(css, ".cx-site-facts-table", "flex"), "an empty bordered well under six rows read as unfinished").toBe("0 1 auto");
    expect(declaredValue(css, ".cx-site-facts-table", "overflow"), "the rows past the bound are the table's to scroll").toBe("auto");
    expect(declaredValue(css, ".cx-site-facts-table", "min-block-size")).toBe("0");
  });
});
