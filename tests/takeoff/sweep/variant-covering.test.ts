/**
 * AC-3(c): the variant that covers a level is the one whose BAND covers it — an unbanded row of the
 * same schedule never wins by standing first (debt-src-modules-lnqmys, L-FRM-02, L-QTY-01).
 *
 * The selection is asked of `variantCovering` in its one home, over a stack built here and the same
 * two variants listed both ways round: a reading that depends on the order a schedule was written in
 * is a reading of the store's order rather than of the drawing (L-REG-04).
 */
import { describe, expect, test } from "vitest";
import { MODULE, levelSetup, productModule, variantSetup } from "./support/sweep-stage";

type Variant = Record<string, unknown>;
type Level = Record<string, unknown>;

type Covering = (variants: readonly Variant[], level: Level | undefined, levels: readonly Level[]) => Variant | undefined;

/** The stack the bands are read against: three storeys, ordinals as physical as the building. */
const GF = levelSetup({ levelId: "level-gf", label: "GF", ordinal: 0 });
const L1 = levelSetup({ levelId: "level-1", label: "1F", ordinal: 1 });
const L2 = levelSetup({ levelId: "level-2", label: "2F", ordinal: 2 });
const STACK: Level[] = [GF, L1, L2];

/** The schedule's own two rows: one stating no band at all, and one banded over the upper storeys. */
const OPEN = variantSetup({ variantKey: "OPEN", width: 300, depth: 450 });
const BANDED = variantSetup({ variantKey: "1F-2F", width: 250, depth: 400, bandFrom: "1F", bandTo: "2F" });

async function variantCovering(): Promise<Covering> {
  const door = await productModule<Record<string, unknown>>(MODULE.offersContract);
  expect(typeof door["variantCovering"], `${MODULE.offersContract} publishes \`variantCovering\` — the one home of the band law's selection (B-17)`).toBe("function");
  return door["variantCovering"] as Covering;
}

/** The key of whichever variant was selected, or nothing where none was. */
function keyOf(variant: Variant | undefined): string | undefined {
  return variant === undefined ? undefined : (variant["variantKey"] as string);
}

describe("AC-3: a band that covers the level beats an unbanded row of the same schedule", () => {
  test("AC-3: the covering band wins however the variants are ordered, and the open row only where no band covers", async () => {
    const covering = await variantCovering();

    for (const [said, variants] of [
      ["the open row listed first", [OPEN, BANDED]],
      ["the open row listed last", [BANDED, OPEN]],
    ] as const) {
      expect(
        keyOf(covering(variants, L1, STACK)),
        `${said}: the level stands inside the banded row's own endpoints, so that row states its section — an unbanded row covers every level and is therefore what is left when nothing else covers (L-FRM-02)`,
      ).toBe("1F-2F");
    }

    expect(
      keyOf(covering([OPEN, BANDED], GF, STACK)),
      "the ground floor stands below the band's foot, and the unbanded row is what the schedule says about it",
    ).toBe("OPEN");
    expect(
      keyOf(covering([BANDED], GF, STACK)),
      "while a schedule stating only a band that does not reach this level covers it with nothing — the level defers rather than being priced by a section nobody wrote for it (L-FRM-02)",
    ).toBeUndefined();

    // And the branch for a row standing on NO level of the stack is untouched by the fix above: a
    // foundation member is banded by no stack, and its selection is the one it already had.
    expect(
      keyOf(covering([BANDED, OPEN], undefined, STACK)),
      "a member in the foundation slot is banded by no stack: the unbanded row is its section (L-REG-02), exactly as before this sweep",
    ).toBe("OPEN");
    expect(
      keyOf(covering([BANDED], undefined, STACK)),
      "and a family stating exactly one row is that row",
    ).toBe("1F-2F");
    expect(
      keyOf(covering([BANDED, variantSetup({ variantKey: "GF-GF", width: 200, depth: 200, bandFrom: "GF", bandTo: "GF" })], undefined, STACK)),
      "while a family stating several bands off the stack is genuinely ambiguous, and defers rather than having one picked for it (L-QTY-01)",
    ).toBeUndefined();
  });
});
