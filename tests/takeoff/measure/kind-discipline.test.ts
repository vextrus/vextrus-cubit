// @vitest-environment node
/**
 * L-REG-03 read at the measure job (s-takeoff I-595): "each quantity kind has exactly one
 * authoritative discipline". Before a rail is handed the register, the rows are cut to the sightings
 * of the kind's discipline (`KIND_DISCIPLINE`, L-MEA-04), and every other row whose class bears the
 * kind is SAID rather than measured — so the architect's brick wall and the same wall sighted on a
 * sheet a person confirmed STRUCTURAL are never both billed as brickwork, and no column read off an
 * architect's plan is billed as concrete beside the engineer's. Pure: rows in, rows and observations out.
 */
import { describe, expect, test } from "vitest";
import type { RegisterObjectRow } from "@/core/offers/contract";
import { authoritativeFor } from "@/modules/takeoff/measure/job";

/** One register row of a class, sighted under a discipline. */
function row(elementType: string, discipline: RegisterObjectRow["discipline"], key: string): RegisterObjectRow {
  return {
    tenantId: "t",
    projectId: "p",
    setRevisionId: "r",
    objectKey: key,
    discipline,
    elementType,
    mark: "M",
    viewKey: `v:LAYOUT_PLAN:${key}`,
    placementKey: key,
    levelId: "l",
    levelSlot: null,
    levelLabel: null,
    standing: "MEASURED",
    semantic: key,
    registeredAt: new Date(0),
  };
}

describe("L-REG-03: a kind is measured off its authoritative discipline's sightings alone (I-595)", () => {
  const wallOnArchitect = row("brick_wall", "ARCHITECTURAL", "wall@arch");
  const wallOnEngineer = row("brick_wall", "STRUCTURAL", "wall@str");
  const columnOnEngineer = row("column", "STRUCTURAL", "col@str");
  const columnOnArchitect = row("column", "ARCHITECTURAL", "col@arch");
  const objects = [wallOnArchitect, wallOnEngineer, columnOnEngineer, columnOnArchitect];

  test("brickwork is the architect's: a brick wall on a STRUCTURAL sheet is said and not measured", () => {
    const cut = authoritativeFor("masonry.brickwork", objects);
    // The rail is handed the architect's sightings alone — what of them is a brick wall is the rail's to read.
    expect(cut.objects.map((one) => one.objectKey), "no STRUCTURAL sighting reaches the brickwork rail").toEqual(["wall@arch", "col@arch"]);
    expect(cut.observed).toEqual([
      {
        class: "brick_wall",
        kind: "masonry.brickwork",
        code: "SIGHTING_NOT_AUTHORITATIVE",
        objectKey: "wall@str",
        sourceEntity: "v:LAYOUT_PLAN:wall@str",
        detail: { discipline: "STRUCTURAL", authority: "ARCHITECTURAL" },
      },
    ]);
  });

  test("concrete is the engineer's: a column read off an architect's plan is said, and a wall bears no concrete to say", () => {
    const cut = authoritativeFor("rcc.concrete", objects);
    expect(cut.objects.map((one) => one.objectKey)).toEqual(["wall@str", "col@str"]);
    expect(cut.observed.map((one) => [one.objectKey, one.code])).toEqual([["col@arch", "SIGHTING_NOT_AUTHORITATIVE"]]);
  });

  test("a structural set's register is the register it was: every row kept, nothing said", () => {
    const structural = [row("column", "STRUCTURAL", "a"), row("beam", "STRUCTURAL", "b"), row("pile_cap", "STRUCTURAL", "c")];
    for (const kind of ["rcc.concrete", "rcc.formwork", "rcc.rebar"] as const) {
      const cut = authoritativeFor(kind, structural);
      expect(cut.objects, kind).toEqual(structural);
      expect(cut.observed, kind).toEqual([]);
    }
  });
});
