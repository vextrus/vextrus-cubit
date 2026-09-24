// What the transcribe act keeps off one proposal the grammar made of a sheet's note (L-QTY-01,
// L-CAD-03, I-254).
//
// `value_as_written` is the DRAWING's own words. Keeping the grammar's canonical figure there would
// lose the sentence the note was read off, and nothing downstream could get it back — a reading
// names the atom it came from, and the canon is reached at the gate (B-17). Where the reader edited
// the box, what stands in the box is what is kept; whether that makes the act ACCEPTED or EDITED is
// the act seam's judgement, not this reading's.

import type { ElementType } from "@/core/catalogue/classes";

/** One proposal as the grammar answers one, with the box the reader may have edited. */
type KeptProposal<Kind extends string> = {
  readonly kind: Kind;
  readonly sourceKey: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  /** The class the sheet's words scope the figure to, or null (I-652). */
  readonly scopeClass?: Scope;
  readonly draft?: string | undefined;
};

/** A scope as the act takes one: an element class, or null for every class no scoped figure speaks for. */
type Scope = ElementType | null;

/** One reading as the transcribe act takes it: the words, and the atom they were read from. */
export type KeptReading<Kind extends string = string> = {
  readonly kind: Kind;
  readonly sourceKey: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  /** Kept as the sheet scopes it — stated, so what the reader saw on the row is what the act keeps. */
  readonly scopeClass?: Scope;
};

/** What this proposal is kept as — the drawing's own words, or the reader's edit of them. */
export function keptReadingOf<Kind extends string>(proposal: KeptProposal<Kind>): KeptReading<Kind> {
  const draft = proposal.draft?.trim() ?? "";
  return {
    kind: proposal.kind,
    sourceKey: proposal.sourceKey,
    valueAsWritten: draft === "" ? proposal.valueAsWritten : draft,
    unitAsWritten: proposal.unitAsWritten,
    ...(proposal.scopeClass === undefined ? {} : { scopeClass: proposal.scopeClass }),
  };
}
