"use client";
// R-SPINE-003's ACCEPT surface: what the invitee is being asked to join, and the one control that
// spends the mailed token. The form holds no rule of its own — whether the token names an offer this
// account may claim is the server's, behind `guardTenancyMutation` (B-17, R-SPINE-006), and this
// screen shows what came back.
//
// It is built on the Auth template (Design Direction 00 §3.7): one card, 360 wide, on the panel
// surface with a hairline and radius 8, holding one decision and one act button, with the mono
// readout at the foot. It carries no mark — the full spark belongs to the unauthenticated surface
// and to certificates (R-UI-070, s-auth I-10), and this screen is behind the session door — so the
// card stands at the top of the column rather than under a 48 px lead that holds nothing.
//
// The refusal is rendered here too, by the same component in both places it can arise: the screen
// that judged the token before it drew anything, and the submit whose offer stopped standing in
// between. One surface, so an unclaimable token reads the same however it became one (I-57).
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { refusalOf, type RefusalCode, type RefusalEntry } from "@/core/errors";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Button, EnumLabel } from "@/ui/primitives/core";
import { strings } from "@/ui/strings";
import { acceptInvitationAction, type AcceptAnswer } from "./actions";
import { acceptInvitationStrings } from "./strings";
import { TESTIDS } from "@/ui/testids";

/** The address this screen answers at — the first cell of the foot readout, not copy (§1). */
const ROUTE = "/accept-invitation";

/** The heading every state of this screen opens with, named once so the card can point at it. */
const TITLE_ID = "accept-invitation-title";

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

/** What the last attempt came to, as the foot's one cell reads it (the S-Auth readout's states). */
type AcceptStatus = "idle" | "working" | "settled" | "refused";

/**
 * The screen's frame, and every state stands in it (I-68): the page's single `<main>`, one column,
 * one card under the heading, and the readout at the foot. A refusal reached straight out of an
 * email meets the same frame as an offer, so it never lands as an alert with no page identity.
 */
function AcceptFrame({ status, said, children }: { status: AcceptStatus; said?: string; children: ReactNode }) {
  return (
    <main className="cx-accept">
      <div className="cx-accept-column">
        <section className="cx-accept-card" aria-labelledby={TITLE_ID}>{children}</section>
        {/* The readout: where you are, what the last attempt came to, and — while it is happening —
            what that is, in words. The dot repeats the words, so nothing means by colour alone
            (R-UI-060); the words are the live region, because they are the part worth hearing. */}
        <div className="cx-accept-foot">
          <span className="cx-accept-foot-where">{ROUTE}</span>
          <span className="cx-accept-foot-dot" data-status={status} aria-hidden="true" />
          <span className="cx-accept-foot-said" role="status" aria-live="polite">
            {said ?? ""}
          </span>
        </div>
      </div>
    </main>
  );
}

/** The one heading, said once, in every state of the screen. */
function AcceptHeading({ children }: { children: string }) {
  return (
    <h1 className="cx-accept-heading" id={TITLE_ID}>
      {children}
    </h1>
  );
}

/**
 * The one place a registered refusal is answered on this screen, with the register's own words and
 * its code beside them, machine-readably (R-UI-020, Q-07). The evidence is the workspaces the person
 * already holds: whatever went wrong with this offer, that is where they can still go.
 */
export function AcceptInvitationRefusal({ refusal }: { refusal: RefusalEntry }) {
  return (
    <div className="cx-accept-answer" data-testid={TESTIDS.accept.invitationRefusal}>
      <RefusalState refusal={refusal} evidence={{ href: "/", label: acceptInvitationStrings.accept_evidence_workspaces }} />
    </div>
  );
}

/**
 * The refusal standing ALONE, where the page judged the token before it drew anything (I-65). It is
 * the same answer slot as above — one renderer, both places — laid in the screen's own card, which
 * is what gives it the page's `<main>`, its measure and the heading that says what page this is.
 */
export function AcceptInvitationUnclaimable({ refusal }: { refusal: RefusalEntry }) {
  return (
    <AcceptFrame status="refused">
      <AcceptHeading>{acceptInvitationStrings.accept_heading}</AcceptHeading>
      <AcceptInvitationRefusal refusal={refusal} />
    </AcceptFrame>
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

  const status: AcceptStatus = inFlight ? "working" : refused !== null ? "refused" : settled ? "settled" : "idle";
  const said = inFlight
    ? acceptInvitationStrings.accept_status_pending
    : settled && refused === null
      ? acceptInvitationStrings.accept_status_done
      : undefined;

  return (
    <AcceptFrame status={status} said={said}>
      <AcceptHeading>{acceptInvitationStrings.accept_heading}</AcceptHeading>

      <form
        className="cx-accept-form"
        data-testid={TESTIDS.accept.invitationForm}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <dl className="cx-accept-facts">
          <dt className="cx-accept-term">{acceptInvitationStrings.accept_workspace_label}</dt>
          {/* I-55: the workspace's own name, verbatim as data — never woven into a sentence. */}
          <dd className="cx-accept-value" data-testid={TESTIDS.accept.invitationWorkspace}>
            {offer.workspaceName}
          </dd>
          <dt className="cx-accept-term">{acceptInvitationStrings.accept_role_label}</dt>
          {/* The role is a model value said in words: "Member", never MEMBER (§3.7, §6). The raw
              value stays in the DOM inside EnumLabel's technical span, so an engineer and a suite
              still find it — it is simply not what the screen says out loud. */}
          <dd className="cx-accept-value">
            <EnumLabel value={offer.workspaceRole} />
          </dd>
        </dl>

        {/* One act button: accepting mints a membership, which is a consequence, and the copper dot
            is what says so on this product (§1, R-UI-040). It is the only copper on the screen. */}
        <Button className="cx-accept-submit" type="submit" variant="act" data-testid={TESTIDS.accept.invitationSubmit} loading={inFlight}>
          {acceptInvitationStrings.accept_submit}
        </Button>
      </form>

      {refused !== null && !inFlight ? <AcceptInvitationRefusal refusal={refusalOf(refused)} /> : null}
    </AcceptFrame>
  );
}

/** The screen with no link behind it: it teaches what is missing rather than showing an empty form. */
export function AcceptInvitationNoToken() {
  return (
    <AcceptFrame status="idle">
      <AcceptHeading>{acceptInvitationStrings.accept_no_token_heading}</AcceptHeading>
      {/* The one line of helper copy this screen is allowed, and the state that needs it is where
          §6 rules it belongs. The `<h1>` is the empty state's title by I-68, so the EmptyState
          shell is not used here: its own `<h2>` heading would say the same words a second time. */}
      <p className="cx-accept-caption">{acceptInvitationStrings.accept_no_token_body}</p>
      <a className="cx-accept-evidence cx-reticle" href="/">
        {strings.shell_evidence_home}
      </a>
    </AcceptFrame>
  );
}
