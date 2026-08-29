/**
 * I-22's standard, executed: "an entered name is a name with something visible in it."
 *
 * The standard is perceptual, so the proxy it is implemented with matters. `String.prototype.trim()`
 * strips only the ECMAScript whitespace set: a name of one U+200B ZERO WIDTH SPACE trims to a
 * non-empty string, so a `trim()`-based guard admits it — the rename door would save it and
 * `workspaceLabel` would judge it "something visible" and paint a breadcrumb link with no glyph in
 * it, which is the Q-11 failure the fallback exists to prevent. This file pins the invisible cases
 * against the standard's one home (`hasVisibleText`) and against the label that reads it, and pins
 * the other direction too: a real name is never rewritten.
 *
 * `.ts`, not `.tsx`: tsconfig includes `tests/**\/*.ts`, so `tsc` reads it as well as vitest.
 */
import { describe, expect, test } from "vitest";
import { hasVisibleText, workspaceLabel } from "../../../src/ui/shell/routes";
import { strings } from "../../../src/ui/strings";

/** Names that show nothing, each named by what it is made of. */
const SHOWS_NOTHING: readonly [string, string][] = [
  ["a zero width space", "​"],
  ["a zero width non-joiner", "‌"],
  ["a zero width joiner", "‍"],
  ["a byte order mark", "﻿"],
  ["a word joiner", "⁠"],
  ["a soft hyphen", "­"],
  ["a Hangul filler", "ㅤ"],
  ["an empty Braille cell", "⠀"],
  ["ordinary spaces", "   "],
  ["a non-breaking space", " "],
  ["a tab and a newline", "\t\n"],
  ["spaces around a zero width space", " ​ "],
  ["nothing at all", ""],
];

/** Names that show something, including ones a naive filter would eat. */
const SHOWS_SOMETHING: readonly [string, string][] = [
  ["a plain name", "Ashrafi Builders"],
  ["a name padded with spaces", "  Ashrafi  "],
  ["a name with a zero width space inside it", "Ashrafi​Builders"],
  ["a Bangla name", "আশরাফি"],
  ["an emoji", "🙂"],
  ["a single letter", "A"],
];

describe("I-22: blankness is judged by what shows, not by what trim() removes", () => {
  for (const [what, name] of SHOWS_NOTHING) {
    test(`I-22: ${what} is not an entered name`, () => {
      expect(hasVisibleText(name), `${JSON.stringify(name)} shows nothing, so it is not a name (I-22)`).toBe(false);
    });
  }

  for (const [what, name] of SHOWS_SOMETHING) {
    test(`I-22: ${what} is an entered name`, () => {
      expect(hasVisibleText(name), `${JSON.stringify(name)} shows something, so it is a name and is taken as presented (I-22)`).toBe(true);
    });
  }

  test("I-22: the invisible cases trim() misses are exactly the ones a naive guard would admit", () => {
    const missedByTrim = SHOWS_NOTHING.filter(([, name]) => name.trim() !== "");
    expect(missedByTrim.length, "the table must actually exercise names trim() cannot judge, or it proves nothing").toBeGreaterThan(0);
    for (const [what, name] of missedByTrim) {
      expect(hasVisibleText(name), `${what} survives trim() and must still be refused`).toBe(false);
    }
  });
});

describe("I-23: nothing paints a nameless workspace, and nothing renames a named one", () => {
  for (const [what, name] of SHOWS_NOTHING) {
    test(`I-23: a workspace named with ${what} shows the unnamed label`, () => {
      expect(workspaceLabel({ tenantId: "t", name }), "a name with nothing visible in it shows as shell_workspace_unnamed (Q-11)").toBe(
        strings.shell_workspace_unnamed,
      );
    });
  }

  for (const [what, name] of SHOWS_SOMETHING) {
    test(`I-23: a workspace named with ${what} shows exactly as it stands`, () => {
      expect(workspaceLabel({ tenantId: "t", name }), "a name that says something is never rewritten").toBe(name);
    });
  }
});
