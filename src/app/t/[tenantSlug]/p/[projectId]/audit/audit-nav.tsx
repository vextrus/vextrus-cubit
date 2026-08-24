'use client';

/**
 * The audit sub-nav (docs/design/s-audit.md §2) — the `project-settings-nav` idiom, verbatim.
 *
 * A client component for one reason, the settings nav's: `aria-current="page"` marks the open
 * pane, and the open pane is whatever the URL says (R-UI-031). Reading it from `usePathname()`
 * means a deep link, a nav click and the back button cannot disagree about which item is marked.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ten } from '../../../../strings';
import type { TenantStringKey } from '../../../../strings';

/** §2: the three panes, in the order the design fixes them; the acts pane is the segment root. */
const PANES: readonly (readonly [string, string, TenantStringKey])[] = [
  ['acts', '', 'project.audit.nav.acts'],
  ['models', '/models', 'project.audit.nav.models'],
  ['jobs', '/jobs', 'project.audit.nav.jobs'],
];

export interface AuditNavProps {
  readonly tenantSlug: string;
  readonly projectId: string;
}

export function AuditNav({ tenantSlug, projectId }: AuditNavProps) {
  const pathname = usePathname() ?? '';
  const base = `/t/${tenantSlug}/p/${projectId}/audit`;
  return (
    <nav
      className="project-settings-nav"
      aria-label={ten('project.audit.nav')}
      data-testid="audit-nav"
    >
      {PANES.map(([pane, segment, label]) => (
        <Link
          key={pane}
          href={`${base}${segment}`}
          className="project-settings-nav-item datum-focus-ring"
          data-testid={`audit-nav-${pane}`}
          aria-current={pathname === `${base}${segment}` ? 'page' : undefined}
        >
          {ten(label)}
        </Link>
      ))}
    </nav>
  );
}
