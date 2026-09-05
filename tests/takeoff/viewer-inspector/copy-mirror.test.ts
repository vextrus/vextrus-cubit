/**
 * C-13 and B-17 over the one boundary ARCH-01 leaves no shared home for: the inspector panel lives
 * in `src/modules`, which imports core and its own module only, so it cannot read its copy from
 * `src/ui/strings` where that copy's home is. The panel therefore mirrors the sentences it says, and
 * a mirror can drift — this file is what makes it a mirror rather than an improvisation, exactly as
 * tests/screen-states/copy-fidelity.test.ts does for the route-local tables.
 *
 * A test may import both sides: `tests/**` is outside the layer matrix.
 */
import { describe, expect, test } from "vitest";
import { INSPECTOR_COPY } from "../../../src/modules/takeoff/viewer-inspector/copy";
import { viewerInspector } from "../../../src/ui/strings/viewer-inspector";

describe("the inspector's mirrored copy is the registry's own", () => {
  test("every mirrored sentence is the registry's value, byte for byte", () => {
    const registry = viewerInspector as unknown as Record<string, string>;
    for (const [key, mirrored] of Object.entries(INSPECTOR_COPY)) {
      expect(registry[key], `the registry carries \`${key}\` — the mirror names no key of its own`).toBe(mirrored);
    }
  });
});
