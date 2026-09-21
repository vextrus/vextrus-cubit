/**
 * C-13 and B-17 over the one boundary ARCH-01 leaves no shared home for: the register workspace
 * lives in `src/modules`, which imports core and its own module only, so it cannot read its copy from
 * `src/ui/strings/takeoff.ts` where that copy's home is. The workspace therefore mirrors the
 * sentences it says (`src/modules/takeoff/register-ui/copy.ts`), and a mirror can drift — this file
 * is what makes it a mirror rather than an improvisation, exactly as
 * tests/takeoff/viewer-inspector/copy-mirror.test.ts does for the inspector panel.
 *
 * The mirror's own header named this file as its pin from the day it was written; the pin itself
 * was not in the tree until 2026-09-21 (found when the register gained its unmeasured empty cell,
 * docs/design/s-takeoff.md §2). A test may import both sides: `tests/**` is outside the layer matrix.
 */
import { describe, expect, test } from "vitest";
import { REGISTER_COPY } from "../../../src/modules/takeoff/register-ui/copy";
import { takeoff } from "../../../src/ui/strings/takeoff";

describe("the register workspace's mirrored copy is the registry's own", () => {
  test("every mirrored sentence is the registry's value, byte for byte", () => {
    const registry = takeoff as unknown as Record<string, string>;
    for (const [key, mirrored] of Object.entries(REGISTER_COPY)) {
      expect(registry[key], `the registry carries \`${key}\` — the mirror names no key of its own`).toBe(mirrored);
    }
  });

  test("the empty cells' three truths are all mirrored (docs/design/s-takeoff.md §2)", () => {
    for (const key of [
      "takeoff_register_empty_heading",
      "takeoff_register_empty_campaign_heading",
      "takeoff_register_lines_unmeasured_heading",
      "takeoff_register_lines_unmeasured_body",
      "takeoff_register_lines_none",
    ] as const) {
      expect(REGISTER_COPY[key], `the workspace mirrors \`${key}\``).toBe(takeoff[key]);
    }
  });
});
