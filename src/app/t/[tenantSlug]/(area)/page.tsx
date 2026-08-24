/**
 * `/t/{tenantSlug}` — S-Home: the projects grid, create project, recent documents
 * (S-Home, R-SPINE-010, R-UI-033, J-000, J-003; docs/design/s-home.md).
 *
 * Guard first, before any byte: no session is a 3xx to `/sign-in`, a slug this reader holds no
 * membership in is a 404, and only a member gets the page. Nothing streams — there is no
 * `loading.tsx` under `/t` — so the grid is one `listProjects` read, server-rendered whole,
 * which is what makes a created or archived project true on the next reload without the screen
 * holding anything of its own.
 *
 * The wrapper keeps `tenant-home` and the one h1 stays the workspace's name (Interpretation 1):
 * J-001's page object waits on that id at every landing and the shell reads the breadcrumb
 * against the page's first heading. Neither file is this increment's, so both are law.
 */
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import '../../projects.css';
import { ProjectsRegion } from './projects/projects-region';
import { ten } from '../../strings';
import { listProjects, projectContext } from '../../../../modules/spine/projects';
import { SIGN_IN_PATH, tenantContext } from '../../../../server/session';

/** Interpretation 5: `?archived=1` is the only thing that reveals the archived projects. */
const ARCHIVED_PARAM = 'archived';
const ARCHIVED_ON = '1';

/** §3: home's own teaching empty state, re-worded now that a project can be created. */
const HOME_EMPTY = {
  title: 'tenant.home.empty.title',
  teach: 'tenant.home.empty.teach',
  action: 'tenant.home.empty.action',
} as const;

export default async function TenantHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out') redirect(SIGN_IN_PATH);
  if (context === 'not-found') notFound();

  const query = await searchParams;
  const showArchived = query[ARCHIVED_PARAM] === ARCHIVED_ON;

  // One read answers both questions the region asks: which projects to show, and whether there
  // are hidden ones to say so about (§2's `home-show-archived`).
  const ctx = projectContext({ tenantId: context.tenantId, userId: context.session.userId });
  const all = await listProjects(ctx, { archived: true });
  const archivedCount = all.filter((project) => project.archived).length;
  const shown = showArchived ? all : all.filter((project) => !project.archived);

  return (
    <div data-testid="tenant-home">
      <h1 className="tenant-title">{context.name}</h1>
      <p className="tenant-slug">{context.slug}</p>

      <section className="project-section">
        <div className="project-section-head">
          <h2 className="project-section-title">{ten('project.home.projectsTitle')}</h2>
          {/* Always rendered, projects or none — creation is never more than one click from
              home (R-UI-033, §1). */}
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
          basePath={`/t/${context.slug}`}
          empty={HOME_EMPTY}
        />
      </section>

      <section className="project-section project-section-documents">
        <h2 className="project-section-title">{ten('project.home.documentsTitle')}</h2>
        {/* §6: the designed M0 state — no documents table exists, and the line says what will
            arrive rather than sitting silent (R-UI-020). */}
        <div className="project-documents" data-testid="home-recent-documents">
          <p className="project-documents-none">{ten('project.home.documentsNone')}</p>
        </div>
      </section>
    </div>
  );
}
