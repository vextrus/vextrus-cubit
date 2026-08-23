/**
 * The invitation mail (docs/design/s-settings.md §9).
 *
 * It goes through the existing mail seam — `src/server/mail.ts`, a row in
 * `public.auth_mail_outbox` — exactly as auth mail does, because M0 has no network beyond
 * loopback and a link that only exists inside a mail provider is a link nobody can follow.
 *
 * The link is `/sign-up` (Interpretation 6): join-by-link is a later increment, and today the
 * invited person creates an account with the invited address. The mail says exactly that. The
 * later increment changes this URL and nothing else.
 */
import { runAsSystem } from '../../../core/db';
import { sendAuthMail } from '../../../server/mail';
import { fill } from '../../../app/t/strings';
import { scopedTo } from './access';
import type { AdminContext } from './access';
import { roleCode } from './roles';

/** Where the invited person creates their account. */
const SIGN_UP_PATH = '/sign-up';

/** What the mail's absolute URL falls back to when nothing has named this deployment. */
const DEFAULT_PORT = '3210';

/**
 * The origin this process is reached at. "Absolute" is what makes a link in a mail
 * followable from outside the app, and the app answers on a different port in every lane — so
 * the deployment's own name comes first, then the lane's port, then dev's.
 */
function origin(): string {
  const named = process.env['BETTER_AUTH_URL'];
  if (named !== undefined && named.trim() !== '') return named.trim().replace(/\/+$/, '');
  const port = process.env['E2E_PORT'] ?? process.env['PORT'] ?? DEFAULT_PORT;
  return `http://127.0.0.1:${port}`;
}

export interface InvitationMail {
  readonly email: string;
  readonly role: string;
}

/** Send — or send again, verbatim — the invitation for one pending row. */
export async function sendInvitationMail(
  ctx: AdminContext,
  invitation: InvitationMail,
): Promise<void> {
  const tenant = await scopedTo(ctx).query.tenants.findFirst({
    columns: { name: true },
    where: (row, { eq }) => eq(row.id, ctx.tenantId),
  });
  const inviter = await runAsSystem(
    'the invitation mail names the account that sent it, which belongs to no one tenant',
  ).query.users.findFirst({
    columns: { email: true },
    where: (row, { eq }) => eq(row.id, ctx.userId),
  });

  const slots = {
    tenant: tenant?.name ?? '',
    inviter: inviter?.email ?? '',
    role: roleCode(invitation.role),
    url: `${origin()}${SIGN_UP_PATH}`,
  };
  await sendAuthMail('invite', invitation.email, slots.url, {
    subject: fill('tenant.mail.invite.subject', slots),
    body: fill('tenant.mail.invite.body', slots),
  });
}
