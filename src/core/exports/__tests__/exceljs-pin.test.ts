/**
 * AC-2 — the seam's two libraries are bound exactly (AM-08, C-06: save-exact binds every dependency).
 *
 * An export is a function of its spec alone (R-SPINE-021's content address rests on it), and a caret
 * would let a patch release of either library move the bytes of an artefact the tree has already
 * addressed. `exceljs` writes the workbook; `jszip` — which exceljs itself packs with — re-packs the
 * archive with every entry dated at `EXPORT_EPOCH`, so it is pinned beside it rather than left to be
 * hoisted at whatever version a transitive resolution lands on.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/** The manifest — this file sits at `src/core/exports/__tests__/`. */
const MANIFEST = join(import.meta.dirname, "..", "..", "..", "..", "package.json");

/** What each of the seam's libraries is bound to, exactly. */
const PINNED: Readonly<Record<string, string>> = { exceljs: "4.4.0", jszip: "3.10.2" };

describe("R-SPINE-041: the export seam's libraries are pinned save-exact", () => {
  // white-box: AC-2 — a pin IS a property of the manifest's text: an installed tree answers the same
  // whether the range that resolved it was exact or a caret, so the declaration is the only subject.
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { dependencies?: Record<string, string> };

  test.each(Object.entries(PINNED))("AC-2: %s is bound to %s with no range", (name, version) => {
    expect(manifest.dependencies?.[name], `${name} is a runtime dependency of the seam`).toBe(version);
  });
});
