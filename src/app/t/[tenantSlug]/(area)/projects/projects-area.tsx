/**
 * The Projects area's own body, shared by `/projects` and `/projects/new`
 * (docs/design/s-home.md §4).
 *
 * Interpretation 2: `/projects/new` *is* this area with the create Dialog open over it. A fresh
 * GET of either address renders the same region — same heading, same grid, same test ids — so
 * the Dialog is never a screen of its own that a reader could land on with nothing behind it,
 * and closing it is a navigation back to the area rather than a state change nobody can link to.
 */
import Link from 'next/link';
import '../../../projects.css';
import { ProjectsRegion } from './projects-region';
import { ten } from '../../../strings';
import { listProjects, projectContext } from '../../../../../modules/spine/projects';
import type { TenantContext } from '../../../../../server/session';

const ARCHIVED_PARAM = 'archived';
const ARCHIVED_ON = '1';

/** §4: the area keeps the locked keys; only where the action leads has changed. */
const AREA_EMPTY = {
  title: 'tenant.projects.empty.title',
  teach: 'tenant.projects.empty.teach',
  action: 'tenant.projects.empty.action',
} as const;

export interface ProjectsAreaProps {
  readonly context: TenantContext;
  readonly searchParams: Record<string, string | string[] | undefined>;
}

export async function ProjectsArea({ context, searchParams }: ProjectsAreaProps) {
  const showArchived = searchParams[ARCHIVED_PARAM] === ARCHIVED_ON;
  const ctx = projectContext({ tenantId: context.tenantId, userId: context.session.userId });
  const all = await listProjects(ctx, { archived: true });
  const archivedCount = all.filter((project) => project.archived).length;
  const shown = showArchived ? all : all.filter((project) => !project.archived);

  return (
    <div data-testid="tenant-projects">
      <div className="project-section-head">
        <h1 className="tenant-title">{ten('tenant.projects.title')}</h1>
        <Link
          href={`/t/${context.slug}/projects/new`}
          className="datum-button datum-focus-ring"
          data-variant="primary"
          data-testid="home-create-project"
        >
          {ten('project.home.create')}
        </Link>
      </div>
      <ProjectsRegion
        slug={context.slug}
        projects={shown}
        archivedCount={archivedCount}
        showArchived={showArchived}
        basePath={`/t/${context.slug}/projects`}
        empty={AREA_EMPTY}
      />
    </div>
  );
}
