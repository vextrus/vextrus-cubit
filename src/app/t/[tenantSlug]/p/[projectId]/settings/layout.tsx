/**
 * The project-settings pane frame — the nav above all three panes (panes file §1).
 *
 * A layout rather than a component each pane remembers to render: the ruleset pane is inc-012's
 * and untouched by this increment except for gaining this nav, and a nav every pane had to
 * import would be a nav the next pane forgets. It is how J-003 reaches the rule-set pin, which
 * is what makes that pane part of the project rather than a deep link.
 *
 * The items are anchors and not Tabs: these are routes, so the URL is the source of truth
 * (R-UI-031) and a fresh GET of any of them renders the same nav with a different one marked.
 */
import type { ReactNode } from 'react';
import '../../../../projects.css';
import { ProjectSettingsNav } from './settings-nav';

export default async function ProjectSettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string; projectId: string }>;
}) {
  const { tenantSlug, projectId } = await params;
  return (
    <>
      <ProjectSettingsNav tenantSlug={tenantSlug} projectId={projectId} />
      {children}
    </>
  );
}
