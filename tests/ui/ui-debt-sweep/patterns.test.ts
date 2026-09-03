/**
 * AC-3(a)(b): the two pattern rows — the consequence body reads the rendering it is given, and the
 * refusal pattern's barrel publishes the types a consumer needs to name its props.
 *
 * AC-3(b) is a compile-time criterion: a type export is erased before anything can call it, so the
 * `tsc --noEmit` lane grades the type import and the shape below, and the runtime test beside it
 * holds the other half of the criterion — that publishing types adds no runtime name to the barrel.
 * The suites the criterion names as staying green (`consequence-dialog.test.ts`,
 * `consequence-dialog-answers.test.tsx`) are the module's own, and are run by the unit lane.
 */
import { describe, expect, test } from "vitest";
import { codeOf } from "../../../src/core/__tests__/support/read-source";
import type { RefusalEntry } from "../../../src/core/errors";
import type { RefusalEvidence, RefusalStateProps } from "../../../src/ui/patterns/refusal-state";
import { productModule } from "./support/sources";
import type { Equal, Expect } from "./support/type-assertions";

const CONSEQUENCE_DIALOG = "src/ui/patterns/consequence-dialog/consequence-dialog.tsx";
const REFUSAL_BARREL = "src/ui/patterns/refusal-state/index.ts";
const REFUSAL_COMPONENT = "src/ui/patterns/refusal-state/refusal-state.tsx";

/** The Decision's two props, whole: the entry that was refused and the place that resolves it. */
export type RefusalStatePropsAreTheDecisionsTwo = Expect<Equal<RefusalStateProps, { refusal: RefusalEntry; evidence: RefusalEvidence }>>;

describe("AC-3a: the consequence body switches on the rendering it is handed", () => {
  test("AC-3a: ConsequenceBody defaults no rendering", () => {
    const code = codeOf(CONSEQUENCE_DIALOG, "AC-3(a) judges how the body reads its Consequence's rendering");
    expect(code, "a defaulted rendering contradicts the invariant that an act names its own (L-ACT-02)").not.toMatch(/rendering\s*\?\?/);
    expect(code, "the SUBJECTS arm is chosen because the Consequence says so, never because nothing else did").not.toMatch(/\?\?\s*["']SUBJECTS["']/);
    expect(code, "the arm is read from the Consequence itself").toMatch(/consequence\.rendering/);
  });
});

describe("AC-3b: the refusal pattern's barrel publishes its prop types", () => {
  test("AC-3b: publishing the types adds no runtime export to the barrel", async () => {
    const barrel = await productModule<Record<string, unknown>>(REFUSAL_BARREL, "the refusal pattern's barrel");
    const component = await productModule<Record<string, unknown>>(REFUSAL_COMPONENT, "the module the barrel republishes");

    expect(Object.keys(barrel).sort(), "a type export is erased: the barrel's runtime names stay the module's own").toEqual(
      Object.keys(component).sort(),
    );
  });
});
