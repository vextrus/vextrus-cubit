"use client";
// The workspace's members (R-SPINE-003) on the v22 settings template (Design Direction 00 §3.6):
// a 40 px header — title, the `(i)` that holds what the caption used to print, the search — over a
// 28 px DataTable whose first row stands at the top of the pane. The section holds no rule of its
// own: who may move whom, whether an origin is served here and what a failure is called are all the
// server's, behind `guardTenancyMutation` (I-56, B-17, R-SPINE-006).
//
// Every control renders on every row for every member whatever role the reader holds: R-SPINE-006
// forbids UI hiding, so the answer to a move a role does not carry is the server's refusal,
// rendered in the row that asked (I-57, R-UI-020) — §5 rule 8's partial row, shown with a ⚠ and the
// refusal beneath it, never hidden.
//
// The one danger style on this screen lives in the row's `⋯` menu as its single item (I-202): a removal is
// irreversible, so it is never a red button sitting in a roster somebody is scrolling.
//
// The section takes what the page composed and the two actions, so a suite mounts the same
// component a browser renders with the settlement of its choice (the RulesetSettingsSection
// precedent).
import { useId, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { refusalOf, type RefusalCode } from "@/core/errors";
import { formatDate } from "@/core/format";
import { IconMoreHorizontal } from "@/ui/icons";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Button, Input, Select } from "@/ui/primitives/core";
// The humanising rule, from the primitive that owns it (B-17): a screen that title-cased a role
// itself would be a second opinion about how `OWNER` is said out loud.
import { humaniseEnum } from "@/ui/primitives/core/enum-label";
import { DataTable } from "@/ui/primitives/data";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/primitives/overlay";
import { shellHref } from "@/ui/shell";
import { fill, strings } from "@/ui/strings";
import { SettingsAbout, SettingsHeader } from "../settings-pane";
import { changeMemberRoleAction, removeMemberAction, type MembersAnswer } from "./actions";
import { membersRoute } from "./route-address";
import { membersStrings } from "./strings";
import { TESTIDS } from "@/ui/testids";

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
  /** The address a reader recognises them by, or nobody — a digest-keyed account has none (I-58). */
  readonly label: string | null;
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

/** Which submission is in flight, so the control that made it is the one that reads as busy. */
interface InFlight {
  readonly userId: string;
  readonly kind: "role" | "removal";
}

/** A refusal that stands, and the row that asked for it — at most one at a time (I-57). */
interface Refused {
  readonly userId: string;
  readonly code: RefusalCode;
}

/** The grid's identity, under which this reader's column furniture is remembered (§5 rule 3). */
const ROSTER_TABLE_ID = "members-roster";

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
  const [query, setQuery] = useState("");
  // Whether the last submission landed. The changed row is the visible answer, so the line says only
  // that the answer is on the page — a re-read the revalidation performed (§1).
  const [settled, setSettled] = useState(false);
  const searchId = useId();

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

  /** What the search stands for: a roster is read by the address and by the role, and by nothing else. */
  const matching = useMemo<readonly MembersRow[]>(() => {
    const asked = query.trim().toLowerCase();
    if (asked === "") return rows;
    return rows.filter((row) => `${row.label ?? membersStrings.members_member_unnamed} ${row.role} ${humaniseEnum(row.role)}`.toLowerCase().includes(asked));
  }, [rows, query]);

  const columns = useMemo<ColumnDef<MembersRow, unknown>[]>(
    () => [
      {
        id: "member",
        header: membersStrings.members_col_member,
        size: 280,
        cell: ({ row }) => {
          const member = row.original;
          const answered = refused !== null && refused.userId === member.userId && inFlight === null;
          return (
            <span className="cx-members-identity">
              <span className="cx-members-member">{member.label ?? membersStrings.members_member_unnamed}</span>
              {/* I-57: one answer slot, in the row that asked — §5 rule 8's partial row, so the row
                  stands with its ⚠ and the refusal reads beneath it. */}
              {answered ? (
                <span className="cx-members-answer" data-testid="members-refusal" data-user={member.userId}>
                  <RefusalState refusal={refusalOf(refused.code)} evidence={evidenceFor(tenantId, refused.code)} />
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: "role",
        header: membersStrings.members_col_role,
        size: 200,
        cell: ({ row }) => {
          const member = row.original;
          const standing = chosen[member.userId] ?? member.role;
          // The confirm stands when the row has something to confirm — a role other than the one in
          // force — and it stands again while a refusal is the row's last answer, because a retry is
          // never disarmed (R-SPINE-006).
          const confirmable = standing !== member.role || (refused !== null && refused.userId === member.userId && inFlight === null);
          return (
            <form
              className="cx-members-form"
              data-testid="members-role-form"
              onSubmit={(event) => {
                event.preventDefault();
                void submit(member, "role", () => changeRole({ tenantId, subjectUserId: member.userId, role: standing }));
              }}
            >
              <input type="hidden" name="subjectUserId" value={member.userId} />
              {/* The shipped Select in the row (§3.6): the words are the ones a person reads, and
                  the value the form carries is the store's own. */}
              <Select
                className="cx-members-select"
                data-testid="members-role-select"
                name="role"
                aria-label={fill(membersStrings.members_role_label, { member: spokenName(member) })}
                options={offered(member).map((role) => ({ value: role, label: humaniseEnum(role) }))}
                value={standing}
                onChange={(role) => setChosen((held) => ({ ...held, [member.userId]: role }))}
              />
              {/* The store's own word, in the technical channel: what a screen SAYS is "Owner", and
                  what it HOLDS is `OWNER` (§6, I-55). */}
              <span className="cx-members-role-raw" data-testid="members-row-role" data-technical="">
                {member.role}
              </span>
              {/* A row at rest is ONE control: a move is never carried out by a stray click on a
                  list, and a roster of N members is not a roster of 2N buttons. */}
              {confirmable ? (
                <Button
                  type="submit"
                  variant="secondary"
                  className="cx-members-role-submit"
                  data-testid="members-role-submit"
                  aria-label={fill(membersStrings.members_role_submit_label, { member: spokenName(member) })}
                  loading={busy(member, "role")}
                >
                  {membersStrings.members_role_submit}
                </Button>
              ) : null}
            </form>
          );
        },
      },
      {
        id: "history",
        header: membersStrings.members_history_label,
        size: 260,
        cell: ({ row }) => <MemberHistory history={row.original.history} />,
      },
      {
        id: "projects",
        header: membersStrings.members_col_projects,
        size: 96,
        meta: { align: "right" },
        cell: ({ row }) => <span className="cx-members-projects">{projectCount(row.original.history)}</span>,
      },
      {
        id: "menu",
        header: "",
        size: 48,
        // One control, no text: the cell is its well and the control fills it, so the row's menu and
        // the gridcell the grid puts the cursor on are ONE target (R-UI-012, SC 2.5.8).
        meta: { control: true },
        cell: ({ row }) => {
          const member = row.original;
          return (
            <RemoveMenu
              member={member}
              busy={busy(member, "removal")}
              onRemove={() => void submit(member, "removal", () => remove({ tenantId, subjectUserId: member.userId }))}
            />
          );
        },
      },
    ],
    // The cells close over the roster's own state, so the definitions are rebuilt when it moves and
    // at no other time. The two settlements and the submit they are called through are stable for
    // the life of the mount; what changes a cell is the state below it.
    [chosen, refused, inFlight, roles, tenantId, changeRole, remove],
  );

  return (
    <>
      <SettingsHeader title={membersStrings.members_heading} about={membersStrings.members_caption}>
        <Input
          className="cx-members-search"
          id={searchId}
          value={query}
          aria-label={membersStrings.members_search_label}
          placeholder={membersStrings.members_search_label}
          onChange={(event) => setQuery(event.target.value)}
        />
      </SettingsHeader>

      <section className="cx-members-roster" data-testid="members-section" aria-label={membersStrings.members_roster_heading}>
        <div className="cx-members-table cx-settings-surface" data-testid="members-list">
          <DataTable
            tableId={ROSTER_TABLE_ID}
            aria-label={membersStrings.members_roster_heading}
            columns={columns}
            data={[...matching]}
            getRowId={(row) => row.userId}
            rowTestId="members-row"
            rowDataOf={(row) => ({ "data-user": row.userId })}
            rowStateOf={(row) => (refused !== null && refused.userId === row.userId && inFlight === null ? { refused: true } : undefined)}
          />
        </div>

        {/* I-59's scope, where §6 puts a section's explanation: one press away, never a standing
            sentence under a heading. */}
        <div className="cx-members-roster-foot">
          {matching.length === 0 ? <p className="cx-members-none">{membersStrings.members_search_none}</p> : null}
          {/* The two things a round trip has to say beyond the roster itself. It stays silent while
              a refusal stands: the refusal is the answer, and a second sentence beside it would
              compete with the one that tells a person what to do (§1). */}
          <p className="cx-members-status" role="status" aria-live="polite">
            {inFlight !== null ? membersStrings.members_status_pending : settled && refused === null ? membersStrings.members_status_done : ""}
          </p>
          <SettingsAbout body={membersStrings.members_roster_hint} label={membersStrings.members_roster_heading} />
        </div>
      </section>
    </>
  );
}

/**
 * The row's one menu, and the one danger item in it (§3.6). The trigger is the control a removal is
 * asked for through, so it carries the removal's own name and its own id; the form beneath it is
 * what the item submits, so the move a person makes and the move a suite makes are one path.
 */
function RemoveMenu({ member, busy, onRemove }: { member: MembersRow; busy: boolean; onRemove: () => void }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      className="cx-members-menu-form"
      data-testid="members-remove-form"
      ref={form}
      onSubmit={(event) => {
        event.preventDefault();
        onRemove();
      }}
    >
      <input type="hidden" name="subjectUserId" value={member.userId} />
      <DropdownMenu>
        <DropdownMenuTrigger
          className="cx-members-menu"
          data-testid="members-remove-submit"
          aria-label={fill(membersStrings.members_remove_submit_label, { member: spokenName(member) })}
          aria-busy={busy || undefined}
        >
          <IconMoreHorizontal size="md" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="danger"
            onSelect={(event) => {
              // The item asks the row's own form to submit, so the path a person takes and the path
              // a suite takes are one path (B-17). The menu closes itself.
              event.preventDefault();
              form.current?.requestSubmit();
            }}
          >
            {membersStrings.members_remove_submit}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </form>
  );
}

/**
 * The name a row's controls are spoken under. A member with no readable address stored is named as
 * an unnamed member, and two of them are named alike — so a reader moving control by control meets
 * "Change role for Unnamed member" as many times as the workspace holds such accounts, with nothing
 * telling the rows apart (R-UI-012). Where the stored label carries no identity, the id does: it is
 * the accessible name only, and the row still SHOWS the sentence, because an id is an identifier
 * and not a name.
 */
function spokenName(row: MembersRow): string {
  return row.label ?? fill(membersStrings.members_member_unnamed_identified, { id: row.userId });
}

/** How many of this workspace's projects the reader's own record names for this member (I-59). */
function projectCount(history: readonly MembersHistoryEntry[]): number {
  return new Set(history.map((entry) => entry.projectId)).size;
}

/**
 * One member's record, in the cell the roster keeps for it: every movement the workspace's ledgers
 * hold about them, on one line, in the module's own order. The line never wraps — the grid's own
 * truncation gives it back whole in a tooltip (§5 rule 2) — and a member with no movements reads
 * the honest none rather than an empty cell.
 *
 * The project id is the row's `data-project`, never a text node: an identifier is not body copy
 * (§6), and the record that names it is one press away in the workspace's own audit.
 */
function MemberHistory({ history }: { history: readonly MembersHistoryEntry[] }) {
  return (
    <>
      {/* The record is one list per member whether or not it holds a movement — a member with none
          has an empty record, not an absent one, and the honest line stands in the list's place. It
          carries no name of its own: the column header names it once for the whole grid, and a name
          repeated on every row is N identical names to a reader travelling the roster. */}
      <ol className="cx-members-history" data-testid="members-role-history">
        {history.map((entry, index) => (
          <li
            className="cx-members-history-row"
            data-testid={TESTIDS.members.historyEntry}
            data-project={entry.projectId}
            data-direction={entry.direction}
            data-role={entry.role}
            key={`${entry.occurredAt}-${entry.projectId}-${entry.direction}-${entry.role}-${index}`}
          >
            <span className="cx-members-direction">{humaniseEnum(entry.direction)}</span>
            <span className="cx-members-history-role">{humaniseEnum(entry.role)}</span>
            <span className="cx-members-history-by">
              {fill(membersStrings.members_history_by, {
                actor: entry.actorLabel ?? membersStrings.members_member_unnamed,
                date: dayOf(entry.occurredAt),
              })}
            </span>
          </li>
        ))}
      </ol>
      {history.length === 0 ? <span className="cx-members-history-none">{membersStrings.members_history_none}</span> : null}
    </>
  );
}

/** The day a movement happened, in the document's own form (L-FMT-01, the participants precedent). */
function dayOf(occurredAt: string): string {
  const at = new Date(occurredAt);
  return formatDate({ year: at.getFullYear(), month: at.getMonth() + 1, day: at.getDate() });
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
