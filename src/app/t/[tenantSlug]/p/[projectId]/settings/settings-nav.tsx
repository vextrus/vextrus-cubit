'use client';

/**
 * The pane nav (panes file §1): the Tabs visual idiom rendered as anchors, because these are
 * routes and not panels.
 *
 * It is a client component for one reason — `aria-current="page"` marks the open pane, and the
 * open pane is whatever the URL says (R-UI-031). Reading it from `usePathname()` means a rail
 * click, a deep link and the browser's back button cannot disagree about which item is marked.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ten } from '../../../../strings';
import type { TenantStringKey } from '../../../../strings';

/** §1: the three panes, in the order the design fixes them. */
const PANES: readonly (readonly [string, TenantStringKey])[] = [
  ['project', 'project.settings.nav.project'],
  ['participants', 'project.settings.nav.participants'],
  ['ruleset', 'project.settings.nav.ruleset'],
];

export interface ProjectSettingsNavProps {
  readonly tenantSlug: string;
  readonly projectId: string;
}

export function ProjectSettingsNav({ tenantSlug, projectId }: ProjectSettingsNavProps) {
  const pathname = usePathname() ?? '';
  const base = `/t/${tenantSlug}/p/${projectId}/settings`;
  return (
    <nav
      className="project-settings-nav"
      aria-label={ten('project.settings.nav')}
      data-testid="project-settings-nav"
    >
      {PANES.map(([pane, label]) => (
        <Link
          key={pane}
          href={`${base}/${pane}`}
          className="project-settings-nav-item datum-focus-ring"
          aria-current={pathname === `${base}/${pane}` ? 'page' : undefined}
        >
          {ten(label)}
        </Link>
      ))}
    </nav>
  );
}
