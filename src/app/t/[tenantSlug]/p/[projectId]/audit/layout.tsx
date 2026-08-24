/**
 * The audit segment's frame — the sub-nav above all three panes (docs/design/s-audit.md §2).
 *
 * A layout rather than a component each pane remembers to render, for the reason the settings
 * layout gives: a nav every pane had to import is a nav the next pane forgets. The project
 * segment's layout above has already answered the guard and 404'd an unknown project, so this
 * one only frames.
 */
import type { ReactNode } from 'react';
import '../../../../projects.css';
import './audit.css';
import { AuditNav } from './audit-nav';

export default async function ProjectAuditLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string; projectId: string }>;
}) {
  const { tenantSlug, projectId } = await params;
  return (
    <>
      <AuditNav tenantSlug={tenantSlug} projectId={projectId} />
      {children}
    </>
  );
}
