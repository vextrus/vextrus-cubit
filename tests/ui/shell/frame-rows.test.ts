/**
 * THE FRAME'S FOUR BANDS STAY IN THEIR TRACKS (Design Direction 00 §1, §3).
 *
 * `.cx-shell-body` declares four rows — top bar 40, tool row 32 (zeroed where a screen has no
 * tools), the field, readout 24 — and four children fill them. Nothing in that sentence is safe
 * under auto-placement: a child that stops generating a box is removed from the grid's BOX TREE,
 * not merely from sight, and every region after it slides up one track. That is exactly what
 * `display: none` on the empty toolbar slot did to every screen in the product — `shell-main`
 * landed in the zeroed toolbar row and was clipped to its own padding, the readout painted the top
 * 24 px of the field, and the last track stood empty.
 *
 * So the law is proved twice: no region may be removed from the grid, and every region names the
 * track it belongs to. The reader is the craft rubric's own (`tests/support/stylesheet.ts`, B-17).
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { declarations, declaredValue, gridTracks, withoutComments } from "../../support/stylesheet";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const SHELL = readFileSync(join(REPO_ROOT, "src/ui/shell/shell.css"), "utf8");

/** The four regions, in the order the body's `grid-template-rows` names their tracks. */
const BANDS = [
  { selector: ".cx-shell-topbar", row: 1, what: "the 40 px top bar" },
  { selector: ".cx-shell-toolbar-slot", row: 2, what: "the 32 px tool row" },
  { selector: ".cx-shell-main", row: 3, what: "the field" },
  { selector: ".cx-shell-status", row: 4, what: "the 24 px readout" },
] as const;

describe("the shell body's four tracks", () => {
  test("the body declares exactly four rows, in both of its forms", () => {
    for (const selector of [".cx-shell-body", '.cx-shell-body[data-toolbar="false"]']) {
      const template = declaredValue(SHELL, selector, "grid-template-rows");
      expect(template, `${selector} declares its rows`).not.toBeNull();
      expect(gridTracks(template as string).length, `${selector} declares four tracks, one per region`).toBe(4);
    }
  });

  test.each(BANDS)("$what names track $row rather than trusting auto-placement", ({ selector, row }) => {
    expect(declaredValue(SHELL, selector, "grid-row"), `${selector} names its own track`).toBe(String(row));
  });

  test("every track is named exactly once, so no two regions can share one", () => {
    const claimed = BANDS.map(({ selector }) => declaredValue(SHELL, selector, "grid-row"));
    expect(new Set(claimed).size).toBe(BANDS.length);
  });

  test("no region of the frame is ever removed from the grid", () => {
    const css = withoutComments(SHELL);
    for (const { selector, what } of BANDS) {
      // Every rule whose selector list mentions this region, in any form (`[data-toolbar="false"]
      // .cx-shell-toolbar-slot` included), must not take it out of the box tree.
      const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, head]) => (head ?? "").includes(selector));
      expect(rules.length, `${selector} is styled at all`).toBeGreaterThan(0);
      for (const [, head, body] of rules) {
        const display = declarations(body ?? "").find((declaration) => declaration.prop === "display");
        expect(
          display?.value,
          `${what} is a grid item of the body; "${(head ?? "").trim()}" may not set display:none — a child that generates no box slides every region after it up one track`,
        ).not.toBe("none");
      }
    }
  });
});
