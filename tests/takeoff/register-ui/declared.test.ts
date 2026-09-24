/**
 * What the register names as drawn and not measured is the coverage certificate's own statement
 * (s-takeoff-register I-650, B-17): the "Not placed" classes of `measurementStatementOf` and
 * every row of `unclassedStatementOf`, read through `declaredOf` — never a second reading of the
 * captions. The statements are computed here off a hand-built residue by the certificate's own
 * functions, so a statement that changes its rows changes this expectation with it.
 */
import { describe, expect, test } from "vitest";
import { UNPLACED, measurementStatementOf, unclassedStatementOf, type ResidueCell } from "../../../src/core/residue";
import { declaredOf } from "../../../src/modules/takeoff/register-ui/declared";

/** One unmeasured cell of the residue, in the slot the certificate prints it under. */
function cell(over: Partial<ResidueCell> & Pick<ResidueCell, "kind" | "class">): ResidueCell {
  return {
    levelId: null,
    levelLabel: "",
    levelOrdinal: null,
    grain: "CELL",
    measurement: "NOT_ESTABLISHED",
    bill: "IN_BILL",
    contradicted: false,
    lineIds: [],
    sightings: [],
    observations: [],
    measurementActId: null,
    billActId: null,
    reason: null,
    reasonViews: [],
    levelSlot: UNPLACED,
    partial: null,
    ...over,
  };
}

const UNCLASSED = [
  { drawingId: "d-1", address: "v:SECTION:DXF_HANDLE:3C", caption: "OVERHEAD WATER TANK", word: "tank" },
  { drawingId: "d-1", address: "v:SECTION:DXF_HANDLE:2A", caption: "UNDERGROUND WATER RESERVOIR", word: "reservoir" },
];

describe("declaredOf reads the certificate's statement", () => {
  test("a 'Not placed' class once, with its kinds, then each unclassed member by its word", () => {
    const cells = [
      cell({ kind: "rcc.formwork", class: "tie_beam" }),
      cell({ kind: "rcc.concrete", class: "tie_beam" }),
      cell({ kind: "rcc.concrete", class: "slab" }),
    ];
    const declared = declaredOf({ measurement: measurementStatementOf(cells), unclassed: unclassedStatementOf(UNCLASSED), registeredClasses: new Set() });
    expect(declared).toEqual([
      { subject: "CLASS", class: "slab", kinds: ["rcc.concrete"] },
      { subject: "CLASS", class: "tie_beam", kinds: ["rcc.concrete", "rcc.formwork"] },
      { subject: "MEMBER", word: "reservoir", caption: "UNDERGROUND WATER RESERVOIR", drawingId: "d-1", address: "v:SECTION:DXF_HANDLE:2A" },
      { subject: "MEMBER", word: "tank", caption: "OVERHEAD WATER TANK", drawingId: "d-1", address: "v:SECTION:DXF_HANDLE:3C" },
    ]);
  });

  test("a row on a storey, or a class the register holds objects of, is not 'placed nowhere'", () => {
    const cells = [
      cell({ kind: "rcc.concrete", class: "column", levelId: "l-1", levelLabel: "GF", levelOrdinal: 0, levelSlot: null }),
      cell({ kind: "rcc.concrete", class: "beam" }),
      cell({ kind: "rcc.concrete", class: "stair" }),
    ];
    const declared = declaredOf({ measurement: measurementStatementOf(cells), unclassed: [], registeredClasses: new Set(["beam"]) });
    expect(declared).toEqual([{ subject: "CLASS", class: "stair", kinds: ["rcc.concrete"] }]);
  });

  test("a measured cell and a cell held out of the bill are not declared unmeasured", () => {
    const cells = [cell({ kind: "rcc.concrete", class: "slab", measurement: "QUANTITY_BEARING" }), cell({ kind: "rcc.concrete", class: "stair", bill: "NOT_IN_THIS_BILL" })];
    expect(declaredOf({ measurement: measurementStatementOf(cells), unclassed: [], registeredClasses: new Set() })).toEqual([]);
  });
});
