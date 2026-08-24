/**
 * The `/t/{tenantSlug}` segment's guard (R-SPINE-002, S-Auth §6, Q-12).
 *
 * The guard answers before any byte, and there is no `loading.tsx` beside this file or
 * anywhere below it (docs/design/shell.md Interpretation 4): a skeleton above the guard makes
 * Next answer 200 with the shell and stream the redirect after it, which hands a stranger the
 * chrome of a workspace they are about to be sent away from.
 *
 * The shell itself is one level down, in the two layouts that know which chrome to draw — the
 * areas' `(area)/layout.tsx` and the project's `p/[projectId]/layout.tsx` (see
 * `tenant-frame.tsx` for why a single layout here cannot). Client-side navigation does not
 * re-run a layout's guard, which is why each area page guards for itself as well: the session
 * can end while the rail is still on screen.
 */
import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { SIGN_IN_PATH, tenantContext } from '../../../server/session';

export default async function TenantSegmentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out') redirect(SIGN_IN_PATH);
  if (context === 'not-found') notFound();

  return children;
}
