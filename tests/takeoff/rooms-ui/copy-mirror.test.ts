/**
 * The pin viewer.md Part 7 commissions for the rooms panel: the module's `copy.ts` and
 * `src/ui/strings/rooms.ts` never differ.
 *
 * The panel lives in `src/modules`, which imports core and its own module only (ARCH-01), so it
 * mirrors the sentences it says; this file makes it a mirror rather than an improvisation, read in
 * BOTH directions, exactly as tests/takeoff/levels-ui/copy-mirror.test.ts does for S-Levels.
 */
import { describe, expect, test } from "vitest";
import { ROOMS_COPY } from "../../../src/modules/takeoff/rooms-ui/copy";
import { rooms } from "../../../src/ui/strings/rooms";

const registry = rooms as unknown as Record<string, string>;
const mirror = ROOMS_COPY as unknown as Record<string, string>;

describe("The rooms panel's mirrored copy is the registry's own (viewer.md Part 7)", () => {
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
