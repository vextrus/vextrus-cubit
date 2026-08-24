'use client';

/**
 * The participants pane, as the reader works it (R-SPINE-011, R-UI-021; panes file §3–§7).
 *
 * Assignment is an act, so it is the only thing on either new pane that opens a
 * ConsequenceDialog: the reader picks a person and a role, the *server* computes what that
 * would do, the dialog shows exactly that, and confirm carries the digest back so what is
 * applied is what was shown (L-ACT-02). Nothing here computes a consequence of its own — a
 * count this file worked out would be a second answer for the state to disagree with.
 *
 * Interpretation 2: the dialog is composed from the Dialog primitive rather than from the
 * frozen `ConsequenceDialog` pattern, which carries only `{label, count}` lines and no refusal
 * slot — and this act's consequence is a person, two roles and one count, with an in-dialog
 * refusal the contract names. Every datum-patterns §9 law is kept verbatim, and so are the
 * shared ids, so the pattern reads identically everywhere.
 *
 * Interpretation 3: the last-PRINCIPAL refusal arrives at confirm, in place. The seam previews
 * `principalsAfter: 0` honestly — a refused preview could never be shown, and the dialog would
 * have no digest to confirm with — and its guard refuses the commit. So the dialog shows the
 * zero like any other count, the refusal renders inside the open dialog, and confirm stays
 * live: a re-confirm asks the server again and gets the same honest answer.
 */
import { useCallback, useMemo, useState } from 'react';
import { Badge, Button, Dialog, DialogContent, DialogTitle } from '../../../../../../../ui/primitives';
import { REFUSALS } from '../../../../../../../core/errors';
import { LocalTime } from '../../../../../local-time';
import { around, fill, ten } from '../../../../../strings';
import { formatNumber } from '../../../../../../../core/format';
import type {
  ParticipantView,
  RoleGrantView,
} from '../../../../../../../modules/spine/projects';
import { commitAssignmentAction, previewAssignmentAction } from '../actions';
import type { PreviewedAssignment } from '../actions';

/** One member of the workspace, as the assign row offers them. */
export interface MemberOption {
  readonly userId: string;
  readonly email: string;
}

/** What the dialog is about while it is open — a preview, and the choice it was taken for. */
interface Episode {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
  readonly previewed: PreviewedAssignment;
  /** Which lines the restatement changed, when a stale digest sent the preview round again. */
  readonly stale: ReadonlySet<string>;
}

/** §5's entry, split around its role slot so the code renders as the code it is. */
const HISTORY_ENTRY = 'project.participants.historyEntry';

/** The other two slots that sentence keeps, filled into the half before the role. */
const ACTOR_SLOT = '{actor}';
const MEMBER_SLOT = '{member}';

/** The lines a restatement can mark (§6's `consequence-stale`). */
const CURRENT = 'current';
const PROPOSED = 'proposed';
const PRINCIPALS = 'principals';

/** §7: what a refused act leaves on screen, and where. */
type Refused = keyof typeof REFUSALS;

export interface ParticipantsPaneProps {
  readonly tenantSlug: string;
  readonly projectId: string;
  readonly readerEmail: string;
  readonly members: readonly MemberOption[];
  readonly roles: readonly string[];
  readonly defaultRole: string;
  readonly roster: readonly ParticipantView[];
  readonly history: readonly RoleGrantView[];
}

export function ParticipantsPane({
  tenantSlug,
  projectId,
  readerEmail,
  members,
  roles,
  defaultRole,
  roster,
  history,
}: ParticipantsPaneProps) {
  /** §4: "preselected: the first member who is not the reader". */
  const firstOther = useMemo(
    () => members.find((member) => member.email !== readerEmail) ?? members[0],
    [members, readerEmail],
  );

  const [member, setMember] = useState(firstOther?.email ?? '');
  const [role, setRole] = useState(defaultRole);
  const [rows, setRows] = useState<readonly ParticipantView[]>(roster);
  const [grants, setGrants] = useState<readonly RoleGrantView[]>(history);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [paneRefused, setPaneRefused] = useState<Refused | null>(null);
  const [paneFailed, setPaneFailed] = useState(false);
  const [dialogRefused, setDialogRefused] = useState<Refused | null>(null);
  const [dialogFailed, setDialogFailed] = useState(false);
  const [announced, setAnnounced] = useState('');

  const userIdOf = useCallback(
    (email: string) => members.find((each) => each.email === email)?.userId ?? '',
    [members],
  );

  /** Cancel, Escape, the scrim and the close control all land here (§6). */
  const closeDialog = useCallback(() => {
    setEpisode(null);
    setDialogRefused(null);
    setDialogFailed(false);
  }, []);

  const preview = useCallback(async () => {
    setPaneRefused(null);
    setPaneFailed(false);
    setAnnounced('');
    const userId = userIdOf(member);
    if (userId === '') return;
    setBusy(true);
    try {
      const outcome = await previewAssignmentAction(tenantSlug, projectId, userId, role);
      if (!outcome.ok) {
        if (outcome.code === null) setPaneFailed(true);
        else setPaneRefused(outcome.code);
        return;
      }
      setDialogRefused(null);
      setDialogFailed(false);
      setEpisode({ userId, email: member, role, previewed: outcome.value, stale: new Set() });
    } catch {
      setPaneFailed(true);
    } finally {
      setBusy(false);
    }
  }, [member, projectId, role, tenantSlug, userIdOf]);

  /** §6: a stale digest re-renders the dialog with what changed, keyed on the digest. */
  const restate = useCallback(
    async (open: Episode) => {
      const outcome = await previewAssignmentAction(
        tenantSlug,
        projectId,
        open.userId,
        open.role,
      );
      if (!outcome.ok) {
        if (outcome.code === null) setDialogFailed(true);
        else setDialogRefused(outcome.code);
        return;
      }
      const was = open.previewed.consequence;
      const now = outcome.value.consequence;
      const moved = new Set<string>();
      if (was.currentRole !== now.currentRole) moved.add(CURRENT);
      if (was.proposedRole !== now.proposedRole) moved.add(PROPOSED);
      if (was.principalsAfter !== now.principalsAfter) moved.add(PRINCIPALS);
      setEpisode({ ...open, previewed: outcome.value, stale: moved });
    },
    [projectId, tenantSlug],
  );

  const confirm = useCallback(async () => {
    const open = episode;
    if (open === null) return;
    setDialogRefused(null);
    setDialogFailed(false);
    setConfirming(true);
    try {
      const outcome = await commitAssignmentAction(
        tenantSlug,
        projectId,
        open.userId,
        open.role,
        open.previewed.digest,
      );
      if (!outcome.ok) {
        if (outcome.code === null) {
          setDialogFailed(true);
          return;
        }
        if (outcome.code === REFUSALS.CONSEQUENCES_NOT_CARRIED.code) {
          await restate(open);
          return;
        }
        setDialogRefused(outcome.code);
        return;
      }
      setRows(outcome.value.roster);
      setGrants(outcome.value.history);
      setAnnounced(ten('project.participants.committed'));
      closeDialog();
    } catch {
      setDialogFailed(true);
    } finally {
      setConfirming(false);
    }
  }, [closeDialog, episode, projectId, restate, tenantSlug]);

  const [historyHead, historyTail] = around(HISTORY_ENTRY, 'role');
  const paneRefusal = paneRefused === null ? null : REFUSALS[paneRefused];
  const dialogRefusal = dialogRefused === null ? null : REFUSALS[dialogRefused];
  const consequence = episode?.previewed.consequence;

  return (
    <div data-testid="participants-pane">
      <h1 className="tenant-title">{ten('project.participants.title')}</h1>
      <p className="tenant-lead">{ten('project.participants.lead')}</p>

      {/* §4: the assign row. Both controls are native selects wearing the Datum control
          surface — the closed sets have to be in the document the server sends. */}
      <div className="project-assign-row">
        <div className="project-assign-field">
          <label className="project-form-label" htmlFor="participant-assign-member">
            {ten('project.participants.member')}
          </label>
          <select
            id="participant-assign-member"
            data-testid="participant-assign-member"
            className="datum-control datum-select-trigger datum-focus-ring"
            value={member}
            disabled={busy}
            onChange={(event) => setMember(event.target.value)}
          >
            {members.map((each) => (
              <option key={each.userId} value={each.email}>
                {each.email}
              </option>
            ))}
          </select>
        </div>
        <div className="project-assign-field">
          <label className="project-form-label" htmlFor="participant-assign-role">
            {ten('project.participants.role')}
          </label>
          <select
            id="participant-assign-role"
            data-testid="participant-assign-role"
            className="datum-control datum-select-trigger datum-focus-ring project-assign-role"
            value={role}
            disabled={busy}
            onChange={(event) => setRole(event.target.value)}
          >
            {roles.map((each) => (
              <option key={each} value={each}>
                {each}
              </option>
            ))}
          </select>
        </div>
        <Button
          data-testid="participant-assign"
          loading={busy}
          onClick={() => {
            void preview();
          }}
        >
          {ten('project.participants.assign')}
        </Button>
      </div>

      {paneRefusal === null ? null : (
        <div className="project-refusal" role="alert" data-testid="participants-refusal">
          <p className="project-refusal-code" data-testid="refusal-code">
            {paneRefusal.code}
          </p>
          <p className="project-refusal-message" data-testid="refusal-message">
            {paneRefusal.message}
          </p>
          <p className="project-refusal-remedy" data-testid="refusal-remedy">
            {paneRefusal.remedy}
          </p>
        </div>
      )}
      {paneFailed ? (
        <p className="project-error-line" role="alert" data-testid="participants-error">
          {ten('project.form.failed')}
        </p>
      ) : null}

      {/* §4: the roster — display only, because assignment goes through the act. */}
      <ul className="project-list-card" data-testid="participants-roster">
        {rows.map((row) => (
          <li
            key={row.userId}
            className="project-list-row"
            data-testid="participant-row"
            data-email={row.email}
            data-role={row.role}
          >
            <span className="project-participant-email">{row.email}</span>
            {row.email === readerEmail ? (
              <Badge>{ten('project.participants.you')}</Badge>
            ) : null}
            <span className="project-role-code">{row.role}</span>
          </li>
        ))}
      </ul>

      {/* §5: every grant this project has made, newest first. */}
      <section className="project-section">
        <h2 className="project-section-title">{ten('project.participants.historyTitle')}</h2>
        <ol className="project-list-card" data-testid="role-history">
          {grants.map((grant) => (
            <li key={grant.actId} className="project-list-row" data-testid="role-history-entry">
              {/* §5, Interpretation 8: the role is a mono code inside the sentence, never a
                  word the sentence inflects. */}
              <span className="project-history-entry">
                {historyHead.split(ACTOR_SLOT).join(grant.actorEmail).split(MEMBER_SLOT).join(grant.email)}
                <span className="project-history-role">{grant.role}</span>
                {historyTail}
              </span>
              <span className="project-history-when">
                <LocalTime iso={grant.at} />
              </span>
            </li>
          ))}
        </ol>
      </section>

      <Dialog
        open={episode !== null}
        onOpenChange={(next) => {
          if (!next) closeDialog();
        }}
      >
        {episode === null || consequence === undefined ? null : (
          <DialogContent className="project-dialog">
            <div data-testid="consequence-dialog">
              <DialogTitle>
                {fill('project.participants.dialogTitle', {
                  role: episode.role,
                  email: episode.email,
                })}
              </DialogTitle>

              {episode.stale.size === 0 ? null : (
                <p className="project-consequence-stale-line" role="status">
                  {ten('project.participants.stale')}
                </p>
              )}
              {dialogFailed ? (
                <p className="project-consequence-failed" role="alert">
                  {ten('project.participants.failed')}
                </p>
              ) : null}

              <dl className="project-consequence-summary" data-testid="consequence-summary">
                <div className="project-consequence-row">
                  <dt className="project-consequence-label">
                    {ten('project.participants.summary.person')}
                  </dt>
                  <dd className="project-consequence-value">{episode.email}</dd>
                </div>
                <div
                  className="project-consequence-row"
                  data-testid={episode.stale.has(CURRENT) ? 'consequence-stale' : undefined}
                >
                  <dt className="project-consequence-label">
                    {ten('project.participants.summary.current')}
                  </dt>
                  <dd className="project-consequence-value project-consequence-role">
                    {consequence.currentRole ?? ten('project.participants.summary.currentNone')}
                  </dd>
                </div>
                <div
                  className="project-consequence-row"
                  data-testid={episode.stale.has(PROPOSED) ? 'consequence-stale' : undefined}
                >
                  <dt className="project-consequence-label">
                    {ten('project.participants.summary.proposed')}
                  </dt>
                  <dd className="project-consequence-value project-consequence-role">
                    {consequence.proposedRole}
                  </dd>
                </div>
                <div
                  className="project-consequence-row"
                  data-testid={episode.stale.has(PRINCIPALS) ? 'consequence-stale' : undefined}
                >
                  <dt className="project-consequence-label">
                    {ten('project.participants.summary.principals')}
                  </dt>
                  <dd className="project-consequence-count numeric">
                    {formatNumber(String(consequence.principalsAfter), 'count')}
                  </dd>
                </div>
              </dl>

              {dialogRefusal === null ? null : (
                <div className="project-refusal" role="alert" data-testid="consequence-refusal">
                  <p className="project-refusal-code" data-testid="refusal-code">
                    {dialogRefusal.code}
                  </p>
                  <p className="project-refusal-message" data-testid="refusal-message">
                    {dialogRefusal.message}
                  </p>
                  <p className="project-refusal-remedy" data-testid="refusal-remedy">
                    {dialogRefusal.remedy}
                  </p>
                </div>
              )}

              <div className="project-dialog-footer">
                <Button variant="secondary" data-testid="consequence-cancel" onClick={closeDialog}>
                  {ten('project.participants.cancel')}
                </Button>
                <Button
                  data-testid="consequence-confirm"
                  loading={confirming}
                  onClick={() => {
                    void confirm();
                  }}
                >
                  {ten('project.participants.confirm')}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <div className="project-announce" role="status">
        {announced}
      </div>
    </div>
  );
}
