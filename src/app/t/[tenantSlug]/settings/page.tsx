/**
 * `/t/{tenantSlug}/settings` — the Settings area (docs/design/shell.md §4, AC-3).
 *
 * Workspace settings arrive with the increments that found them. The one thing a reader can
 * manage today is their own signed-in sessions, so that is where the empty state's action
 * goes: the teaching line names a real destination rather than a promise (R-UI-033).
 */
import { notFound, redirect } from 'next/navigation';
import { AreaEmptyState } from '../area-empty-state';
import { ten } from '../../strings';
import { SIGN_IN_PATH, tenantContext } from '../../../../server/session';
import { tenantPath } from '../../../../ui/shell';

/** The one real destination Settings can send a reader to at M0 (Interpretation 7). */
const SESSIONS_SEGMENT = 'sessions';

export default async function TenantSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out') redirect(SIGN_IN_PATH);
  if (context === 'not-found') notFound();

  return (
    <div data-testid="tenant-settings">
      <h1 className="tenant-title">{ten('tenant.settings.title')}</h1>
      <div className="tenant-home-empty">
        <AreaEmptyState
          title={ten('tenant.settings.empty.title')}
          teach={ten('tenant.settings.empty.teach')}
          actionLabel={ten('tenant.settings.empty.action')}
          href={tenantPath(context.slug, SESSIONS_SEGMENT)}
        />
      </div>
    </div>
  );
}
