/**
 * AC-6(c) [debt-src-core-jp32wv] — the seam's public roster and the typed surface are one roster.
 *
 * AM-11 splits the schema per area and assembles it by enumeration: `SEAM_SCHEMA` is the spread of
 * the area groups, and `src/core/db.ts` is the seam's public roster, spelled name by name so a scan
 * can tell a moved name from a dropped one (ARCH-02). The two only stay one thing if a table that
 * joins its area also leaves the barrel — otherwise a table written outside its area is on the typed
 * surface and unreachable through the one door the tree imports, and the seam and the schema disagree
 * about what the product holds.
 *
 * Neither side is transcribed: the roster is read off `SEAM_SCHEMA` itself, so a table an area lands
 * tomorrow is judged here with no edit (B-19). Identity is what is asserted — a name re-declared in
 * the barrel would be a second object under one name, which is the dialect AM-11 exists to refuse.
 */
import { describe, expect, test } from "vitest";
import * as barrel from "../db";
import { SEAM_SCHEMA } from "../db";

/** The typed surface, as a bag of names — the roster both sides are judged against. */
const surface: Readonly<Record<string, unknown>> = SEAM_SCHEMA as unknown as Readonly<Record<string, unknown>>;

/** The seam's public roster, as importers see it through the one door. */
const door: Readonly<Record<string, unknown>> = barrel as unknown as Readonly<Record<string, unknown>>;

describe("the barrel enumerates the typed surface and never re-declares it", () => {
  test("AC-6(c): the typed surface holds tables, or this file grades nothing", () => {
    expect(Object.keys(surface).length, "SEAM_SCHEMA is the spread of the area groups, and it is not empty (AM-11)").toBeGreaterThan(0);
  });

  test("AC-6(c): every name on the typed surface leaves src/core/db.ts, as the same object", () => {
    const missing = Object.keys(surface).filter((name) => !(name in door));
    expect(
      missing,
      "a table on the typed surface that the seam's public roster does not hand out is reachable by nothing that imports the one door (ARCH-02, AM-11)",
    ).toEqual([]);

    const redeclared = Object.keys(surface).filter((name) => door[name] !== surface[name]);
    expect(
      redeclared,
      "the barrel ENUMERATES the area rosters and never re-declares them: a name standing for a different object on each side is two definitions of one table (AM-11, B-17)",
    ).toEqual([]);
  });
});
