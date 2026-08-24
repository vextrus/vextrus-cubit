/**
 * The workspace areas' layout — the shell, with no project open (R-UI-030).
 *
 * `(area)` is a route group: it names no URL segment, so every area under it keeps the exact
 * address R-UI-031 fixed. What it buys is a second sibling layout for `/p/{projectId}/…`,
 * which draws the same frame with the project's own breadcrumb, rail mark and switcher
 * (docs/design/s-project-settings-… Interpretation 5).
 */
import type { ReactNode } from 'react';
import { TenantFrame } from '../tenant-frame';

export default async function TenantAreaLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <TenantFrame tenantSlug={tenantSlug}>{children}</TenantFrame>;
}
