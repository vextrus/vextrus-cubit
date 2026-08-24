'use client';

/**
 * Tenant administration, as the reader works it (docs/design/s-settings.md §2–§5).
 *
 * One client component for both sections, because the refusal block is one: §5 says at most
 * one renders at a time and any subsequent act in either section clears it, which is a single
 * piece of state and not two that have to agree.
 *
 * Every act is a server action — the guard runs again on the server, the seam answers, and the
 * row the reader is looking at re-renders. No ConsequenceDialog (Interpretation 2): removing a
 * member, changing a role, resending and revoking each act on the one row in front of them, so
 * the row is the preview. The blast radius they cannot see is exactly what the server's
 * `MEMBER_HAS_ACTS` refusal is for.
 *
 * `member-role` and `invite-role` are native selects wearing the Datum control surface rather
 * than the Radix Select primitive: R-SPINE-003's three roles have to be in the document the
 * server sends (AC-2 reads them out of it), and a Radix Select mounts its options only while
 * it is open. The keyboard behaviour, the accessible name and the tokens are the primitive's.
 */
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button } from '../../../../../ui/primitives';
import { PermissionDenied } from '../../../../../ui/patterns';
import { REFUSALS } from '../../../../../core/errors';
import { AreaEmptyState } from '../area-empty-state';
import { around, fill, ten } from '../../../strings';
import type { TenantStringKey } from '../../../strings';
import {
  inviteMemberAction,
  removeMemberAction,
  resendInvitationAction,
  revokeInvitationAction,
  setMemberRoleAction,
} from './actions';

/** R-SPINE-003's closed set, in the order the controls offer it (§2). */
const ROLE_CHOICES: readonly (readonly [string, TenantStringKey])[] = [
  ['OWNER', 'tenant.role.owner'],
  ['ADMIN', 'tenant.role.admin'],
  ['MEMBER', 'tenant.role.member'],
];

/** §4: `MEMBER` is preselected, so no placeholder ever renders. */
const DEFAULT_INVITE_ROLE = 'MEMBER';

/** An address the form will act on. Deliberately loose — the server decides what exists. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface MemberView {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
  readonly current: boolean;
}

export interface InvitationView {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly createdAt: string;
}

/** Which list an outcome belongs to, so the block and the line land in the right place (§5). */
type Section = 'members' | 'invitations' | 'form';

interface Refused {
  readonly code: keyof typeof REFUSALS;
  readonly section: Section;
  /** The row the refused act was about, so the block renders directly below it. */
  readonly rowKey: string;
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** §4's time format: `YYYY-MM-DD HH:mm`, in the reader's own zone once the browser said it. */
function localTime(iso: string): string {
  const when = new Date(iso);
  return (
    `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ` +
    `${pad(when.getHours())}:${pad(when.getMinutes())}`
  );
}

/** The same instant in UTC — what the row carries until then, never a blank slot. */
function utcTime(iso: string): string {
  const when = new Date(iso);
  return (
    `${when.getUTCFullYear()}-${pad(when.getUTCMonth() + 1)}-${pad(when.getUTCDate())} ` +
    `${pad(when.getUTCHours())}:${pad(when.getUTCMinutes())}`
  );
}

/** §5's block: the code, and the register's own message and remedy — never paraphrased. */
function RefusalBlock({ code }: { code: keyof typeof REFUSALS }) {
  const entry = REFUSALS[code];
  return (
    <div className="tenant-settings-refusal" role="alert" data-testid="settings-refusal">
      <p className="tenant-settings-refusal-code numeric" data-testid="refusal-code">
        {code}
      </p>
      <p className="tenant-settings-refusal-message" data-testid="refusal-message">
        {entry.message}
      </p>
      <p className="tenant-settings-refusal-remedy" data-testid="refusal-remedy">
        {entry.remedy}
      </p>
    </div>
  );
}

/** §6's error line: an act whose request never completed, in the danger voice. */
function ErrorLine() {
  return (
    <p className="tenant-settings-error" role="alert" data-testid="settings-error">
      {ten('tenant.settings.actionFailed')}
    </p>
  );
}

/** The role control every row and the form share (§2's treatment, §4's roster). */
function RoleSelect({
  'data-testid': testId,
  value,
  label,
  busy,
  onChange,
}: {
  readonly 'data-testid': string;
  readonly value: string;
  readonly label: string;
  readonly busy?: boolean;
  readonly onChange: (role: string) => void;
}) {
  return (
    <select
      data-testid={testId}
      className="datum-control datum-select-trigger datum-focus-ring tenant-role-select"
      aria-label={label}
      aria-busy={busy === true ? true : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {ROLE_CHOICES.map(([code, key]) => (
        <option key={code} value={code}>
          {ten(key)}
        </option>
      ))}
    </select>
  );
}

export interface TenantAdminProps {
  /** Whether this reader administers the workspace (Interpretation 1). */
  readonly mayManage: boolean;
  readonly tenantSlug: string;
  readonly sessionsHref: string;
  readonly members: readonly MemberView[];
  readonly invitations: readonly InvitationView[];
}

export function TenantAdmin({
  mayManage,
  tenantSlug,
  sessionsHref,
  members,
  invitations,
}: TenantAdminProps) {
  const [rows, setRows] = useState<readonly MemberView[]>(members);
  const [pending, setPending] = useState<readonly InvitationView[]>(invitations);
  const [busy, setBusy] = useState<string | null>(null);
  const [refused, setRefused] = useState<Refused | null>(null);
  const [failed, setFailed] = useState<Section | null>(null);
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [announced, setAnnounced] = useState('');
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(DEFAULT_INVITE_ROLE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  /** §5: any act clears whatever the last one left on screen, before it says anything new. */
  const begin = useCallback((key: string) => {
    setRefused(null);
    setFailed(null);
    setInvalidEmail(false);
    setAnnounced('');
    setBusy(key);
  }, []);

  /** What an act that did not work leaves on screen: §5's block, or §6's error line. */
  const note = useCallback(
    (outcome: { readonly code: Refused['code'] | null }, section: Section, rowKey: string) => {
      if (outcome.code === null) setFailed(section);
      else setRefused({ code: outcome.code, section, rowKey });
    },
    [],
  );

  const changeRole = useCallback(
    async (member: MemberView, role: string) => {
      begin(member.userId);
      try {
        const outcome = await setMemberRoleAction(tenantSlug, member.userId, role);
        if (!outcome.ok) {
          note(outcome, 'members', member.userId);
          return;
        }
        setRows((current) =>
          current.map((row) => (row.userId === member.userId ? { ...row, role } : row)),
        );
        setAnnounced(ten('tenant.members.roleChanged'));
      } catch {
        setFailed('members');
      } finally {
        setBusy(null);
      }
    },
    [begin, note, tenantSlug],
  );

  const remove = useCallback(
    async (member: MemberView) => {
      begin(member.userId);
      try {
        const outcome = await removeMemberAction(tenantSlug, member.userId);
        if (!outcome.ok) {
          note(outcome, 'members', member.userId);
          return;
        }
        setRows((current) => current.filter((row) => row.userId !== member.userId));
        setAnnounced(ten('tenant.members.removed'));
      } catch {
        setFailed('members');
      } finally {
        setBusy(null);
      }
    },
    [begin, note, tenantSlug],
  );

  const invite = useCallback(async () => {
    const address = email.trim();
    begin('invite');
    if (!EMAIL.test(address)) {
      setBusy(null);
      setInvalidEmail(true);
      return;
    }
    try {
      const outcome = await inviteMemberAction(tenantSlug, address, inviteRole);
      if (!outcome.ok) {
        note(outcome, 'form', 'invite');
        return;
      }
      const created = outcome.value;
      setPending((current) => [
        ...current,
        { id: created.id, email: created.email, role: created.role, createdAt: created.createdAt },
      ]);
      // §4: the address clears and the role keeps its choice — inviting two people at the
      // same role is the common case.
      setEmail('');
      setAnnounced(fill('tenant.invitations.sent', { email: created.email }));
    } catch {
      setFailed('form');
    } finally {
      setBusy(null);
    }
  }, [begin, email, inviteRole, note, tenantSlug]);

  const resend = useCallback(
    async (invitation: InvitationView) => {
      begin(invitation.id);
      try {
        const outcome = await resendInvitationAction(tenantSlug, invitation.id);
        if (!outcome.ok) {
          note(outcome, 'invitations', invitation.id);
          return;
        }
        setAnnounced(ten('tenant.invitations.resent'));
      } catch {
        setFailed('invitations');
      } finally {
        setBusy(null);
      }
    },
    [begin, note, tenantSlug],
  );

  const revoke = useCallback(
    async (invitation: InvitationView) => {
      begin(invitation.id);
      try {
        const outcome = await revokeInvitationAction(tenantSlug, invitation.id);
        if (!outcome.ok) {
          note(outcome, 'invitations', invitation.id);
          return;
        }
        setPending((current) => current.filter((row) => row.id !== invitation.id));
        setAnnounced(ten('tenant.invitations.revoked'));
      } catch {
        setFailed('invitations');
      } finally {
        setBusy(null);
      }
    },
    [begin, note, tenantSlug],
  );

  /** §5: the block goes below its row — or above the list card if that row has gone. */
  const strandedIn = (section: Section, keys: readonly string[]): boolean =>
    refused !== null && refused.section === section && !keys.includes(refused.rowKey);

  const [invitedBefore, invitedAfter] = around('tenant.invitations.invited', 'time');

  // §6: a MEMBER viewer. Both sections are replaced; the h1 and the lead above stay, because
  // the reader is in the right workspace and this is the right address for what they came for.
  if (!mayManage) {
    return (
      <div className="tenant-settings-denied">
        <PermissionDenied
          permission={ten('tenant.settings.permission')}
          holder={ten('tenant.settings.permissionHolder')}
        />
      </div>
    );
  }

  return (
    <>
      <section
        className="tenant-settings-section"
        aria-labelledby="tenant-members-heading"
        data-testid="members-section"
      >
        <h2 className="tenant-settings-heading" id="tenant-members-heading">
          {ten('tenant.members.title')}
        </h2>
        {failed === 'members' ? <ErrorLine /> : null}
        {strandedIn('members', rows.map((row) => row.userId)) && refused !== null ? (
          <RefusalBlock code={refused.code} />
        ) : null}
        <ul className="tenant-settings-list">
          {rows.map((member) => (
            <li key={member.userId} className="tenant-settings-rows">
              <div
                className="tenant-settings-row"
                data-testid="member-row"
                data-email={member.email}
                data-current={member.current ? 'true' : undefined}
              >
                <span className="tenant-settings-row-name">
                  {member.email}
                  {member.current ? <Badge tone="neutral">{ten('tenant.members.you')}</Badge> : null}
                </span>
                <span className="tenant-settings-row-right">
                  {member.current ? (
                    <span className="tenant-role-static numeric" data-testid="member-role">
                      {member.role}
                    </span>
                  ) : (
                    <RoleSelect
                      data-testid="member-role"
                      value={member.role}
                      busy={busy === member.userId}
                      label={fill('tenant.members.role', { email: member.email })}
                      onChange={(role) => {
                        void changeRole(member, role);
                      }}
                    />
                  )}
                  {member.current ? null : (
                    <Button
                      variant="secondary"
                      data-testid="member-remove"
                      aria-label={fill('tenant.members.removeLabel', { email: member.email })}
                      loading={busy === member.userId}
                      onClick={() => {
                        void remove(member);
                      }}
                    >
                      {ten('tenant.members.remove')}
                    </Button>
                  )}
                </span>
              </div>
              {refused !== null && refused.section === 'members' && refused.rowKey === member.userId ? (
                <RefusalBlock code={refused.code} />
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section
        className="tenant-settings-section"
        aria-labelledby="tenant-invitations-heading"
        data-testid="invitations-section"
      >
        <h2 className="tenant-settings-heading" id="tenant-invitations-heading">
          {ten('tenant.invitations.title')}
        </h2>

        <div className="tenant-invite-form">
          <div className="tenant-invite-field tenant-invite-field-email">
            <label className="tenant-invite-label" htmlFor="tenant-invite-email">
              {ten('tenant.invitations.email')}
            </label>
            <input
              id="tenant-invite-email"
              data-testid="invite-email"
              className="datum-control datum-field datum-focus-ring"
              type="email"
              value={email}
              aria-invalid={invalidEmail ? true : undefined}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="tenant-invite-field">
            <label className="tenant-invite-label" htmlFor="tenant-invite-role">
              {ten('tenant.invitations.role')}
            </label>
            <select
              id="tenant-invite-role"
              data-testid="invite-role"
              className="datum-control datum-select-trigger datum-focus-ring tenant-role-select"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value)}
            >
              {ROLE_CHOICES.map(([code, key]) => (
                <option key={code} value={code}>
                  {ten(key)}
                </option>
              ))}
            </select>
          </div>
          <Button
            data-testid="invite-submit"
            loading={busy === 'invite'}
            onClick={() => {
              void invite();
            }}
          >
            {ten('tenant.invitations.submit')}
          </Button>
        </div>
        {invalidEmail ? (
          <p className="tenant-settings-error" role="alert" data-testid="settings-error">
            {ten('tenant.invitations.emailInvalid')}
          </p>
        ) : null}
        {failed === 'form' ? <ErrorLine /> : null}
        {refused !== null && refused.section === 'form' ? <RefusalBlock code={refused.code} /> : null}

        {failed === 'invitations' ? <ErrorLine /> : null}
        {strandedIn('invitations', pending.map((row) => row.id)) && refused !== null ? (
          <RefusalBlock code={refused.code} />
        ) : null}

        {pending.length === 0 ? (
          <div className="tenant-settings-empty">
            <AreaEmptyState
              title={ten('tenant.settings.empty.title')}
              teach={ten('tenant.settings.empty.teach')}
              actionLabel={ten('tenant.settings.empty.action')}
              href={sessionsHref}
            />
          </div>
        ) : (
          <ul className="tenant-settings-list">
            {pending.map((invitation) => (
              <li key={invitation.id} className="tenant-settings-rows">
                <div
                  className="tenant-settings-row"
                  data-testid="invitation-row"
                  data-email={invitation.email}
                >
                  <span className="tenant-settings-row-name">
                    {invitation.email}
                    <span className="tenant-role-static numeric">{invitation.role}</span>
                  </span>
                  <span className="tenant-settings-row-right">
                    <span className="tenant-settings-when">
                      {invitedBefore}
                      <span className="numeric">
                        {mounted ? localTime(invitation.createdAt) : utcTime(invitation.createdAt)}
                      </span>
                      {invitedAfter}
                    </span>
                    <span className="tenant-settings-row-acts">
                      <Button
                        variant="secondary"
                        data-testid="invitation-resend"
                        aria-label={fill('tenant.invitations.resendLabel', {
                          email: invitation.email,
                        })}
                        loading={busy === invitation.id}
                        onClick={() => {
                          void resend(invitation);
                        }}
                      >
                        {ten('tenant.invitations.resend')}
                      </Button>
                      <Button
                        variant="secondary"
                        data-testid="invitation-revoke"
                        aria-label={fill('tenant.invitations.revokeLabel', {
                          email: invitation.email,
                        })}
                        loading={busy === invitation.id}
                        onClick={() => {
                          void revoke(invitation);
                        }}
                      >
                        {ten('tenant.invitations.revoke')}
                      </Button>
                    </span>
                  </span>
                </div>
                {refused !== null &&
                refused.section === 'invitations' &&
                refused.rowKey === invitation.id ? (
                  <RefusalBlock code={refused.code} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="tenant-announce" role="status">
        {announced}
      </div>
    </>
  );
}
