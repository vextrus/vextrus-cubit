/**
 * The projects region — the grid, the teaching empty state and the archived toggle
 * (docs/design/s-home.md §2, §3).
 *
 * One region, three routes. `/t/{slug}` holds it under the workspace's own head, `/t/{slug}/
 * projects` under the area's, and `/t/{slug}/projects/new` under the area's with the create
 * Dialog open above it — §4: "the projects area renders §2–§3's region verbatim (same test
 * ids)". What differs between them is the heading and the empty state's copy, which each route
 * supplies, because only that route knows what its next action is.
 *
 * Every count on a card goes through the format seam (L-FMT-01), including the four quick
 * stats, which are true zeros at M0: no sheets, campaigns, estimates or bids table exists yet
 * and zero is the fact, not a mock (Interpretation 7).
 */
import Link from 'next/link';
import { LocalTime } from '../../../local-time';
import { AreaEmptyState } from '../area-empty-state';
import { around, fill, ten } from '../../../strings';
import type { TenantStringKey } from '../../../strings';
import { formatNumber } from '../../../../../core/format';
import type { ProjectView } from '../../../../../modules/spine/projects';

/** §2's four quick stats, in the order the design fixes them. */
const STATS: readonly TenantStringKey[] = [
  'project.home.stats.sheets',
  'project.home.stats.campaigns',
  'project.home.stats.estimates',
  'project.home.stats.bids',
];

/** M0's honest count for every one of them. */
const NONE = '0';

/** `data-status`, which is the machine's word for what the Badge says in the reader's. */
const ACTIVE = 'active';
const ARCHIVED = 'archived';

/** A ghost Button's own variant, as an anchor wearing the Button surface asks for it. */
const GHOST = 'ghost';

/**
 * The Badge's own tone, worn by a span rather than by the primitive.
 *
 * `src/ui/primitives/index.ts` is a barrel of client components, and importing one value from
 * it into a Server Component pulls the whole roster — including the ones that hold state —
 * across the boundary. The card is server-rendered whole and holds nothing, so it wears the
 * Badge's surface directly: same class, same tone attribute, same paint in both themes.
 */
const NEUTRAL = 'neutral';

/** The empty state a route teaches with — its own copy, its own next action (§3, §4). */
export interface RegionEmptyCopy {
  readonly title: TenantStringKey;
  readonly teach: TenantStringKey;
  readonly action: TenantStringKey;
}

export interface ProjectsRegionProps {
  readonly slug: string;
  /** The projects in scope, already ordered by last activity (the module's own answer). */
  readonly projects: readonly ProjectView[];
  /** How many archived projects this workspace holds, shown or not. */
  readonly archivedCount: number;
  /** Whether the URL asked for them (`?archived=1`, Interpretation 5). */
  readonly showArchived: boolean;
  /** The route the archived toggle stays on — home, or the projects area (§4). */
  readonly basePath: string;
  readonly empty: RegionEmptyCopy;
}

/** §2: one card — an anchor to the project's settings pane, and everything the grid promises. */
function ProjectCard({ slug, project }: { readonly slug: string; readonly project: ProjectView }) {
  const [activityBefore, activityAfter] = around('project.home.lastActivity', 'time');
  const status = project.archived ? ARCHIVED : ACTIVE;
  return (
    <li>
      <Link
        href={`/t/${slug}/p/${project.id}/settings/project`}
        className="project-card datum-focus-ring"
        data-testid="project-card"
        data-project-id={project.id}
        data-status={status}
      >
        <span className="project-card-name-row">
          <span className="project-card-name">{project.name}</span>
          <span className="datum-badge" data-tone={NEUTRAL} data-testid="project-card-status">
            {ten(project.archived ? 'project.home.status.archived' : 'project.home.status.active')}
          </span>
        </span>
        <span className="project-card-code">{project.code}</span>
        <span className="project-card-stats" data-testid="project-card-stats">
          {STATS.map((stat) => (
            <span key={stat}>
              {ten(stat)}
              <span className="project-card-stat-value numeric">{formatNumber(NONE, 'count')}</span>
            </span>
          ))}
        </span>
        <span className="project-card-activity">
          {activityBefore}
          <LocalTime iso={project.lastActivityAt} />
          {activityAfter}
        </span>
      </Link>
    </li>
  );
}

export function ProjectsRegion({
  slug,
  projects,
  archivedCount,
  showArchived,
  basePath,
  empty,
}: ProjectsRegionProps) {
  const createHref = `/t/${slug}/projects/new`;
  const listHref = showArchived ? basePath : `${basePath}?archived=1`;
  return (
    <>
      {projects.length === 0 ? (
        <div className="project-empty" data-testid="home-empty">
          <AreaEmptyState
            title={ten(empty.title)}
            teach={ten(empty.teach)}
            actionLabel={ten(empty.action)}
            href={createHref}
          />
        </div>
      ) : (
        <ul className="project-grid" data-testid="home-projects">
          {projects.map((project) => (
            <ProjectCard key={project.id} slug={slug} project={project} />
          ))}
        </ul>
      )}
      {archivedCount === 0 ? null : (
        <Link
          href={listHref}
          className="project-archived-toggle datum-button datum-focus-ring"
          data-variant={GHOST}
          data-testid="home-show-archived"
        >
          {showArchived
            ? ten('project.home.hideArchived')
            : fill('project.home.showArchived', {
                count: formatNumber(String(archivedCount), 'count'),
              })}
        </Link>
      )}
    </>
  );
}
