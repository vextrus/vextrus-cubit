/**
 * The seven shapes R-UI-050 names, each in one home (B-17): a skeleton that keeps the layout, an
 * empty state that teaches the next action, a fault card offering retry, a refusal carrying its code
 * and remedy, a partial answer that shows what it could not get rather than hiding it, an offline
 * answer that says what is still true, and a denial that names the permission and who holds it.
 *
 * Nothing here is a second implementation of a shipped surface. The empty state is the frame
 * `src/ui/shell` publishes, the refusal is the one renderer `src/ui/patterns/refusal-state`
 * publishes, the denial is the frameless surface the shell publishes, and the bones are the core
 * Skeleton. What this module adds is the wrapper that files a rendered state under its own name.
 *
 * The fault card is composed rather than imported: the shipped boundary is `src/app/error.tsx`, and
 * `src/ui` never imports `src/app` (ARCH-01). Its words are the spine table's `error_` keys, so the
 * sentence a person reads still has one home.
 */
import type { ReactNode } from "react";
import type { RefusalEntry } from "../../core/errors";
import { Button, Skeleton } from "../primitives/core";
import { RefusalState } from "../patterns/refusal-state";
import type { RefusalEvidence } from "../patterns/refusal-state/refusal-state";
import { ShellDenied, ShellEmptyState } from "../shell";
import { strings } from "../strings";
import { SCREEN_STATE_TESTID } from "./contract";
import type { ScreenStateName } from "./contract";

/**
 * The root every declared state renders under. `state` is the key the declaration is filed at, so
 * the attribute and the name are one value and cannot drift apart (the GalleryState coupling).
 */
export function StateShell({ state, children }: { state: ScreenStateName; children: ReactNode }) {
  return (
    <div className="cx-screen-state" data-testid={SCREEN_STATE_TESTID} data-state={state}>
      {children}
    </div>
  );
}

/**
 * R-UI-004's loading vocabulary: bones that keep the layout, never a spinner. A bone announces
 * nothing on its own — the primitive hides each one from the accessibility tree — so the screen
 * announces the wait itself, in the live region a reader hears it in (R-UI-060, Q-11).
 */
export function LoadingBones({ bones }: { bones: number }) {
  return (
    <>
      <p role="status">{strings.state_loading}</p>
      {Array.from({ length: bones }, (unused, index) => (
        <Skeleton key={index} />
      ))}
    </>
  );
}

/**
 * The loading state of a screen that waits on nothing until it is used: the submit keeps its label
 * and its focus and reports `aria-busy`, which is R-UI-004's "announced, never spun". A page
 * skeleton would be theatre where nothing loads before input.
 */
export function BusySubmit({ label }: { label: string }) {
  return <Button loading={true}>{label}</Button>;
}

/**
 * A door's own answer to what it was given — R-UI-033's "say it where the answer is read". It is
 * not of the closed taxonomy (R-SPINE-062), so it does not render through the refusal renderer,
 * whose type admits registered entries only.
 */
export function InlineAnswer({ text }: { text: string }) {
  return (
    <p className="cx-screen-state-answer" role="alert">
      {text}
    </p>
  );
}

/** R-UI-050's empty state: what the screen is for, and its one next action. */
export function EmptyTeaching({ heading, body, action }: { heading: string; body: string; action: string }) {
  return (
    <ShellEmptyState heading={heading} body={body}>
      <Button variant="secondary">{action}</Button>
    </ShellEmptyState>
  );
}

/**
 * R-UI-050's error state: what happened, that the work is safe, and a retry that is always
 * available. The report id the clause also names is the styled error primitive's, deferred with a
 * named owner by the root boundary's own Decision (I-1) rather than shown here as a bare digest.
 */
export function FaultCard({ body }: { body: string }) {
  return (
    <>
      <h2>{strings.error_title}</h2>
      <p>{body}</p>
      <Button variant="secondary">{strings.error_retry}</Button>
    </>
  );
}

/** R-UI-050's refusal state, through the one renderer: the register's message, remedy and evidence. */
export function Refusal({ refusal, evidence }: { refusal: RefusalEntry; evidence: RefusalEvidence }) {
  return <RefusalState refusal={refusal} evidence={evidence} />;
}

/**
 * R-UI-050's partial state: rows that were refused are shown, not hidden — the answer that did
 * arrive stands, and the refusal that stopped the rest renders in place beside it.
 */
export function PartialAnswer({ shown, refusal, evidence }: { shown: string; refusal: RefusalEntry; evidence: RefusalEvidence }) {
  return (
    <>
      <p role="status">{shown}</p>
      <RefusalState refusal={refusal} evidence={evidence} />
    </>
  );
}

/**
 * R-UI-050's permission-denied state where a screen names its own permission and its own holders.
 * The workspace's own denial is the shell's frameless surface and is rendered by `Denial` below;
 * this is the in-screen branch, and the refusal under it is still the one renderer's.
 */
export function PermissionDenied({
  heading,
  permission,
  holder,
  refusal,
  evidence,
}: {
  heading: string;
  permission: string;
  holder: string;
  refusal: RefusalEntry;
  evidence: RefusalEvidence;
}) {
  return (
    <>
      <h2>{heading}</h2>
      <p>{permission}</p>
      <p>{holder}</p>
      <RefusalState refusal={refusal} evidence={evidence} />
    </>
  );
}

/** The workspace-level denial, as the shell ships it: the frame stands aside and names the holder. */
export function Denial({ refusal, evidence }: { refusal: RefusalEntry; evidence: RefusalEvidence }) {
  return <ShellDenied refusal={refusal} evidence={evidence} />;
}

/**
 * A state a screen's Decision rules cannot arise on it, with the reason it gave. R-UI-050 asks every
 * screen to declare all seven; a declaration that says why a state cannot occur is a claim with a
 * reason attached, which is what makes it reviewable (the `SHELL_STATES` "impossible" cell).
 */
export function StateReason({ reason }: { reason: string }) {
  return <p className="cx-screen-state-reason">{reason}</p>;
}
