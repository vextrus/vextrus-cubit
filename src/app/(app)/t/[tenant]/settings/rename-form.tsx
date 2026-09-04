"use client";
// The rename, as a form the browser submits and the server answers (R-UI-033). The screen holds no
// rule of its own: nothing is shaped, nothing is judged here, and even the empty submission travels
// to the door — so what a person reads is always an answer the server gave, never a browser bubble.
//
// Three answers can come back and each is shown where it belongs: the saved notice, the door's own
// blank-name sentence, and a registered refusal rendered by the one renderer with the evidence that
// resolves it (ARCH-03, B-21). Renaming is a plain write and not an act: no copper to carry.
import { useActionState, useId, useState } from "react";
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
  // An answer describes the submission it came back from, so it is spent the moment the person
  // states a new intention by editing the field again: `useActionState` keeps the last answer for
  // the lifetime of this component, and a "saved" sentence left standing beside a name somebody is
  // now retyping claims a save for a write that has not happened. The answer read is compared by
  // identity — every submission returns a fresh one — so a second save says so again.
  const [spent, setSpent] = useState<RenameFormState>(null);
  const current = answer !== spent ? answer : null;
  // The name this form last put on the wire, and the seed the field is mounted from. `defaultValue`
  // is read at mount and never again, so a workspace that comes back wearing a name this form did
  // not send — renamed in another tab, or re-read by the layout — reaches the field by re-keying it.
  // A name the server is merely echoing back to us leaves the key alone: the field already holds
  // that text, and remounting under the person's own cursor would drop focus to the document body,
  // which is precisely what the read-only-in-flight treatment below exists to avoid (Q-11).
  // The question the key asks is whether the field already holds the text that has arrived, and the
  // field is what can answer it: a name the server is merely echoing back is one this person typed,
  // so it is read from what they typed rather than recorded on the way out. That keeps the
  // `<form action>` the dispatch itself — an action attribute wrapped in a closure is a form only a
  // browser that already has the client bundle can submit.
  const [typed, setTyped] = useState(name);
  const [seed, setSeed] = useState({ name, key: name });
  if (seed.name !== name) {
    setSeed({ name, key: name === typed ? seed.key : name });
    setTyped(name);
  }
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
        {/* In flight the field is read-only rather than disabled. A person who types the name and
            presses Enter submits from the field itself; disabling it mid-transition would remove
            the focused element from the tab order and drop focus to the document body, so the
            answer would arrive with focus nowhere and keyboard travel would restart at the top of
            the page (Q-11 asks for a focus destination, not a lost one). Read-only keeps the focus
            and the tab stop while still refusing an edit to a value already travelling. */}
        <Input
          key={seed.key}
          id={inputId}
          name="name"
          data-testid="shell-rename-input"
          defaultValue={name}
          aria-describedby={hintId}
          readOnly={pending}
          aria-busy={pending}
          onChange={(event) => {
            setSpent(answer);
            setTyped(event.target.value);
          }}
        />
        {/* In flight the slot is empty (§1): `useActionState` keeps the last answer for the whole
            pending window, and leaving it painted would tell a person that the submission they are
            waiting on is already saved — or already refused. */}
        {/* The region waits here from the first paint, empty, so the saved notice is an insertion
            into something a reader is already watching rather than a `role="status"` node that
            arrives with its sentence already inside it (Q-11). The wrapper carries no `status`
            role of its own — the notice is what claims to be one, and only when there is one. The
            notice overrides no `aria-live`: the algorithm resolves a changed node against the
            nearest `aria-live` from the node itself upward, so `off` here would file the insertion
            under an off region and announce nothing, where a nested polite region is at worst read
            twice. */}
        <div className="cx-shell-live" aria-live="polite">
          {!pending && current !== null && current.renamed ? (
            <div className="cx-shell-outcome cx-shell-notice" role="status">
              {strings.shell_rename_saved}
            </div>
          ) : null}
        </div>
        {!pending && current !== null && !current.renamed ? (
          <div className="cx-shell-outcome" data-testid="shell-rename-refusal">
            {"blankName" in current ? (
              // An alert is not a notice: a rejected save may not wear the chrome a completed one
              // wears, or the only channel telling them apart is the sentence itself.
              <p className="cx-shell-alert" role="alert">
                {strings.shell_rename_refusal}
              </p>
            ) : (
              <RefusalState refusal={refusalOf(current.refusal)} evidence={evidenceFor(current.refusal)} />
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
