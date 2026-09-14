/**
 * The pin docs/design/s-levels.md §7 commissions: "the copy-mirror test that fails the build if the
 * module's `copy.ts` and `src/ui/strings/levels.ts` ever differ".
 *
 * C-13 and B-17 over the one boundary ARCH-01 leaves no shared home for: the levels workspace lives
 * in `src/modules`, which imports core and its own module only, so it cannot read its copy from
 * `src/ui/strings` where that copy's home is. The workspace therefore mirrors the sentences it says,
 * and a mirror can drift — this file is what makes it a mirror rather than an improvisation, exactly
 * as tests/takeoff/viewer-partition-overlay/copy-mirror.test.ts does for PARTITION_COPY.
 *
 * It is read in BOTH directions, because either drift is the same defect: a sentence the workspace
 * says that the registry no longer holds, and a sentence the registry holds that the workspace no
 * longer says. A test may import both sides: `tests/**` is outside the layer matrix.
 */
import { describe, expect, test } from "vitest";
import { LEVELS_COPY } from "../../../src/modules/takeoff/levels-ui/copy";
import { levels } from "../../../src/ui/strings/levels";

const registry = levels as unknown as Record<string, string>;
const mirror = LEVELS_COPY as unknown as Record<string, string>;

describe("S-Levels' mirrored copy is the registry's own (s-levels.md §7)", () => {
  test("every mirrored sentence is the registry's value, byte for byte", () => {
    for (const [key, mirrored] of Object.entries(mirror)) {
      expect(registry[key], `the registry carries \`${key}\` — the mirror names no key of its own`).toBe(mirrored);
    }
  });

  test("every sentence the registry holds for this screen is mirrored", () => {
    expect(Object.keys(mirror).sort(), "the two tables carry the same keys, so neither can gain a sentence the other never hears").toEqual(
      Object.keys(registry).sort(),
    );
  });
});
