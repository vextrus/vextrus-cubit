"use client";
// R-SPINE-003's invitations, as the members screen shows them: the form that offers somebody a
// membership, and the offers that still stand with the two moves each one carries. The panel holds
// no rule of its own — who may invite, whether an origin is served here and what a failure is called
// are all the server's, behind `guardTenancyMutation` (I-56, B-17, R-SPINE-006).
//
// Every control renders for every member whatever role the reader holds: R-SPINE-006 forbids UI
// hiding, so the answer to a move a role does not carry is the server's refusal, rendered in place
// by the one renderer (I-57, R-UI-020). The pending list is never silent: a workspace nobody has
// invited says so.
//
// The panel takes what the page composed and the three actions, so a suite mounts the same component
// a browser renders with the settlement of its choice (the MembersSection precedent).
import { useId, useState } from "react";
import { refusalOf, type RefusalCode } from "../../../../../../../core/errors";
import { RefusalState } from "../../../../../../../ui/patterns/refusal-state";
import { Button, Input } from "../../../../../../../ui/primitives/core";
import { fill } from "../../../../../../../ui/strings";
import { inviteMemberAction, resendInvitationAction, revokeInvitationAction, type InvitationsAnswer } from "./actions";
import { invitationsStrings } from "./strings";
import { membersRoute } from "../route-address";
import { membersStrings } from "../strings";

/** One standing offer, as the page composed it from the module's answer. */
export interface InvitationsRow {
  readonly invitationId: string;
  /** The invitee as a reader recognises them (I-58) — the address behind the stored key. */
  readonly label: string;
  readonly role: string;
}

export interface InvitationsPanelProps {
  tenantId: string;
  rows: readonly InvitationsRow[];
  invite?: typeof inviteMemberAction;
  resend?: typeof resendInvitationAction;
  revoke?: typeof revokeInvitationAction;
}

/** Which submission is in flight, so the control that made it is the one that reads as busy. */
interface InFlight {
  readonly at: string;
  readonly kind: "invite" | "resend" | "revoke";
}

/** A refusal that stands, and the move that asked for it — at most one at a time (I-57). */
interface Refused {
  readonly code: RefusalCode;
}

/** The invite form's own key in the in-flight record: it belongs to no row. */
const INVITE_FORM = "";

export function InvitationsPanel({
  tenantId,
  rows,
  invite = inviteMemberAction,
  resend = resendInvitationAction,
  revoke = revokeInvitationAction,
}: InvitationsPanelProps) {
  const [email, setEmail] = useState("");
  const [inFlight, setInFlight] = useState<InFlight | null>(null);
  const [refused, setRefused] = useState<Refused | null>(null);
  // Whether the last submission landed. The changed list is the visible answer, so the line says
  // only that the answer is on the page — a re-read the revalidation performed.
  const [settled, setSettled] = useState(false);
  const ids = { heading: useId(), pending: useId(), email: useId(), emailHint: useId() };

  const submit = async (at: string, kind: InFlight["kind"], move: () => Promise<InvitationsAnswer>): Promise<void> => {
    // A move is a round trip and the list stays where it is while one is in flight: a second press
    // would send a second move for the same offer and paint whichever answered last.
    if (inFlight !== null) return;
    setRefused(null);
    setSettled(false);
    setInFlight({ at, kind });
    const answered = await move();
    setInFlight(null);
    if (answered.moved) {
      setSettled(true);
      if (kind === "invite") setEmail("");
      return;
    }
    setRefused({ code: answered.refusal });
  };

  const busy = (at: string, kind: InFlight["kind"]): boolean => inFlight?.at === at && inFlight.kind === kind;

  return (
    <div className="cx-invitations">
      <header className="cx-invitations-header">
        <h2 className="cx-invitations-heading" id={ids.heading}>
          {invitationsStrings.invitations_heading}
        </h2>
        <p className="cx-invitations-hint">{invitationsStrings.invitations_hint}</p>
      </header>

      <form
        className="cx-invitations-form"
        data-testid="members-invite-form"
        aria-labelledby={ids.heading}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(INVITE_FORM, "invite", () => invite({ tenantId, email }));
        }}
      >
        <label className="cx-invitations-label" htmlFor={ids.email}>
          {invitationsStrings.invitations_email_label}
        </label>
        <p className="cx-invitations-field-hint" id={ids.emailHint}>
          {invitationsStrings.invitations_email_hint}
        </p>
        <div className="cx-invitations-field">
          <Input
            className="cx-invitations-email"
            data-testid="invitations-email"
            id={ids.email}
            aria-describedby={ids.emailHint}
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" variant="primary" data-testid="invitations-submit" loading={busy(INVITE_FORM, "invite")}>
            {invitationsStrings.invitations_submit}
          </Button>
        </div>
      </form>

      <section className="cx-invitations-pending" aria-labelledby={ids.pending} data-testid="members-pending-invitations">
        <h3 className="cx-invitations-pending-heading" id={ids.pending}>
          {invitationsStrings.invitations_pending_heading}
        </h3>

        <ul className="cx-invitations-list">
          {rows.map((row) => (
            <li className="cx-invitations-row" data-testid="invitations-row" data-invitation={row.invitationId} key={row.invitationId}>
              <p className="cx-invitations-identity">
                <span className="cx-invitations-invitee">{row.label}</span>
                {/* I-55: the store's own word, verbatim and mono — never title-cased into prose. */}
                <span className="cx-invitations-role">{row.role}</span>
              </p>
              <div className="cx-invitations-controls">
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="invitations-resend"
                  aria-label={fill(invitationsStrings.invitations_resend_label, { invitee: row.label })}
                  loading={busy(row.invitationId, "resend")}
                  onClick={() => void submit(row.invitationId, "resend", () => resend({ tenantId, invitationId: row.invitationId }))}
                >
                  {invitationsStrings.invitations_resend}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  data-testid="invitations-revoke"
                  aria-label={fill(invitationsStrings.invitations_revoke_label, { invitee: row.label })}
                  loading={busy(row.invitationId, "revoke")}
                  onClick={() => void submit(row.invitationId, "revoke", () => revoke({ tenantId, invitationId: row.invitationId }))}
                >
                  {invitationsStrings.invitations_revoke}
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {/* R-UI-020: a workspace nobody has invited anyone to says so, rather than showing an empty
            box where a list would be. */}
        {rows.length === 0 ? (
          <p className="cx-invitations-none" data-testid="invitations-none">
            {invitationsStrings.invitations_none}
          </p>
        ) : null}
      </section>

      {/* I-57: one answer slot for the panel, mounted only while a refusal stands. The controls above
          stay armed — a retry is never disarmed (R-SPINE-006). */}
      {refused !== null && inFlight === null ? (
        <div className="cx-invitations-answer" data-testid="invitations-refusal">
          <RefusalState
            refusal={refusalOf(refused.code)}
            evidence={{ href: membersRoute(tenantId), label: membersStrings.members_evidence_roster }}
          />
        </div>
      ) : null}

      <p className="cx-invitations-status" role="status" aria-live="polite">
        {inFlight !== null
          ? invitationsStrings.invitations_status_pending
          : settled && refused === null
            ? invitationsStrings.invitations_status_done
            : ""}
      </p>
    </div>
  );
}
