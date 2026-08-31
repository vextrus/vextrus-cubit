"use client";
// The workspace's members (R-SPINE-003): who belongs to it, the role each one holds, the record of
// how their project roles moved, and the two forms that change a membership. The section holds no
// rule of its own — who may move whom, whether an origin is served here and what a failure is called
// are all the server's, behind `guardTenancyMutation` (I-56, B-17, R-SPINE-006).
//
// Both forms render on every row for every member whatever role the reader holds: R-SPINE-006 forbids
// UI hiding, so the answer to a move a role does not carry is the server's refusal, rendered in place
// by the one renderer in the row that asked (I-57, R-UI-020).
//
// The section takes what the page composed and the two actions, so a suite mounts the same component
// a browser renders with the settlement of its choice (the RulesetSettingsSection precedent).
import { useId, useState } from "react";
import { refusalOf, type RefusalCode } from "../../../../../../core/errors";
import { formatDate } from "../../../../../../core/format";
import { RefusalState } from "../../../../../../ui/patterns/refusal-state";
import { Button } from "../../../../../../ui/primitives/core";
import { shellHref } from "../../../../../../ui/shell";
import { fill, strings } from "../../../../../../ui/strings";
import { changeMemberRoleAction, removeMemberAction, type MembersAnswer } from "./actions";
import { membersRoute } from "./route-address";
import { membersStrings } from "./strings";

/** One movement on a member's record, with the project it happened on (I-59). */
export interface MembersHistoryEntry {
  readonly projectId: string;
  readonly direction: string;
  readonly role: string;
  /** The person who moved it, as a reader recognises them (I-58), or nobody for a bootstrap grant. */
  readonly actorLabel: string | null;
  /** The moment it happened, as an ISO instant — the screen states the day in the document's form. */
  readonly occurredAt: string;
}

/** One member of the workspace, as the page composed them from the module's answer. */
export interface MembersRow {
  readonly userId: string;
  readonly label: string;
  readonly role: string;
  readonly history: readonly MembersHistoryEntry[];
}

export interface MembersSectionProps {
  tenantId: string;
  rows: readonly MembersRow[];
  /**
   * The closed roster a role may be moved to (`WORKSPACE_ROLES`, I-55), stated by the page: the one
   * home of those three words is `src/core/db`, which is the driver's home too — a browser bundle
   * cannot import it, so the server hands the words down rather than this file spelling them again
   * (B-17, ARCH-01).
   */
  roles?: readonly string[];
  changeRole?: typeof changeMemberRoleAction;
  remove?: typeof removeMemberAction;
}

/** Which submission is in flight, so the button that made it is the one that reads as busy. */
interface InFlight {
  readonly userId: string;
  readonly kind: "role" | "removal";
}

/** A refusal that stands, and the row that asked for it — at most one at a time (I-57). */
interface Refused {
  readonly userId: string;
  readonly code: RefusalCode;
}

export function MembersSection({
  tenantId,
  rows,
  roles = [],
  changeRole = changeMemberRoleAction,
  remove = removeMemberAction,
}: MembersSectionProps) {
  const [chosen, setChosen] = useState<Readonly<Record<string, string>>>({});
  const [inFlight, setInFlight] = useState<InFlight | null>(null);
  const [refused, setRefused] = useState<Refused | null>(null);
  // Whether the last submission landed. The changed row is the visible answer, so the line says only
  // that the answer is on the page — a re-read the revalidation performed (§1).
  const [settled, setSettled] = useState(false);
  const headingIds = { members: useId(), roster: useId() };

  /**
   * The choices one row offers. The roster the server stated is the whole of them; the role the row
   * holds stands among them, so a select always has the member's current role to be preselected at.
   */
  const offered = (row: MembersRow): readonly string[] => (roles.includes(row.role) ? roles : [...roles, row.role]);

  const submit = async (row: MembersRow, kind: InFlight["kind"], move: () => Promise<MembersAnswer>): Promise<void> => {
    // A move is a round trip and the row stays where it is while one is in flight: a second press
    // would send a second move for the same membership and paint whichever answered last.
    if (inFlight !== null) return;
    setRefused(null);
    setSettled(false);
    setInFlight({ userId: row.userId, kind });
    const answered = await move();
    setInFlight(null);
    if (answered.moved) {
      setSettled(true);
      return;
    }
    setRefused({ userId: row.userId, code: answered.refusal });
  };

  const busy = (row: MembersRow, kind: InFlight["kind"]): boolean => inFlight?.userId === row.userId && inFlight.kind === kind;

  return (
    <div className="cx-members">
      <header className="cx-members-header">
        <h1 className="cx-members-heading">{membersStrings.members_heading}</h1>
        <p className="cx-members-caption">{membersStrings.members_caption}</p>
      </header>

      <section className="cx-members-roster" aria-labelledby={headingIds.roster} data-testid="members-section">
        <h2 className="cx-members-section-heading" id={headingIds.roster}>
          {membersStrings.members_roster_heading}
        </h2>
        {/* I-59: the scope of the histories is standing copy, said on every render rather than
            discovered by a reader who wonders what is missing. */}
        <p className="cx-members-hint">{membersStrings.members_roster_hint}</p>

        <ul className="cx-members-list" data-testid="members-list">
          {rows.map((row) => (
            <li className="cx-members-row" data-testid="members-row" data-user={row.userId} key={row.userId}>
              <p className="cx-members-identity">
                <span className="cx-members-member">{row.label}</span>
                {/* I-55: the store's own word, verbatim and mono — never title-cased into prose. */}
                <span className="cx-members-role" data-testid="members-row-role">
                  {row.role}
                </span>
              </p>

              <div className="cx-members-controls">
                <form
                  className="cx-members-form"
                  data-testid="members-role-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit(row, "role", () => changeRole({ tenantId, subjectUserId: row.userId, role: chosen[row.userId] ?? row.role }));
                  }}
                >
                  <input type="hidden" name="subjectUserId" value={row.userId} />
                  <select
                    className="cx-input cx-reticle cx-members-select"
                    data-testid="members-role-select"
                    name="role"
                    aria-label={membersStrings.members_role_label}
                    value={chosen[row.userId] ?? row.role}
                    onChange={(event) => setChosen((held) => ({ ...held, [row.userId]: event.target.value }))}
                  >
                    {offered(row).map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="secondary" data-testid="members-role-submit" loading={busy(row, "role")}>
                    {membersStrings.members_role_submit}
                  </Button>
                </form>

                <form
                  className="cx-members-form"
                  data-testid="members-remove-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit(row, "removal", () => remove({ tenantId, subjectUserId: row.userId }));
                  }}
                >
                  <input type="hidden" name="subjectUserId" value={row.userId} />
                  <Button type="submit" variant="danger" data-testid="members-remove-submit" loading={busy(row, "removal")}>
                    {membersStrings.members_remove_submit}
                  </Button>
                </form>
              </div>

              {/* I-57: one answer slot, in the row that asked, mounted only while a refusal stands. */}
              {refused !== null && refused.userId === row.userId && inFlight === null ? (
                <div className="cx-members-answer" data-testid="members-refusal">
                  <RefusalState refusal={refusalOf(refused.code)} evidence={evidenceFor(tenantId, refused.code)} />
                </div>
              ) : null}

              <MemberHistory history={row.history} />
            </li>
          ))}
        </ul>

        {/* The two things a round trip has to say beyond the roster itself. It stays silent while a
            refusal stands: the refusal is the answer, and a second sentence beside it would compete
            with the one that tells a person what to do (§1). */}
        <p className="cx-members-status" role="status" aria-live="polite" id={headingIds.members}>
          {inFlight !== null ? membersStrings.members_status_pending : settled && refused === null ? membersStrings.members_status_done : ""}
        </p>
      </section>
    </div>
  );
}

/** One member's record: every movement the workspace's ledgers hold about them, or the honest none. */
function MemberHistory({ history }: { history: readonly MembersHistoryEntry[] }) {
  const labelId = useId();
  return (
    <div className="cx-members-history-block">
      <span className="cx-members-history-label" id={labelId}>
        {membersStrings.members_history_label}
      </span>
      {/* The record is one list per member whether or not it holds a movement — a member with none
          has an empty record, not an absent one, and the honest line stands in the list's place. */}
      <ol className="cx-members-history" data-testid="members-role-history" aria-labelledby={labelId}>
        {history.map((entry, index) => (
          <li
            className="cx-members-history-row"
            data-testid="members-history-entry"
            data-project={entry.projectId}
            data-direction={entry.direction}
            data-role={entry.role}
            key={`${entry.occurredAt}-${entry.projectId}-${entry.direction}-${entry.role}-${index}`}
          >
            <p className="cx-members-history-what">
              <span className="cx-members-direction">{entry.direction}</span>
              <span className="cx-members-history-role">{entry.role}</span>
              {/* I-26: the id renders whole, so a person can quote the project it happened on. */}
              <span className="cx-members-history-project">{entry.projectId}</span>
            </p>
            <p className="cx-members-history-by">
              {fill(membersStrings.members_history_by, {
                actor: entry.actorLabel ?? membersStrings.members_member_unnamed,
                date: dayOf(entry.occurredAt),
              })}
            </p>
          </li>
        ))}
      </ol>
      {history.length === 0 ? <p className="cx-members-history-none">{membersStrings.members_history_none}</p> : null}
    </div>
  );
}

/**
 * Where each reachable refusal is resolved (§1). The acts a removal is refused for live on the
 * workspace's open campaigns, which are reached from Projects; every other one is resolved on this
 * roster — it names the owners, and the role form is where an owner is made. A session that ended
 * mid-action is answered by the actions' own redirect and never reaches here.
 */
function evidenceFor(tenantId: string, code: RefusalCode): { href: string; label: string } {
  return code === refusalOf("MEMBER_HAS_ACTS").code
    ? { href: shellHref(tenantId, "projects"), label: strings.home_evidence_projects }
    : { href: membersRoute(tenantId), label: membersStrings.members_evidence_roster };
}

/** The day a movement happened, in the document's own form (L-FMT-01, the participants precedent). */
function dayOf(occurredAt: string): string {
  const at = new Date(occurredAt);
  return formatDate({ year: at.getFullYear(), month: at.getMonth() + 1, day: at.getDate() });
}
