/**
 * AC-5(a) — a member-CLASS layout plan is a layout plan, not a detail.
 *
 * The grammar reads a caption that says PLAN and names a member as a DETAIL, which is right for
 * "FOOTING F1 PLAN" — one footing, drawn large — and wrong for "COLUMN LAYOUT PLAN", which is the
 * sheet every column instance is placed off (debt-src-modules-7wkfo6). A detail yields no instances,
 * so the drawing's columns are lost to a word. The member word decides only where the caption does
 * not also say LAYOUT.
 *
 * A pure function over strings: the corpus suite beside this one holds the grammar to the whole
 * committed vocabulary; what is judged here is the one rule the row names.
 */
import { expect, test } from "vitest";
import { grammar, type GrammarSeam } from "./support/partition-stage";

/** The two answers this rule stands between (test contract: the view-type vocabulary). */
const LAYOUT_PLAN = "LAYOUT_PLAN";
const DETAIL = "DETAIL";

async function classify(): Promise<GrammarSeam["classifyCaption"]> {
  const seam = await grammar();
  return seam.classifyCaption;
}

test("AC-5(a): a caption that says LAYOUT is a layout plan even when it names a member class", async () => {
  const classifyCaption = await classify();

  expect(classifyCaption("COLUMN LAYOUT PLAN").type, "the sheet every column is placed off yields instances, so it is not a detail").toBe(LAYOUT_PLAN);
  expect(classifyCaption("SLAB LAYOUT PLAN").type, "the rule is the word LAYOUT, not the particular member the caption names").toBe(LAYOUT_PLAN);
});

test("AC-5(a): a member-scoped plan that does not say LAYOUT is still a detail", async () => {
  const classifyCaption = await classify();

  expect(classifyCaption("FOOTING F1 PLAN").type, "one footing drawn large is a detail, which is what the member word is there to catch").toBe(DETAIL);
});

test("AC-5(a): a plain floor plan is unmoved by the rule", async () => {
  const classifyCaption = await classify();

  expect(classifyCaption("GROUND FLOOR PLAN").type, "a caption naming no member is read exactly as it was before").toBe(LAYOUT_PLAN);
});
