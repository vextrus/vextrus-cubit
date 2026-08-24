/**
 * `/t/{tenantSlug}/sessions` — every device signed in to this account (S-Auth §8,
 * R-SPINE-001: "sessions with device list and revoke").
 *
 * Same guard as the landing, and the same chrome. The list is read on the server, where the
 * session cookie is, and handed to the client component that can revoke a row without
 * leaving the page. Viewing this screen requires a session, so the list is never empty —
 * which is why §9's roster says the empty state here is structurally absent.
 */
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { SessionList } from './session-list';
import type { SessionRow } from './session-list';
import { ten } from '../../../strings';
import { auth } from '../../../../../server/auth';
import { SIGN_IN_PATH, tenantContext } from '../../../../../server/session';

/** What better-auth's session list gives back, reduced to what the row needs. */
interface ListedSession {
  readonly id: string;
  readonly token: string;
  readonly userAgent?: string | null;
  readonly createdAt: Date | string;
}

export default async function TenantSessionsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out') redirect(SIGN_IN_PATH);
  if (context === 'not-found') notFound();

  const listed = (await auth.api.listSessions({
    headers: await headers(),
  })) as readonly ListedSession[];

  const rows: SessionRow[] = listed.map((session) => ({
    id: session.id,
    token: session.token,
    userAgent: session.userAgent ?? null,
    createdAt: new Date(session.createdAt).toISOString(),
    current: session.token === context.session.sessionToken,
  }));

  return (
    <div data-testid="tenant-sessions">
      <h1 className="tenant-title">{ten('tenant.sessions.title')}</h1>
      <p className="tenant-lead">{ten('tenant.sessions.lead')}</p>
      <SessionList sessions={rows} />
    </div>
  );
}
