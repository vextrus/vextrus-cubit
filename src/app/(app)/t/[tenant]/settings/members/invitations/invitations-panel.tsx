"use client";
// R-SPINE-003's invitations, as the members screen shows them on the v22 settings template
// (Design Direction 00 §3.6): the offers that still stand as a second 28 px table under the roster,
// and the form that makes one standing on the section's own line — one field and the screen's one
// primary, never a labelled block above the list it adds a row to.
//
// The panel holds no rule of its own — who may invite, whether an origin is served here and what a
// failure is called are all the server's, behind `guardTenancyMutation` (I-56, B-17, R-SPINE-006).
//
// Every control renders for every reader whatever role they hold: R-SPINE-006 forbids UI hiding, so
// the answer to a move a role does not carry is the server's refusal, rendered in place by the one
// renderer (I-57, R-UI-020). The pending list is never silent: a workspace nobody has invited says
// so, in one line where the rows would be.
import { useId, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { refusalOf, type RefusalCode } from "@/core/errors";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Button, EnumLabel, Input } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { fill } from "@/ui/strings";
import { SettingsAbout } from "../../settings-pane";
import { inviteMemberAction, resendInvitationAction, revokeInvitationAction, type InvitationsAnswer } from "./actions";
import { invitationsStrings } from "./strings";
import { membersRoute } from "../route-address";
import { membersStrings } from "../strings";
import { TESTIDS } from "@/ui/testids";

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

/** The moves a control can ask for. An invite clears the field it was typed in; the others do not. */
type MoveKind = "invite" | "resend" | "revoke";

/** A refusal that stands, and the move that asked for it — at most one at a time (I-57). */
interface Refused {
  readonly code: RefusalCode;
}

/** The grid's identity, under which this reader's column furniture is remembered (§5 rule 3). */
const PENDING_TABLE_ID = "members-invitations";

export function InvitationsPanel({
  tenantId,
  rows,
  invite = inviteMemberAction,
  resend = resendInvitationAction,
  revoke = revokeInvitationAction,
}: InvitationsPanelProps) {
  const [email, setEmail] = useState("");
  const [inFlight, setInFlight] = useState(0);
  const [refused, setRefused] = useState<Refused | null>(null);
  // Whether the last submission landed. The changed list is the visible answer, so the line says
  // only that the answer is on the page — a re-read the revalidation performed.
  const [settled, setSettled] = useState(false);
  const ids = { heading: useId(), email: useId() };

  // Every submission is sent, in the order it was made. A move is a round trip, so two at once would
  // paint whichever answered last — but a press this screen DROPPED would be an attempt the server
  // never judged, and R-SPINE-006 answers a burst with the door's own refusal rather than letting the
  // screen swallow it. So they queue: each move waits for the one before it and then goes.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // The same count as `inFlight`, readable inside a move rather than a render: what it decides is
  // whether the field may be cleared, and clearing it under a submission somebody has already typed
  // would send the empty address they are about to send instead.
  const queued = useRef(0);

  const submit = (kind: MoveKind, move: () => Promise<InvitationsAnswer>): void => {
    queued.current += 1;
    setInFlight(queued.current);
    const send = async (): Promise<void> => {
      try {
        const answered = await move();
        if (answered.moved) {
          setRefused(null);
          setSettled(true);
          if (kind === "invite" && queued.current === 1) setEmail("");
          return;
        }
        setSettled(false);
        setRefused({ code: answered.refusal });
      } finally {
        queued.current -= 1;
        setInFlight(queued.current);
      }
    };
    // Chained on the one before whether it answered or failed: a fault travels on to the boundary
    // (ARCH-03) and the queue behind it still drains, so no later submission is lost to it.
    queue.current = queue.current.then(send, send);
  };

  const columns = useMemo<ColumnDef<InvitationsRow, unknown>[]>(
    () => [
      {
        id: "invitee",
        header: invitationsStrings.invitations_email_label,
        size: 320,
        cell: ({ row }) => <span className="cx-invitations-invitee">{row.original.label}</span>,
      },
      {
        id: "role",
        header: invitationsStrings.invitations_col_role,
        size: 140,
        // §6: a person reads "Member"; the store's own word travels in the technical channel the
        // primitive publishes, which is where an operator and a suite read it from.
        cell: ({ row }) => <EnumLabel value={row.original.role} />,
      },
      {
        id: "acts",
        header: "",
        size: 200,
        cell: ({ row }) => (
          <span className="cx-invitations-controls">
            <Button
              type="button"
              variant="ghost"
              className="cx-invitations-act"
              data-testid={TESTIDS.invitations.resend}
              aria-label={fill(invitationsStrings.invitations_resend_label, { invitee: row.original.label })}
              onClick={() => submit("resend", () => resend({ tenantId, invitationId: row.original.invitationId }))}
            >
              {invitationsStrings.invitations_resend}
            </Button>
            {/* Withdrawing is not the screen's danger act: an offer nobody has accepted can be made
                again, and the one danger style on this screen is the roster's removal (§3.6). */}
            <Button
              type="button"
              variant="ghost"
              className="cx-invitations-act"
              data-testid={TESTIDS.invitations.revoke}
              aria-label={fill(invitationsStrings.invitations_revoke_label, { invitee: row.original.label })}
              onClick={() => submit("revoke", () => revoke({ tenantId, invitationId: row.original.invitationId }))}
            >
              {invitationsStrings.invitations_revoke}
            </Button>
          </span>
        ),
      },
    ],
    // The cells close over the two settlements and the tenant they are made in, and over nothing
    // that changes while a reader is on the screen.
    [tenantId, resend, revoke],
  );

  return (
    <div className="cx-invitations">
      {/* The section's own line: what this table holds, how many stand, and the one primary that
          adds a row to it. The invite form comes before the pending list in document order, where
          I-61 fixed it. */}
      <div className="cx-settings-section-head">
        <h2 className="cx-settings-section-heading" id={ids.heading}>
          {invitationsStrings.invitations_heading}
        </h2>
        <span className="cx-settings-count">{rows.length}</span>
        <SettingsAbout body={[invitationsStrings.invitations_hint, invitationsStrings.invitations_email_hint]} label={invitationsStrings.invitations_heading} />

        <form
          className="cx-invitations-form cx-settings-section-end"
          data-testid={TESTIDS.members.inviteForm}
          aria-labelledby={ids.heading}
          onSubmit={(event) => {
            event.preventDefault();
            submit("invite", () => invite({ tenantId, email }));
          }}
        >
          <Input
            className="cx-invitations-email"
            data-testid={TESTIDS.invitations.email}
            id={ids.email}
            aria-label={invitationsStrings.invitations_email_label}
            placeholder={invitationsStrings.invitations_email_label}
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {/* No loading state on any control here: core's Button swallows its own activation while
              it is loading, and a submission swallowed on this side is an attempt the server's
              allowance never counts (R-SPINE-006). The status line below says a move is in flight. */}
          <Button type="submit" variant="primary" data-testid={TESTIDS.invitations.submit}>
            {invitationsStrings.invitations_submit}
          </Button>
        </form>
      </div>

      <section className="cx-invitations-pending" aria-labelledby={ids.heading} data-testid={TESTIDS.members.pendingInvitations}>
        {rows.length === 0 ? (
          // R-UI-020: a workspace nobody has invited anyone to says so, in the line where the rows
          // would be, rather than showing an empty box with a header over it.
          <p className="cx-invitations-none" data-testid={TESTIDS.invitations.none}>
            {invitationsStrings.invitations_none}
          </p>
        ) : (
          <div className="cx-invitations-table">
            <DataTable
              tableId={PENDING_TABLE_ID}
              aria-label={invitationsStrings.invitations_pending_heading}
              columns={columns}
              data={[...rows]}
              getRowId={(row) => row.invitationId}
              rowTestId="invitations-row"
              rowDataOf={(row) => ({ "data-invitation": row.invitationId })}
            />
          </div>
        )}
      </section>

      {/* I-57: one answer slot for the panel, mounted only while a refusal stands. The controls above
          stay armed — a retry is never disarmed (R-SPINE-006). */}
      {refused !== null ? (
        <div className="cx-invitations-answer" data-testid={TESTIDS.invitations.refusal}>
          <RefusalState
            refusal={refusalOf(refused.code)}
            evidence={{ href: membersRoute(tenantId), label: membersStrings.members_evidence_roster }}
          />
        </div>
      ) : null}

      <p className="cx-invitations-status" role="status" aria-live="polite">
        {inFlight > 0
          ? invitationsStrings.invitations_status_pending
          : settled && refused === null
            ? invitationsStrings.invitations_status_done
            : ""}
      </p>
    </div>
  );
}
