"use client";
// R-SPINE-003's ACCEPT surface: what the invitee is being asked to join, and the one control that
// spends the mailed token. The form holds no rule of its own — whether the token names an offer this
// account may claim is the server's, behind `guardTenancyMutation` (B-17, R-SPINE-006), and this
// screen shows what came back.
//
// The refusal is rendered here too, by the same component in both places it can arise: the screen
// that judged the token before it drew anything, and the submit whose offer stopped standing in
// between. One surface, so an unclaimable token reads the same however it became one (I-57).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { refusalOf, type RefusalCode, type RefusalEntry } from "../../../core/errors";
import { RefusalState } from "../../../ui/patterns/refusal-state";
import { Button } from "../../../ui/primitives/core";
import { strings } from "../../../ui/strings";
import { acceptInvitationAction, type AcceptAnswer } from "./actions";
import { acceptInvitationStrings } from "./strings";

/** What the screen is asking the invitee to decide about, as the page read it off the token. */
export interface AcceptInvitationOffer {
  readonly workspaceName: string;
  readonly workspaceRole: string;
}

export interface AcceptInvitationFormProps {
  token: string;
  offer: AcceptInvitationOffer;
  accept?: typeof acceptInvitationAction;
}

/**
 * The one place a registered refusal is answered on this screen, with the register's own words and
 * its code beside them, machine-readably (R-UI-020, Q-07). The evidence is the workspaces the person
 * already holds: whatever went wrong with this offer, that is where they can still go.
 */
export function AcceptInvitationRefusal({ refusal }: { refusal: RefusalEntry }) {
  return (
    <div className="cx-accept-answer" data-testid="accept-invitation-refusal">
      <RefusalState refusal={refusal} evidence={{ href: "/", label: acceptInvitationStrings.accept_evidence_workspaces }} />
    </div>
  );
}

/**
 * A refusal standing ALONE, where the page was answered before it drew an offer (I-65). It is
 * the same answer slot as above — one renderer, both places — laid in the screen's own column, which
 * is what gives it the page's `<main>`, its measure and the heading that says what page this is.
 * A person arriving from a mail link meets an alert with no page identity otherwise, and a card that
 * runs off both edges of the window.
 */
export function AcceptInvitationRefused({ refusal }: { refusal: RefusalEntry }) {
  return (
    <main className="cx-accept">
      <header className="cx-accept-header">
        <h1 className="cx-accept-heading">{acceptInvitationStrings.accept_heading}</h1>
      </header>
      <AcceptInvitationRefusal refusal={refusal} />
    </main>
  );
}

export function AcceptInvitationForm({ token, offer, accept = acceptInvitationAction }: AcceptInvitationFormProps) {
  const router = useRouter();
  const [inFlight, setInFlight] = useState(false);
  const [refused, setRefused] = useState<RefusalCode | null>(null);
  const [settled, setSettled] = useState(false);

  const submit = async (): Promise<void> => {
    // Accepting is a round trip and the offer stays on the page while one is in flight: a second
    // press would spend a token the first press is already spending.
    if (inFlight) return;
    setRefused(null);
    setSettled(false);
    setInFlight(true);
    const answered: AcceptAnswer = await accept({ token });
    setInFlight(false);
    if (!answered.accepted) {
      setRefused(answered.refusal);
      return;
    }
    setSettled(true);
    // The membership is the answer, and the workspace it bought is where a person goes next: they
    // land inside it in the session that accepted, with the switcher now offering both.
    router.push(`/t/${answered.tenantId}`);
  };

  return (
    <main className="cx-accept">
      <header className="cx-accept-header">
        <h1 className="cx-accept-heading">{acceptInvitationStrings.accept_heading}</h1>
        <p className="cx-accept-caption">{acceptInvitationStrings.accept_caption}</p>
      </header>

      <form
        className="cx-accept-form"
        data-testid="accept-invitation-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <dl className="cx-accept-facts">
          <dt className="cx-accept-term">{acceptInvitationStrings.accept_workspace_label}</dt>
          {/* I-55: the workspace's own name, verbatim as data — never woven into a sentence. */}
          <dd className="cx-accept-value" data-testid="accept-invitation-workspace">
            {offer.workspaceName}
          </dd>
          <dt className="cx-accept-term">{acceptInvitationStrings.accept_role_label}</dt>
          <dd className="cx-accept-value cx-accept-role">{offer.workspaceRole}</dd>
        </dl>

        <Button type="submit" variant="primary" data-testid="accept-invitation-submit" loading={inFlight}>
          {acceptInvitationStrings.accept_submit}
        </Button>
      </form>

      {refused !== null && !inFlight ? <AcceptInvitationRefusal refusal={refusalOf(refused)} /> : null}

      <p className="cx-accept-status" role="status" aria-live="polite">
        {inFlight
          ? acceptInvitationStrings.accept_status_pending
          : settled && refused === null
            ? acceptInvitationStrings.accept_status_done
            : ""}
      </p>
    </main>
  );
}

/** The screen with no link behind it: it teaches what is missing rather than showing an empty form. */
export function AcceptInvitationNoToken() {
  return (
    <main className="cx-accept">
      <header className="cx-accept-header">
        <h1 className="cx-accept-heading">{acceptInvitationStrings.accept_no_token_heading}</h1>
        <p className="cx-accept-caption">{acceptInvitationStrings.accept_no_token_body}</p>
      </header>
      <p className="cx-accept-status">
        <a className="cx-accept-evidence cx-reticle" href="/">
          {strings.shell_evidence_home}
        </a>
      </p>
    </main>
  );
}
