/**
 * Every screen the app router holds, with all seven of R-UI-050's states declared as nodes that
 * mount. The keys are the route keys `./route-scan` derives from the tree, so the matrix is closed
 * against the tree in both directions and a screen added later owes its seven (B-19, Q-14).
 *
 * Each cell is the state as its screen's committed Design Decision ruled it, in one of three
 * shapes — the vocabulary `src/ui/shell/states.ts` already rules the shell's screens in:
 *
 *   - rendered — the surface itself: the empty frame, the refusal, the bones, the denial;
 *   - delegated — the surface the Decision hands the state to, with the reason it gave;
 *   - cannot arise — the reason the Decision gave, which is a claim a reader can check.
 *
 * Nothing here restyles or re-draws a shipped surface, and no screen's copy is respelled: every
 * sentence is read from the string table by key (R-SPINE-060, C-13).
 */
import type { ReactNode } from "react";
import type { RefusalEntry } from "../../core/errors";
import type { RefusalEvidence } from "../patterns/refusal-state/refusal-state";
import { strings } from "../strings";
import { STATE_NAMES } from "./contract";
import type { ScreenDeclaration, ScreenState, ScreenStateName, ScreenStatesMatrix } from "./contract";
import { REFUSAL_ENTRIES } from "./refusal-entries";
import {
  BusySubmit,
  Denial,
  EmptyTeaching,
  FaultCard,
  InlineAnswer,
  LoadingBones,
  PermissionDenied,
  Refusal,
  StateReason,
  StateShell,
} from "./state-shells";

/** What a screen declares before the shell that files each state under its own name is put on. */
type Cells = Readonly<Record<ScreenStateName, () => ReactNode>>;

/**
 * File a screen's seven cells under their own names. The `data-state` a mounted state carries is the
 * key it was declared at — one value, so the name and the attribute cannot drift apart — and every
 * `render()` builds its node afresh, so a second mount is a second render and never a shared one.
 */
function declare(cells: Cells): ScreenDeclaration {
  const declared: Partial<Record<ScreenStateName, ScreenState>> = {};
  for (const state of STATE_NAMES) {
    const body = cells[state];
    declared[state] = { render: () => <StateShell state={state}>{body()}</StateShell> };
  }
  return declared as ScreenDeclaration;
}

/* ------------------------------------------------------------------------- the cell shapes */

/** A state its screen's Decision rules cannot arise there, with that reason. */
const reason =
  (why: string) =>
  (): ReactNode => <StateReason reason={why} />;

/** The fault state: R-UI-050's retry, in the root boundary's own words. */
const fault =
  (body: string) =>
  (): ReactNode => <FaultCard body={body} />;

/** A state handed to another surface: the reason it is handed over, then the surface itself. */
const delegatedToFault =
  (why: string, body: string) =>
  (): ReactNode => (
    <>
      <StateReason reason={why} />
      <FaultCard body={body} />
    </>
  );

/** The refusal state: the register's message and remedy, through the one renderer. */
const refusal =
  (entry: RefusalEntry, evidence: RefusalEvidence) =>
  (): ReactNode => <Refusal refusal={entry} evidence={evidence} />;

/**
 * A refusal a screen answers for a reason it can state: what it registers of its own (nothing, on a
 * screen that runs no procedure), then the code and remedy of the refusal it can still meet.
 * R-UI-050 asks every screen for a code and a remedy, so the reason stands beside one and never
 * instead of one.
 */
const reasonedRefusal =
  (why: string, entry: RefusalEntry, evidence: RefusalEvidence) =>
  (): ReactNode => (
    <>
      <StateReason reason={why} />
      <Refusal refusal={entry} evidence={evidence} />
    </>
  );

/**
 * The bones a screen keeps its layout with while it waits (R-UI-004: bones, never a spinner). The
 * count is the declaration's own answer to how many bones hold this screen's layout, and nothing
 * here reads it off another module — the declaration is the claim a reviewer grades.
 */
const bones =
  (count: number) =>
  (): ReactNode => <LoadingBones bones={count} />;

/* ------------------------------------------------------------------------ where a state leads */

const SIGN_IN_EVIDENCE: RefusalEvidence = { href: "/sign-in", label: strings.shell_evidence_sign_in };
const WORKSPACE_EVIDENCE: RefusalEvidence = { href: "/", label: strings.shell_denied_evidence };
const PROJECTS_EVIDENCE: RefusalEvidence = { href: "/", label: strings.home_evidence_projects };
const TRY_AGAIN_EVIDENCE: RefusalEvidence = { href: "/", label: strings.auth_evidence_try_again };
const ROSTER_EVIDENCE: RefusalEvidence = { href: "/", label: strings.state_members_evidence_roster };

/* ------------------------------------------------------------- the signed-in workspace screens */

/**
 * What every screen inside the workspace frame answers the same way. The error and offline states
 * are the root boundary's (shell I-20: a server-rendered page holds no data that can age, so
 * unreachability is a fault and never an invented banner), and the workspace denial is the shell's
 * own frameless surface, which stands in place of the frame before the screen mounts.
 */
const workspaceCells = {
  error: fault(strings.error_body),
  partial: reason(strings.state_partial_one_read),
  offline: delegatedToFault(strings.state_offline_unreachable, strings.auth_fault_unreachable_body),
  "permission-denied": (): ReactNode => <Denial refusal={REFUSAL_ENTRIES.PERMISSION_NOT_HELD} evidence={WORKSPACE_EVIDENCE} />,
} as const;

/* ------------------------------------------------------------------------------- the doors */

/**
 * A form door (s-auth § 4): nothing loads before input, so the wait is the submit's own busy leg;
 * the pristine form is the empty state, because it teaches by asking; and a door that exists to be
 * used anonymously names no permission it could withhold.
 */
const formDoor = (title: string, submit: string, entry: RefusalEntry, evidence: RefusalEvidence): Cells => ({
  loading: (): ReactNode => <BusySubmit label={submit} />,
  empty: (): ReactNode => <EmptyTeaching heading={title} body={strings.state_empty_form_asks} action={submit} />,
  error: fault(strings.auth_fault_body),
  refusal: refusal(entry, evidence),
  partial: reason(strings.state_partial_one_answer),
  offline: delegatedToFault(strings.state_offline_transport_fault, strings.auth_fault_unreachable_body),
  "permission-denied": reason(strings.state_denied_anonymous_door),
});

/* ------------------------------------------------------------------------------ the matrix */

export const screenStates: ScreenStatesMatrix = {
  // The ACCEPT screen (s-accept-invitation §2): one offer, read off a mailed token, behind the
  // signed-in group's session door. Its empty state is the address with no link behind it, its
  // refusal is the token no accept can claim, and its denial is the ended session the door remedies.
  "/accept-invitation": declare({
    loading: bones(4),
    empty: (): ReactNode => (
      <EmptyTeaching heading={strings.state_empty_accept_heading} body={strings.state_empty_accept_body} action={strings.shell_evidence_home} />
    ),
    error: fault(strings.error_body),
    refusal: refusal(REFUSAL_ENTRIES.INVITATION_NOT_CLAIMABLE, WORKSPACE_EVIDENCE),
    partial: reason(strings.state_partial_one_answer),
    offline: delegatedToFault(strings.state_offline_unreachable, strings.auth_fault_unreachable_body),
    "permission-denied": reasonedRefusal(strings.state_refusal_ended_session, REFUSAL_ENTRIES.SIGNED_OUT, SIGN_IN_EVIDENCE),
  }),

  // The public entry (root-document § 2): static content, compiled in, gating nothing.
  "/": declare({
    loading: reason(strings.state_loading_nothing_awaited),
    empty: reason(strings.state_empty_compiled_in),
    error: fault(strings.error_body),
    refusal: reasonedRefusal(strings.state_refusal_ended_session, REFUSAL_ENTRIES.SIGNED_OUT, SIGN_IN_EVIDENCE),
    partial: reason(strings.state_partial_no_rows),
    offline: reason(strings.state_offline_nothing_ages),
    "permission-denied": reason(strings.state_denied_public_entry),
  }),

  // The gallery (s-design § 4): compiled from static imports, consulting no seam. Its one door is
  // the signed-in group's, so the denial it can reach is the ended session's, remedied at sign-in.
  "/design": declare({
    loading: reason(strings.state_loading_nothing_awaited),
    empty: reason(strings.state_empty_gallery_complete),
    error: fault(strings.error_body),
    refusal: reasonedRefusal(strings.state_refusal_ended_session, REFUSAL_ENTRIES.SIGNED_OUT, SIGN_IN_EVIDENCE),
    partial: reason(strings.state_partial_no_rows),
    offline: reason(strings.state_offline_nothing_ages),
    "permission-denied": reasonedRefusal(strings.state_denied_gallery_session, REFUSAL_ENTRIES.SIGNED_OUT, SIGN_IN_EVIDENCE),
  }),

  // The magic-link door.
  "/magic-link": declare(formDoor(strings.auth_magic_link_title, strings.auth_magic_link_submit, REFUSAL_ENTRIES.LINK_NOT_SENDABLE, TRY_AGAIN_EVIDENCE)),

  // The reset door.
  "/reset": declare(formDoor(strings.auth_reset_title, strings.auth_reset_request_submit, REFUSAL_ENTRIES.RATE_LIMITED, TRY_AGAIN_EVIDENCE)),

  // Sessions (s-auth § 4): the list cannot be empty, because seeing it needs the session it lists,
  // and both its denial and its refusal are the ended session — the permission is a live one.
  "/sessions": declare({
    loading: bones(3),
    empty: reason(strings.state_empty_session_present),
    error: fault(strings.auth_fault_body),
    refusal: refusal(REFUSAL_ENTRIES.SIGNED_OUT, SIGN_IN_EVIDENCE),
    partial: reason(strings.state_partial_one_read),
    offline: delegatedToFault(strings.state_offline_transport_fault, strings.auth_fault_unreachable_body),
    "permission-denied": (): ReactNode => (
      <PermissionDenied
        heading={strings.auth_sessions_title}
        permission={strings.state_denied_session_permission}
        holder={strings.state_denied_session_holder}
        refusal={REFUSAL_ENTRIES.SIGNED_OUT}
        evidence={SIGN_IN_EVIDENCE}
      />
    ),
  }),

  // The password door.
  "/sign-in": declare(
    formDoor(strings.auth_sign_in_title, strings.auth_sign_in_submit, REFUSAL_ENTRIES.CREDENTIALS_NOT_VALID, {
      href: "/reset",
      label: strings.auth_evidence_reset_password,
    }),
  ),

  // The account door.
  "/sign-up": declare(
    formDoor(strings.auth_sign_up_title, strings.auth_sign_up_submit, REFUSAL_ENTRIES.ACCOUNT_ALREADY_EXISTS, SIGN_IN_EVIDENCE),
  ),

  // The projects home (s-home § 2): the zero-project branch teaches with the SAMPLE offer, and the
  // in-place lifecycle denial names the principal who holds the permission.
  "/t/[tenant]": declare({
    ...workspaceCells,
    loading: bones(3),
    empty: (): ReactNode => (
      <EmptyTeaching heading={strings.shell_projects_empty_heading} body={strings.shell_projects_empty_body} action={strings.shell_sample_offer} />
    ),
    refusal: refusal(REFUSAL_ENTRIES.PERMISSION_NOT_HELD, PROJECTS_EVIDENCE),
  }),

  // Books (shell § 2): an honest empty state and no data, so it asks for nothing refusable.
  "/t/[tenant]/books": declare({
    ...workspaceCells,
    loading: bones(3),
    empty: (): ReactNode => (
      <EmptyTeaching heading={strings.shell_books_empty_heading} body={strings.shell_books_empty_body} action={strings.shell_books_empty_action} />
    ),
    refusal: reasonedRefusal(strings.state_refusal_ended_session, REFUSAL_ENTRIES.SIGNED_OUT, SIGN_IN_EVIDENCE),
  }),

  // The act log (s-audit § 2): one read answered whole, and a value it cannot read is a fault.
  "/t/[tenant]/p/[project]/audit": declare({
    ...workspaceCells,
    loading: bones(11),
    empty: (): ReactNode => (
      <EmptyTeaching heading={strings.state_empty_audit_heading} body={strings.state_empty_audit_body} action={strings.home_evidence_projects} />
    ),
    refusal: reasonedRefusal(strings.state_refusal_read_fault, REFUSAL_ENTRIES.SIGNED_OUT, SIGN_IN_EVIDENCE),
  }),

  // Participants (s-settings-participants § 2): a project holds a principal at every moment, so the
  // list is never empty; the reachable refusal is the withdrawal that would leave it without one.
  "/t/[tenant]/p/[project]/settings/participants": declare({
    ...workspaceCells,
    loading: bones(7),
    empty: reason(strings.state_empty_project_principal),
    refusal: refusal(REFUSAL_ENTRIES.PROJECT_WOULD_HAVE_NO_PRINCIPAL, {
      href: "/",
      label: strings.spine_participants_evidence_assign,
    }),
    // The I-50 branch: a member without standing is denied in place, and this screen names its own
    // permission and its own holders rather than the workspace's (the frame's denial is above).
    "permission-denied": (): ReactNode => (
      <PermissionDenied
        heading={strings.state_denied_project_heading}
        permission={strings.spine_participants_denied_permission}
        holder={strings.spine_participants_denied_holder}
        refusal={REFUSAL_ENTRIES.PERMISSION_NOT_HELD}
        evidence={WORKSPACE_EVIDENCE}
      />
    ),
  }),

  // The pinned rule set (s-settings-ruleset § 2): the unpinned surface teaches that a project
  // carries its rule set from creation, and the screen registers no code of its own.
  "/t/[tenant]/p/[project]/settings/ruleset": declare({
    ...workspaceCells,
    loading: bones(8),
    empty: (): ReactNode => (
      <EmptyTeaching heading={strings.state_empty_ruleset_heading} body={strings.state_empty_ruleset_body} action={strings.home_evidence_projects} />
    ),
    refusal: reasonedRefusal(strings.state_refusal_read_fault, REFUSAL_ENTRIES.SIGNED_OUT, SIGN_IN_EVIDENCE),
  }),

  // Workspace settings (shell § 2): a workspace always has a name, and the rename door answers what
  // it was given in place — the door's own copy, deliberately not one of the closed taxonomy's. The
  // registered refusal the screen can still meet stands under it with its code and remedy.
  "/t/[tenant]/settings": declare({
    ...workspaceCells,
    loading: bones(3),
    empty: reason(strings.state_empty_workspace_named),
    refusal: (): ReactNode => (
      <>
        <InlineAnswer text={strings.shell_rename_refusal} />
        <Refusal refusal={REFUSAL_ENTRIES.SIGNED_OUT} evidence={SIGN_IN_EVIDENCE} />
      </>
    ),
  }),

  // The workspace members surface (s-settings § 2): seeing the roster is itself a membership, so the
  // list can never be empty, and the four refusals the workspace guards register are all reachable
  // here — they stand together, in the order the removal guard judges them (the acts a member holds
  // first, then the last owner, then self-removal, and the role's own permission last), each with
  // its own evidence. The denial names the workspace role's permission, which the entry's own words carry.
  "/t/[tenant]/settings/members": declare({
    ...workspaceCells,
    loading: bones(6),
    empty: reason(strings.state_empty_members_reader),
    refusal: (): ReactNode => (
      <>
        <Refusal refusal={REFUSAL_ENTRIES.MEMBER_HAS_ACTS} evidence={PROJECTS_EVIDENCE} />
        <Refusal refusal={REFUSAL_ENTRIES.WORKSPACE_WOULD_HAVE_NO_OWNER} evidence={ROSTER_EVIDENCE} />
        <Refusal refusal={REFUSAL_ENTRIES.SELF_REMOVAL_NOT_ALLOWED} evidence={ROSTER_EVIDENCE} />
        <Refusal refusal={REFUSAL_ENTRIES.WORKSPACE_PERMISSION_NOT_HELD} evidence={ROSTER_EVIDENCE} />
      </>
    ),
    partial: reason(strings.state_partial_members_scope),
    "permission-denied": (): ReactNode => (
      <Denial refusal={REFUSAL_ENTRIES.WORKSPACE_PERMISSION_NOT_HELD} evidence={WORKSPACE_EVIDENCE} />
    ),
  }),

  // The verification panel (s-auth § 4): a token panel, whose empty state is the missing link.
  "/verify": declare({
    loading: bones(1),
    empty: (): ReactNode => (
      <EmptyTeaching heading={strings.auth_verify_title} body={strings.auth_verify_no_token} action={strings.auth_evidence_request_new_link} />
    ),
    error: fault(strings.auth_fault_body),
    refusal: refusal(REFUSAL_ENTRIES.TOKEN_NOT_VALID, { href: "/magic-link", label: strings.auth_evidence_request_new_link }),
    partial: reason(strings.state_partial_one_answer),
    offline: delegatedToFault(strings.state_offline_transport_fault, strings.auth_fault_unreachable_body),
    "permission-denied": reason(strings.state_denied_anonymous_door),
  }),
};
