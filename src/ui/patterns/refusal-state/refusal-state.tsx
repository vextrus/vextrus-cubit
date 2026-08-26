"use client";
/**
 * R-UI-020's refusal pattern, and its one home (B-17, ARCH-02): a refusal renders in place — code,
 * message, remedy and the link to the evidence or setting that resolves it — on every surface,
 * inside a Dialog as much as inside a form. A refusal is never a toast alone, and a screen-local
 * refusal block is a defect, so every screen that answers with a refusal renders this.
 *
 * Both props are required by type: there is no RefusalState without an entry and an evidence link,
 * which is how "always carries the evidence link" is enforced by the compiler rather than by review.
 *
 * ARCH-01: the entry arrives as a type only — the `refusalOf` lookup belongs to the caller, so this
 * layer holds no value import of core. The component owns no copy of its own either: every visible
 * string comes from the registry entry or from the caller's evidence.
 */
import type { RefusalEntry } from "../../../core/errors";

/** Where the refusal is resolved: a place, named in the button voice — verb first (Decision § 3). */
export type RefusalEvidence = {
  href: string;
  label: string;
};

export type RefusalStateProps = {
  refusal: RefusalEntry;
  evidence: RefusalEvidence;
};

export function RefusalState({ refusal, evidence }: RefusalStateProps) {
  return (
    // R-UI-012: the answer announces itself the moment it mounts, at every severity — severity
    // chooses the tokens, never the role. The entry's own surface hint drives the presentation
    // (Decision I-8), so no caller can render a code on a surface its taxonomy did not state.
    <div
      className="cx-refusal"
      role="alert"
      data-testid="refusal-state"
      data-code={refusal.code}
      data-severity={refusal.severity}
      data-surface={refusal.surface}
    >
      <span className="cx-refusal-code" data-testid="refusal-code">
        {refusal.code}
      </span>
      <p className="cx-refusal-message" data-testid="refusal-message">
        {refusal.message}
      </p>
      <p className="cx-refusal-remedy" data-testid="refusal-remedy">
        {refusal.remedy}
      </p>
      {/* Evidence is a place, so the affordance is an anchor — never a button (R-UI-022). */}
      <a className="cx-refusal-link cx-reticle" data-testid="refusal-evidence-link" href={evidence.href}>
        {evidence.label}
      </a>
    </div>
  );
}
