"use client";
// The rename, as a form the browser submits and the server answers (R-UI-033). The screen holds no
// rule of its own: nothing is shaped, nothing is judged here, and even the empty submission travels
// to the door — so what a person reads is always an answer the server gave, never a browser bubble.
//
// Three answers can come back and each is shown where it belongs: the saved notice, the door's own
// blank-name sentence, and a registered refusal rendered by the one renderer with the evidence that
// resolves it (ARCH-03, B-21). Renaming is a plain write and not an act: no copper to carry.
import { useActionState, useId } from "react";
import { refusalOf, type RefusalCode } from "../../../../../core/errors";
import { RefusalState } from "../../../../../ui/patterns/refusal-state";
import { Button, Input } from "../../../../../ui/primitives/core";
import { strings } from "../../../../../ui/strings";
import { renameWorkspaceAction, type RenameFormState } from "../actions";

export interface RenameFormProps {
  tenantId: string;
  name: string;
}

export function RenameForm({ tenantId, name }: RenameFormProps) {
  const [answer, submit, pending] = useActionState<RenameFormState, FormData>(renameWorkspaceAction, null);
  const inputId = useId();
  const labelId = useId();
  const hintId = useId();

  return (
    <form action={submit}>
      <section className="cx-shell-section" data-testid="shell-settings-name" aria-labelledby={labelId}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <label className="cx-shell-field-label" id={labelId} htmlFor={inputId}>
          {strings.shell_settings_name_label}
        </label>
        <p className="cx-shell-field-hint" id={hintId}>
          {strings.shell_settings_name_hint}
        </p>
        <Input
          id={inputId}
          name="name"
          data-testid="shell-rename-input"
          defaultValue={name}
          aria-describedby={hintId}
          disabled={pending}
        />
        {/* In flight the slot is empty (§1): `useActionState` keeps the last answer for the whole
            pending window, and leaving it painted would tell a person that the submission they are
            waiting on is already saved — or already refused. */}
        {/* The region waits here from the first paint, empty, so the saved notice is an insertion
            into something a reader is already watching rather than a `role="status"` node that
            arrives with its sentence already inside it (Q-11). The wrapper carries no `status`
            role of its own — the notice is what claims to be one, and only when there is one. */}
        <div className="cx-shell-live" aria-live="polite">
          {!pending && answer !== null && answer.renamed ? (
            <div className="cx-shell-outcome cx-shell-notice" role="status">
              {strings.shell_rename_saved}
            </div>
          ) : null}
        </div>
        {!pending && answer !== null && !answer.renamed ? (
          <div className="cx-shell-outcome" data-testid="shell-rename-refusal">
            {"blankName" in answer ? (
              // An alert is not a notice: a rejected save may not wear the chrome a completed one
              // wears, or the only channel telling them apart is the sentence itself.
              <p className="cx-shell-alert" role="alert">
                {strings.shell_rename_refusal}
              </p>
            ) : (
              <RefusalState refusal={refusalOf(answer.refusal)} evidence={evidenceFor(answer.refusal)} />
            )}
          </div>
        ) : null}
        <Button className="cx-shell-submit" type="submit" data-testid="shell-rename-submit" loading={pending}>
          {strings.shell_rename_submit}
        </Button>
      </section>
    </form>
  );
}

/**
 * The way onward for the refusals this door can answer with: a session that ended is resolved at
 * sign-in, and a membership that is not held is resolved nowhere inside the workspace — so the
 * evidence is the home page, which is where a person's own workspaces are reachable from.
 */
function evidenceFor(code: RefusalCode): { href: string; label: string } {
  return code === "SIGNED_OUT"
    ? { href: "/sign-in", label: strings.shell_evidence_sign_in }
    : { href: "/", label: strings.shell_evidence_home };
}
