// R-UI-050's permission-denied state for the workspace itself (I-17): a person who does not hold
// the workspace the address names is not shown a rail of links into it, so this surface stands in
// place of the frame. It says which permission is missing and who holds it in its own words, and
// leaves the refusal's message and remedy to the one renderer that reads the register.
import type { RefusalEntry } from "../../core/errors";
import { RefusalState } from "../patterns/refusal-state";
// The evidence shape is the renderer's own; the pattern's barrel publishes the component, so the
// type is read from the module that declares it rather than spelled a second time here (B-17).
import type { RefusalEvidence } from "../patterns/refusal-state/refusal-state";
import { strings } from "../strings";

export interface ShellDeniedProps {
  refusal: RefusalEntry;
  /** The way onward: their own workspace when they hold one, the home page when they hold none. */
  evidence: RefusalEvidence;
}

export function ShellDenied({ refusal, evidence }: ShellDeniedProps) {
  return (
    <main className="cx-shell-denied" data-testid="shell-permission-denied">
      <h1 className="cx-shell-denied-heading">{strings.shell_denied_heading}</h1>
      <p className="cx-shell-denied-line" data-testid="shell-denied-permission">
        {strings.shell_denied_permission}
      </p>
      <p className="cx-shell-denied-line" data-testid="shell-denied-holder">
        {strings.shell_denied_holder}
      </p>
      <RefusalState refusal={refusal} evidence={evidence} />
    </main>
  );
}
