// What S-Home reads: the workspace's projects, each carrying every field R-SPINE-010 names, the
// status and last activity the clause lists beside them, and the four quick stats.
//
// The stats are counted, never typed (s-home I-36): a project's sheets are the layouts of each of
// its drawings' CURRENT ingest record — exactly the cards its sheet index shows, read off the same
// record (`sheetIndexOf`, R-TO-004) — and its campaigns are its rows of `campaigns`. Both are read
// once for the whole workspace and grouped by project here, so the home pays two reads however many
// projects it lists. No store holds an estimate or a bid yet, so those two sets are empty by
// construction and their counts are that emptiness — an honest zero, never a literal on a screen.
import { and, asc, campaigns, desc, drawings, eq, forTenant, ingests, isUuid, projects, type TenantDb } from "@/core/db";
import type { BuildingType } from "./draft";
import type { ProjectsCtx } from "./scope";

/** Where a project stands: the archived marker read as the word the screen shows it by. */
export type ProjectStatus = "active" | "archived";

/** The four counts the S-Home clause lists for each grid entry. */
export interface ProjectQuickStats {
  readonly sheets: number;
  readonly campaigns: number;
  readonly estimates: number;
  readonly bids: number;
}

/** One project as a workspace's home reads it. */
export interface Project {
  readonly projectId: string;
  readonly name: string;
  readonly code: string | null;
  readonly client: string | null;
  readonly siteAddress: string | null;
  readonly district: string | null;
  readonly buildingType: BuildingType | null;
  readonly storeys: number | null;
  readonly targetGfaM2: string | null;
  readonly notes: string | null;
  readonly status: ProjectStatus;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  /** The project's last activity: the moment its last write landed (the S-Home clause). */
  readonly updatedAt: Date;
  readonly quickStats: ProjectQuickStats;
}

/** The sets no store holds yet (no estimate or bid table has shipped), so each of them is empty. */
const NO_ESTIMATES: readonly never[] = [];
const NO_BIDS: readonly never[] = [];

/** What the workspace's two counted sets hold, per project. A project absent from a map holds none. */
export interface CountedSets {
  readonly sheets: ReadonlyMap<string, number>;
  readonly campaigns: ReadonlyMap<string, number>;
}

/**
 * The workspace's projects, ordered as the screen shows them: active first, then archived, each
 * group by last activity descending. The order is total — the project id settles two writes landing
 * in the same instant — so the grid a person leaves is the grid they come back to.
 */
export async function projectsForHome(ctx: ProjectsCtx): Promise<readonly Project[]> {
  const db = forTenant(ctx);
  const [rows, counted] = await Promise.all([
    db.select().from(projects).where(eq(projects.tenantId, ctx.tenantId)).orderBy(desc(projects.updatedAt), asc(projects.projectId)),
    countedSetsOf(db, ctx.tenantId),
  ]);

  const read = rows.map((row) => asProject(row, counted));
  return [...read.filter((project) => project.status === "active"), ...read.filter((project) => project.status === "archived")];
}

/**
 * Does this workspace hold that project? The one home of the question every project-scoped address
 * asks before it renders anything (B-17, ARCH-02) — a screen that answered it by reading the
 * workspace's whole roster would pay for every project, with its quick stats, to compare one id.
 *
 * The read is bounded to the one row an existence answer can use, and a segment that is not a uuid
 * names no project of anybody's: it answers false without a query, because postgres would raise
 * 22P02 — a driver error carrying no refusal marker — rather than an absence (ARCH-03).
 */
export async function projectHeld(scope: { tenantId: string }, projectId: string): Promise<boolean> {
  if (!isUuid(projectId)) return false;
  const held = await forTenant(scope)
    .select({ projectId: projects.projectId })
    .from(projects)
    .where(and(eq(projects.tenantId, scope.tenantId), eq(projects.projectId, projectId)))
    .limit(1);
  return held.length > 0;
}

/**
 * The workspace's sheets and campaigns, counted per project in one pass each.
 *
 * A sheet is a layout of a drawing's current record: a re-ingest supersedes rather than replaces
 * (R-TO-001), so only the NEWEST record of each drawing is counted, and a drawing waiting on its
 * first ingest contributes none — it has no sheets to show yet, which is what its sheet index says
 * too. The count is the length of the record's own layout inventory, the list the index makes one
 * card of per entry.
 */
async function countedSetsOf(db: TenantDb, tenantId: string): Promise<CountedSets> {
  const [records, opened] = await Promise.all([
    db
      .select({ projectId: drawings.projectId, drawingId: ingests.drawingId, facts: ingests.facts })
      .from(ingests)
      .innerJoin(drawings, eq(drawings.drawingId, ingests.drawingId))
      .where(and(eq(ingests.tenantId, tenantId), eq(drawings.tenantId, tenantId)))
      .orderBy(desc(ingests.createdAt), desc(ingests.ingestId)),
    db.select({ projectId: campaigns.projectId }).from(campaigns).where(eq(campaigns.tenantId, tenantId)),
  ]);
  return tallied(records, opened);
}

/** One ingest record as the tally reads it: whose drawing, which project, and its inventory. */
export interface TalliedRecord {
  readonly projectId: string;
  readonly drawingId: string;
  readonly facts: Readonly<Record<string, unknown>>;
}

/**
 * The two counts, grouped by project, from the rows the reads answered — records NEWEST FIRST, so
 * the first record met for a drawing is the one that stands for it. Pure, so the rule is judged
 * without a store (B-19).
 */
export function tallied(records: readonly TalliedRecord[], opened: readonly { readonly projectId: string }[]): CountedSets {
  const sheets = new Map<string, number>();
  const current = new Set<string>();
  for (const record of records) {
    // Newest first, so the first record seen for a drawing is the one that stands for it.
    if (current.has(record.drawingId)) continue;
    current.add(record.drawingId);
    sheets.set(record.projectId, (sheets.get(record.projectId) ?? 0) + layoutsOf(record.facts));
  }

  const held = new Map<string, number>();
  for (const campaign of opened) held.set(campaign.projectId, (held.get(campaign.projectId) ?? 0) + 1);

  return { sheets, campaigns: held };
}

/** How many layouts a record's inventory names — none where the record states no inventory. */
function layoutsOf(facts: Readonly<Record<string, unknown>>): number {
  const layouts = facts["layouts"];
  return Array.isArray(layouts) ? layouts.length : 0;
}

function asProject(row: typeof projects.$inferSelect, counted: CountedSets): Project {
  return {
    projectId: row.projectId,
    name: row.name,
    code: row.code,
    client: row.client,
    siteAddress: row.siteAddress,
    district: row.district,
    buildingType: row.buildingType,
    storeys: row.storeys,
    targetGfaM2: row.targetGfaM2,
    notes: row.notes,
    status: row.archivedAt === null ? "active" : "archived",
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    quickStats: {
      sheets: counted.sheets.get(row.projectId) ?? 0,
      campaigns: counted.campaigns.get(row.projectId) ?? 0,
      estimates: NO_ESTIMATES.length,
      bids: NO_BIDS.length,
    },
  };
}
