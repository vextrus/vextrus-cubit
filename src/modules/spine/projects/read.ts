// What S-Home reads: the workspace's projects, each carrying every field R-SPINE-010 names, the
// status and last activity the clause lists beside them, and the four quick stats.
//
// The stats are counted, never typed: at M0 the store holds no sheet, campaign, estimate or bid, so
// each of the four sets is empty by construction and each count is that set's length — an honest
// zero the later J-000 legs fill, never a hidden region and never a literal on a screen.
import { asc, desc, eq, forTenant, projects } from "../../../core/db";
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

/** The sets a project's quick stats count. Nothing at M0 holds one, so each of them is empty. */
const NO_SHEETS: readonly never[] = [];
const NO_CAMPAIGNS: readonly never[] = [];
const NO_ESTIMATES: readonly never[] = [];
const NO_BIDS: readonly never[] = [];

/**
 * The workspace's projects, ordered as the screen shows them: active first, then archived, each
 * group by last activity descending. The order is total — the project id settles two writes landing
 * in the same instant — so the grid a person leaves is the grid they come back to.
 */
export async function projectsForHome(ctx: ProjectsCtx): Promise<readonly Project[]> {
  const rows = await forTenant(ctx)
    .select()
    .from(projects)
    .where(eq(projects.tenantId, ctx.tenantId))
    .orderBy(desc(projects.updatedAt), asc(projects.projectId));

  const read = rows.map(asProject);
  return [...read.filter((project) => project.status === "active"), ...read.filter((project) => project.status === "archived")];
}

function asProject(row: typeof projects.$inferSelect): Project {
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
    quickStats: { sheets: NO_SHEETS.length, campaigns: NO_CAMPAIGNS.length, estimates: NO_ESTIMATES.length, bids: NO_BIDS.length },
  };
}
