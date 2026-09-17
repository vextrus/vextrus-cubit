/**
 * AC-5(e): what a reader keeps off a sheet is what the DRAWING said, until the reader edits the box
 * (debt-src-modules-19v2s4r, L-QTY-01, L-CAD-03, I-254).
 *
 * `value_as_written` is the drawing's own words: a reading stored at the grammar's canonical figure
 * has lost the words it was read from, and nothing downstream can get them back.
 */
import { describe, expect, test } from "vitest";
import { MODULE, productModule } from "./support/sweep-stage";

/** One proposal the grammar made of a sheet's note, with the box the reader may have edited. */
type Proposal = { kind: string; sourceKey: string; text: string; valueAsWritten: string; unitAsWritten: string; canonical: string; draft?: string };

/** One reading as the transcribe act takes it. */
type Kept = { kind: string; sourceKey: string; valueAsWritten: string; unitAsWritten: string };

type KeptOf = (proposal: Proposal) => Kept;

/** One proposal, as the grammar answers one: the words, and the canonical figure beside them. */
const PROPOSED: Proposal = {
  kind: "CONCRETE_GRADE",
  sourceKey: "S-01:e:12",
  text: "ALL CONCRETE TO BE 3,000 psi UNLESS NOTED",
  valueAsWritten: "3,000",
  unitAsWritten: "psi",
  canonical: "20.684272",
};

async function keptReadingOf(): Promise<KeptOf> {
  const door = await productModule<Record<string, unknown>>(MODULE.kept);
  expect(typeof door["keptReadingOf"], `${MODULE.kept} publishes \`keptReadingOf\` — what the screen keeps off one proposal (interfaces)`).toBe("function");
  return door["keptReadingOf"] as KeptOf;
}

describe("AC-5: an accepted proposal keeps the drawing's own words", () => {
  test("AC-5: accepted as proposed, the reading is the as-written text; edited, it is the edit", async () => {
    const kept = await keptReadingOf();

    expect(
      kept(PROPOSED),
      "a proposal a reader accepted as it stood keeps what the DRAWING wrote — storing the canonical figure as the as-written value loses the sentence the note was read off, and every reading names the atom it came from (L-CAD-03, L-QTY-01)",
    ).toEqual({ kind: PROPOSED.kind, sourceKey: PROPOSED.sourceKey, valueAsWritten: PROPOSED.valueAsWritten, unitAsWritten: PROPOSED.unitAsWritten });

    expect(
      kept({ ...PROPOSED, draft: "4,000" }),
      "and a box the reader edited keeps the edit: what stands in the box is what is kept, and whether that is ACCEPTED or EDITED is the seam's judgement (I-254)",
    ).toEqual({ kind: PROPOSED.kind, sourceKey: PROPOSED.sourceKey, valueAsWritten: "4,000", unitAsWritten: PROPOSED.unitAsWritten });
  });
});
