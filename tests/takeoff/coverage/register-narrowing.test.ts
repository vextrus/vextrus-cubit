// @vitest-environment jsdom
/**
 * s-coverage I-484 — "OPEN THE REGISTER" FROM A COVERAGE CELL OPENS THE REGISTER NARROWED TO
 * THAT CELL (walk-0 register-trace FRICTION; the HONEST-SCOPE review's blocking item).
 *
 * WHY. The cell's door wrote `?class=&kind=&level=` and the register read only `?line=`: the link
 * promised the cell's lines and opened all of them, and the suite that pinned the door compared the
 * href string alone, so it passed with the outcome missing. What is held here is the outcome: the
 * address the coverage screen composes, followed into the shipped register workspace, shows exactly
 * the cell's rows, with the chips that narrowed it standing chosen — and a foundation cell, whose
 * level the register states by its slot, is narrowed by the value the register filters on.
 */
import { afterEach, describe, expect, test } from "vitest";
import { registerCellHref } from "@/modules/takeoff/coverage/coverage-workspace";
import { narrowingOf, narrowingQuery } from "@/modules/takeoff/register-ui/narrowing";
import { PROJECT, TENANT, aLine, aView, anObject, cleanup, copy, lineRows, mountRegister, one, takeoffStrings } from "../../ui/takeoff-register/support/fixtures";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

/** Five lines across two classes, three levels (a foundation slot among them) and two kinds. */
function aRegister(): ReturnType<typeof aView> {
  const lines = [
    aLine({ lineId: "column-gf-concrete", objectKey: "col-C1-GF", class: "column", level: "GF", kind: "rcc.concrete" }),
    aLine({ lineId: "column-1f-concrete", objectKey: "col-C1-1F", class: "column", level: "1F", kind: "rcc.concrete" }),
    aLine({ lineId: "column-1f-formwork", objectKey: "col-C1-1F", class: "column", level: "1F", kind: "rcc.formwork", unit: "m2", value: "3.6" }),
    aLine({ lineId: "beam-1f-concrete", objectKey: "beam-B1-1F", class: "beam", level: "1F", kind: "rcc.concrete", value: "0.45" }),
    aLine({ lineId: "pile-foundation-concrete", objectKey: "pile-P1", class: "pile", level: "FOUNDATION", kind: "rcc.concrete", value: "4.2" }),
  ];
  const objects = [
    anObject({ objectKey: "col-C1-GF", mark: "C1", level: "GF", class: "column" }),
    anObject({ objectKey: "col-C1-1F", mark: "C1", level: "1F", class: "column" }),
    anObject({ objectKey: "beam-B1-1F", mark: "B1", level: "1F", class: "beam" }),
    anObject({ objectKey: "pile-P1", mark: "P1", level: "FOUNDATION", class: "pile" }),
  ];
  return aView({ objects, lines });
}

/** The register, opened at the address a coverage cell's door composes. */
async function openedFrom(cell: Parameters<typeof registerCellHref>[2]): Promise<HTMLElement> {
  window.history.replaceState(null, "", registerCellHref(TENANT, PROJECT, cell));
  return mountRegister(aRegister());
}

const shown = (root: HTMLElement): (string | null)[] => lineRows(root).map((row) => row.getAttribute("data-line"));
/** Whether a chip reads a narrowing rather than its all-option (the chip reads `Label · Value`). */
async function narrowing(root: HTMLElement, name: "class" | "kind" | "level" | "basis"): Promise<boolean> {
  const all = copy(await takeoffStrings(), `takeoff_register_filter_any_${name}`);
  return !(one(root, `register-filter-${name}`).getAttribute("aria-label") ?? "").endsWith(` ${all}`);
}

describe("I-484: the register reads the narrowing a coverage cell's door writes", () => {
  test("a cell on a storey opens the register at that class, kind and storey — its rows and no others — with the three chips standing chosen", async () => {
    const root = await openedFrom({ kind: "rcc.concrete", class: "column", levelLabel: "1F", levelSlot: null });
    expect(shown(root), "the column's concrete on 1F, and not its formwork, its GF line or the beam beside it").toEqual(["column-1f-concrete"]);
    for (const name of ["class", "kind", "level"] as const) expect(await narrowing(root, name), `the ${name} chip reads the narrowing it holds`).toBe(true);
    expect(await narrowing(root, "basis"), "and a narrowing the link did not name stays the all-option").toBe(false);
  });

  test("a foundation cell is narrowed by the slot the register states its level by", async () => {
    const root = await openedFrom({ kind: "rcc.concrete", class: "pile", levelLabel: "", levelSlot: "FOUNDATION" });
    expect(shown(root)).toEqual(["pile-foundation-concrete"]);
  });

  test("a kind no class bears narrows by its kind alone", async () => {
    const root = await openedFrom({ kind: "rcc.formwork", class: null, levelLabel: "", levelSlot: null });
    expect(shown(root)).toEqual(["column-1f-formwork"]);
    expect(await narrowing(root, "class"), "no class was named").toBe(false);
    expect(await narrowing(root, "kind")).toBe(true);
  });

  test("the query is one spelling: what the coverage screen writes is what the register reads back", () => {
    const written = narrowingQuery({ class: "pile_cap", kind: "rcc.concrete", level: "1ST FLOOR" });
    expect(narrowingOf(`?${written}`)).toEqual({ class: "pile_cap", kind: "rcc.concrete", level: "1ST FLOOR" });
    expect(narrowingOf(""), "an address naming none narrows nothing").toEqual({ class: "", kind: "", level: "" });
  });
});
