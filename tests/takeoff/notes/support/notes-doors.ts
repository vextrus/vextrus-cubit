/**
 * Loading the doors this increment's criteria drive, by path (R-TO-034, AC-1, AC-2, AC-4).
 *
 * Kept apart from `bnbc-notes.ts` so the ROSTER that file holds stays free of `vitest`: the journey
 * lane stages the same four sentences in a Playwright process, where a unit lane's `expect` has no
 * runner to bind to (the viewer-partition stage's own precedent). Mechanics only — nothing here
 * judges the product.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { NOTES_GRAMMAR_MODULE, NOTES_LAW_MODULE, REPO_ROOT, type SheetText } from "./bnbc-notes";

/** One proposal, whole, as the grammar answers one (interfaces: `NoteProposal`). */
export type ProposalLike = {
  kind?: unknown;
  sourceKey?: unknown;
  text?: unknown;
  valueAsWritten?: unknown;
  unitAsWritten?: unknown;
  canonical?: unknown;
} & Record<string, unknown>;

/** The grammar, as this acceptance drives it. */
export type GrammarSeam = { proposeNotes: (texts: readonly SheetText[]) => ProposalLike[] };

/** The note law, as this acceptance reads its rosters. */
export type NotesLaw = { NOTE_KINDS: readonly string[]; NOTE_ACCEPTANCES: readonly string[]; NOTE_BASIS: string };

/**
 * A product module by repo-relative path: a file the Builder has not written yet fails as an
 * assertion naming it, rather than as a collection death that reads as a defect in the acceptance.
 */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/** The grammar, with the one call AC-1 drives asserted by name. */
export async function grammarSeam(): Promise<GrammarSeam> {
  const module = await productModule<Record<string, unknown>>(NOTES_GRAMMAR_MODULE);
  expect(typeof module["proposeNotes"], `${NOTES_GRAMMAR_MODULE} publishes \`proposeNotes\` (interfaces)`).toBe("function");
  return module as unknown as GrammarSeam;
}

/** The note law, with the rosters this acceptance reads asserted present. */
export async function notesLaw(): Promise<NotesLaw> {
  const module = await productModule<Record<string, unknown>>(NOTES_LAW_MODULE);
  for (const roster of ["NOTE_KINDS", "NOTE_ACCEPTANCES"]) {
    expect(Array.isArray(module[roster]), `${NOTES_LAW_MODULE} publishes \`${roster}\` as a closed list (interfaces)`).toBe(true);
  }
  return module as unknown as NotesLaw;
}

/** One proposal reduced to the six facts a criterion states about it (C-05: a shape may carry more). */
export function proposalFacts(proposal: ProposalLike): { kind: string; sourceKey: string; text: string; valueAsWritten: string; unitAsWritten: string; canonical: string } {
  return {
    kind: String(proposal.kind),
    sourceKey: String(proposal.sourceKey),
    text: String(proposal.text),
    valueAsWritten: String(proposal.valueAsWritten),
    unitAsWritten: String(proposal.unitAsWritten),
    canonical: String(proposal.canonical),
  };
}
