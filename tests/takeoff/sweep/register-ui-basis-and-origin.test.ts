/**
 * AC-5(a) and AC-5(b): the register screen reads a basis through one door, and finds the row it came
 * back to by where that row is RENDERED (debt-src-modules-xvswa5, debt-src-modules-9mcemk, B-17,
 * I-182).
 *
 * The basis roster is the core's own, read from it here rather than listed: a basis the canon gains
 * later is a case this test already makes (B-19).
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { MODULE, productModule } from "./support/sweep-stage";

type BasisOf = (value: string) => string | null;
type OriginIndexOf = (renderedRows: readonly { lineId: string }[], originLine: string | null) => number | null;

/** The register workspace, whose two render sites read a basis through the door above. */
const REGISTER_WORKSPACE = "src/modules/takeoff/register-ui/index.tsx";

async function basisOf(): Promise<BasisOf> {
  const door = await productModule<Record<string, unknown>>(MODULE.basis);
  expect(typeof door["basisOf"], `${MODULE.basis} publishes \`basisOf\` — the one reading of a stored basis the screen renders through (interfaces)`).toBe("function");
  return door["basisOf"] as BasisOf;
}

async function originRowIndexOf(): Promise<OriginIndexOf> {
  const door = await productModule<Record<string, unknown>>(MODULE.origin);
  expect(typeof door["originRowIndexOf"], `${MODULE.origin} publishes \`originRowIndexOf\` — where the origin row stands in the table (interfaces)`).toBe("function");
  return door["originRowIndexOf"] as OriginIndexOf;
}

describe("AC-5: a basis is read, never asserted", () => {
  test("AC-5: every basis the canon admits reads as itself, and a value off the roster reads as none", async () => {
    const read = await basisOf();
    const law = await productModule<Record<string, unknown>>("src/core/offers/law.ts");
    const roster = law["QUANTITY_BASES"] as readonly string[] | undefined;
    expect(Array.isArray(roster) && roster.length > 0, "the canon publishes the closed basis roster this reading is derived from (B-17)").toBe(true);

    for (const basis of roster ?? []) {
      expect(read(basis), `${basis} stands in the canon's own roster, so it reads as itself`).toBe(basis);
    }
    for (const said of ["", "measured", "TRANSCRIBED_LATER", "42"]) {
      expect(
        read(said),
        `"${said}" is no basis the canon admits: the screen is told so and renders no chip, where a cast would have painted a label for a value nobody declared (B-17: the roster is the one home)`,
      ).toBeNull();
    }
  });

  test("AC-5: the register workspace states no basis of its own", () => {
    // white-box: AC-5 — "register-ui/index.tsx carries no `as QuantityBasis`" is a property of the
    // text itself: the criterion asks that the cast be gone, and a cast is invisible at runtime.
    const source = readFileSync(new URL(`../../../${REGISTER_WORKSPACE}`, import.meta.url), "utf8");
    expect(
      source.includes("as QuantityBasis"),
      `${REGISTER_WORKSPACE} asserts no value into the basis type: a cast is a second answer to what a basis IS, and the screen has one door for that question (B-17, ARCH-02)`,
    ).toBe(false);
  });
});

describe("AC-5: the origin row is found where the table renders it", () => {
  test("AC-5: the index is the RENDERED position, and an origin the table does not render answers none", async () => {
    const index = await originRowIndexOf();
    const filtered = [{ lineId: "line-a" }, { lineId: "line-b" }, { lineId: "line-c" }];
    // The table sorts; what the reader scrolls through is the sorted list, and the row a reader came
    // back to stands where the TABLE put it, not where the filter did (I-182).
    const rendered = [...filtered].reverse();

    expect(index(rendered, "line-a"), "the origin is at the position the table renders it at, under the sort the reader is looking at").toBe(2);
    expect(index(rendered, "line-c"), "and the row the sort brought to the top is the row at the top").toBe(0);
    expect(index(filtered, "line-a"), "the same origin in the unsorted order is at its own position there — the answer is a function of the rows it was handed").toBe(0);
    expect(index(rendered, "line-z"), "an origin no rendered row stands for answers nothing: nothing is focused and nothing is said (I-182, R-UI-050)").toBeNull();
    expect(index(rendered, null), "and a screen reached without an origin has none to restore").toBeNull();
  });
});
