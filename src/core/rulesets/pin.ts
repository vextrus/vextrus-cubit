/**
 * The pin, read back: one project's edition and the lineage it was forked down (R-SPINE-012).
 *
 * "the settings screen shows edition, digest, lineage, and parameter table" — so the read is
 * shaped like the screen: the project it is about, the edition it pinned, and the fork chain in
 * the order a reader walks it, platform first. The pane renders this and nothing else.
 *
 * Tenancy is the seam's, not a filter written here: the handle is `forTenant`, so a project of
 * another workspace is not a row this read can see. Absent and invisible are one answer —
 * `null`, which the page turns into the standard 404 (docs/design/s-project-settings.md
 * Interpretation 7) — because telling them apart would tell a stranger which project ids exist.
 */
import { forTenant } from '../db';
import { editionKey } from './editions';
import type { EditionScope, Method, RuleSetParameters } from './editions';

/** The shape `cubit.tenant_id` and every id column are cast to; a project id that is not one is not a row. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * How far a lineage may run before the walk calls it broken. Three today (platform → tenant →
 * project); authoring in M3 adds editions to the chain, not orders of magnitude to it.
 */
const LINEAGE_MAX = 16;

/** One edition, as the pane reads one. */
export interface EditionView {
  readonly id: string;
  readonly scope: EditionScope;
  /** `name @ version`, built at the seam so the screen never composes it (R-SPINE-060). */
  readonly key: string;
  readonly digest: string;
  readonly parameters: RuleSetParameters;
  readonly methods: readonly Method[];
}

/** The project the pane names, in the two fields the lead reads. */
export interface PinnedProjectView {
  readonly id: string;
  readonly name: string;
  readonly code: string;
}

/** A project, its pinned edition, and the chain that edition was forked down. */
export interface ProjectPin {
  readonly project: PinnedProjectView;
  readonly edition: EditionView;
  /** Platform seed first, this project's edition last — the order the lineage list shows. */
  readonly lineage: readonly EditionView[];
}

/** The scope column, read as the closed set the check constraint keeps it in. */
function scopeOf(value: string, editionId: string): EditionScope {
  if (value === 'platform' || value === 'tenant' || value === 'project') return value;
  throw new Error(`the rule-set edition ${editionId} carries the scope ${JSON.stringify(value)}`);
}

interface EditionRow {
  readonly id: string;
  readonly scope: string;
  readonly parentEditionId: string | null;
  readonly name: string;
  readonly version: string;
  readonly digest: string;
  readonly parameters: Record<string, string>;
  readonly methods: Method[];
}

function viewOf(row: EditionRow): EditionView {
  return {
    id: row.id,
    scope: scopeOf(row.scope, row.id),
    key: editionKey(row.name, row.version),
    digest: row.digest,
    parameters: row.parameters,
    methods: row.methods,
  };
}

/**
 * The project's pin, or `null` when the tenant holds no such project.
 *
 * A missing parent throws rather than rendering a shorter chain: `parent_edition_id` is NOT
 * NULL for every edition below the platform seed and every edition it can name exists, so a
 * gap is a broken database and the pane's error state is the honest answer (§6).
 */
export async function readProjectPin(ctx: {
  readonly tenantId: string;
  readonly projectId: string;
}): Promise<ProjectPin | null> {
  if (!UUID.test(ctx.projectId)) return null;
  const db = forTenant({ tenantId: ctx.tenantId });

  const project = await db.query.projects.findFirst({
    columns: { id: true, name: true, code: true, ruleSetEditionId: true },
    where: (row, { eq }) => eq(row.id, ctx.projectId),
  });
  if (project === undefined) return null;

  const lineage: EditionView[] = [];
  let editionId: string | null = project.ruleSetEditionId;
  while (editionId !== null) {
    const id: string = editionId;
    const row: EditionRow | undefined = await db.query.ruleSetEditions.findFirst({
      where: (column, { eq }) => eq(column.id, id),
    });
    if (row === undefined) {
      throw new Error(`the rule-set edition ${id} is named by a fork but is not in the database`);
    }
    // Unshifted, so the chain reads the way it was forked: platform, tenant, then this project.
    lineage.unshift(viewOf(row));
    if (lineage.length > LINEAGE_MAX) {
      throw new Error(`the lineage of the rule-set edition ${project.ruleSetEditionId} does not end`);
    }
    editionId = row.parentEditionId;
  }

  const edition = lineage[lineage.length - 1];
  if (edition === undefined) {
    throw new Error(`the project ${project.id} names no rule-set edition`);
  }

  return {
    project: { id: project.id, name: project.name, code: project.code },
    edition,
    lineage,
  };
}
