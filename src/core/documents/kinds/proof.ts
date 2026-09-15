// The `proof` document kind: the one kind SEAM-DOC ships with the seam itself (R-SPINE-040).
//
// It exists to be the seam's yardstick. Every property the law asks of a document — a payload parsed
// by Zod, strings that cross as DATA, figures at exactly one stated precision, units from the enum,
// a draft that says so in words, the same bytes twice — is asked of this kind by the V-DOCS lane
// against a committed golden. The kinds a customer actually receives arrive as one file and one
// barrel line each (`boq-draft` from inc-311a, `bbs` from inc-310); nothing about them is here.
//
// A kind is four things and no more: its key, the Zod schema its payload is parsed by, the `.typ`
// standing beside it, and `present()` — which is where figures cross `figure()` and so where
// PRECISION_NOT_APPLIED surfaces. The presenter answers plain JSON, because plain JSON is what
// crosses to the template.
import { z } from "zod";
import { UNITS } from "../../units/canon";
import { figure } from "../figures";
import { kindTemplate, type DocumentKind } from "./law";

/**
 * The units a proof line may be measured in — the canon's own roster, never a second spelling of it
 * (L-FMT-02: "a unit renders from the enum"). A document prints the unit beside its quantity and
 * separately from it, so the two are distinct fields of a presented line and never one string.
 */
export const PROOF_UNITS: readonly string[] = UNITS;

/**
 * This kind's stated precision: three decimal places on every quantity (L-FMT-02). It is a property
 * of the KIND, which is why it is stated here and not in the formatter — `figure` applies whatever
 * precision its kind states and refuses anything that is not exactly at it.
 */
export const PROOF_QUANTITY_PRECISION = 3;

/** One measured line of the proof: what it refers to, what it is, how much, and in what unit. */
const proofLine = z.object({
  ref: z.string().min(1),
  description: z.string().min(1),
  // The quantity is a decimal STRING end to end (B-07): a float would lose the very digits
  // `PROOF_QUANTITY_PRECISION` exists to count.
  quantity: z.string().min(1),
  unit: z.enum(PROOF_UNITS as [string, ...string[]]),
});

/** What the proof kind is rendered from. Unknown keys are refused: a payload is a statement, not a bag. */
export const proofPayloadSchema = z
  .object({
    title: z.string().min(1),
    project: z.string().min(1),
    lines: z.array(proofLine).min(1),
  })
  .strict();

/** The proof payload, as the schema reads it. */
export type ProofPayload = z.output<typeof proofPayloadSchema>;

/**
 * The payload as the template receives it.
 *
 * Every figure crosses `figure()` here, so a quantity that is not at this kind's stated precision is
 * refused before anything is staged and the document is never rendered "nearly right" (L-FMT-02).
 * Nothing is concatenated: the quantity and its unit stay two fields, because a template that was
 * handed `12.500 m` could not set the figure in the mono face and the unit in the sans one, and
 * because a number renders once per document.
 */
function present(payload: unknown): Record<string, unknown> {
  const proof = payload as ProofPayload;
  return {
    title: proof.title,
    project: proof.project,
    lines: proof.lines.map((line) => ({
      ref: line.ref,
      description: line.description,
      quantity: figure(line.quantity, PROOF_QUANTITY_PRECISION),
      unit: line.unit,
    })),
  };
}

/** The kind itself, as the barrel enumerates it (AM-11: the barrel never re-declares this). */
export const PROOF_KIND: DocumentKind = Object.freeze({
  kind: "proof",
  payloadSchema: proofPayloadSchema,
  template: kindTemplate("proof.typ"),
  present,
});
