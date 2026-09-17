// What the transcribe act keeps off one proposal the grammar made of a sheet's note (L-QTY-01,
// L-CAD-03, I-254).
//
// `value_as_written` is the DRAWING's own words. Keeping the grammar's canonical figure there would
// lose the sentence the note was read off, and nothing downstream could get it back — a reading
// names the atom it came from, and the canon is reached at the gate (B-17). Where the reader edited
// the box, what stands in the box is what is kept; whether that makes the act ACCEPTED or EDITED is
// the act seam's judgement, not this reading's.

/** One proposal as the grammar answers one, with the box the reader may have edited. */
type KeptProposal<Kind extends string> = {
  readonly kind: Kind;
  readonly sourceKey: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly draft?: string | undefined;
};

/** One reading as the transcribe act takes it: the words, and the atom they were read from. */
export type KeptReading<Kind extends string = string> = {
  readonly kind: Kind;
  readonly sourceKey: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
};

/** What this proposal is kept as — the drawing's own words, or the reader's edit of them. */
export function keptReadingOf<Kind extends string>(proposal: KeptProposal<Kind>): KeptReading<Kind> {
  const draft = proposal.draft?.trim() ?? "";
  return {
    kind: proposal.kind,
    sourceKey: proposal.sourceKey,
    valueAsWritten: draft === "" ? proposal.valueAsWritten : draft,
    unitAsWritten: proposal.unitAsWritten,
  };
}
