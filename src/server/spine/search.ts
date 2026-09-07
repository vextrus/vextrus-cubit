// R-SPINE-050's read: what a workspace holds that a typed query names — its projects, its drawings,
// its sheets and its drawing sets, in the four kinds the palette knows how to travel to.
//
// It lives in the server layer rather than in a module because it composes across two of them: the
// sheet index is `src/modules/takeoff/sheets`' and the projects, drawings and sets are core tables,
// and only this layer may reach both (ARCH-01). Nothing here is a second answer to a question that
// already has one — the sheets come from the module's own index, never from a re-read of the record.
//
// The workspace is never taken on the caller's word: a tenant id on the wire is a value the caller
// wrote, so the session's membership is what admits the read, and everything after it runs under the
// tenant handle whose policies scope every row (SEAM-TENANT).
import { asc, drawingSets, drawings, forTenant, isUuid, projects } from "../../core/db";
import { refusal } from "../../core/faults/refusal-marker";
import { sheetIndexOf } from "../../modules/takeoff/sheets";
import { holdsWorkspace } from "../shell/workspace";

/** The four kinds R-SPINE-050 names for navigation, and the only kinds this read answers. */
export const SEARCH_HIT_KINDS = ["project", "drawing", "sheet", "set"] as const;

/** One of the four. The union is the roster's, so a kind exists in exactly one place. */
export type SearchHitKind = (typeof SEARCH_HIT_KINDS)[number];

/** One thing the workspace holds, with the ids the palette's address for that kind is built from. */
export interface SearchHit {
  readonly kind: SearchHitKind;
  /** The subject's own stored name — the words the query matched, rendered as they stand. */
  readonly label: string;
  readonly projectId: string;
  readonly drawingId?: string;
  readonly setId?: string;
  readonly layoutName?: string;
}

/** Who is asking, of which workspace, and what they typed. */
export interface SearchRequest {
  userId: string;
  tenantId: string;
  query: string;
}

/**
 * How many rows of one kind are read before the query is applied. A workspace is a bounded thing —
 * a firm's projects, its drawings, its sets — and the palette is a way to reach one of them by name,
 * not a report over all of them; the ceiling keeps one keystroke's cost bounded whatever the store
 * holds. It is stated once here rather than at each read (B-17).
 */
const SCAN_LIMIT = 500;

/** How many hits of one kind an answer carries, so no single kind crowds the other three out. */
const HITS_PER_KIND = 8;

/**
 * How many of the workspace's projects the sheet search reads an index for. A sheet's name lives
 * inside its drawing's ingest record rather than in a column, so reading them is per-project work;
 * the projects whose own name or drawings the query already reached come first, which is where a
 * person looking for a sheet by name is looking.
 */
const SHEET_PROJECT_SCAN = 8;

/** The reason recorded for the one thing this read refuses, in the register's own code. */
const NOT_HELD = "WORKSPACE_PERMISSION_NOT_HELD";

/**
 * The workspace's subjects a query names (AC-2). An empty or whitespace query asks for nothing and
 * is answered with nothing — never with everything, which would make the palette a listing rather
 * than a search.
 */
export async function searchWorkspace(request: SearchRequest): Promise<{ hits: SearchHit[] }> {
  const { userId, tenantId } = request;
  if (!isUuid(tenantId) || !(await holdsWorkspace(userId, tenantId))) {
    throw refusal(NOT_HELD, "the session holds no membership of the workspace this search names", { tenantId });
  }

  const needle = request.query.trim().toLowerCase();
  if (needle === "") return { hits: [] };

  const db = forTenant({ tenantId });
  const [projectRows, drawingRows, setRows] = await Promise.all([
    db.select({ projectId: projects.projectId, name: projects.name }).from(projects).orderBy(asc(projects.name)).limit(SCAN_LIMIT),
    db
      .select({ drawingId: drawings.drawingId, projectId: drawings.projectId, name: drawings.name })
      .from(drawings)
      .orderBy(asc(drawings.name))
      .limit(SCAN_LIMIT),
    db
      .select({ setId: drawingSets.setId, projectId: drawingSets.projectId, name: drawingSets.name })
      .from(drawingSets)
      .orderBy(asc(drawingSets.name))
      .limit(SCAN_LIMIT),
  ]);

  const matched = (name: string): boolean => name.toLowerCase().includes(needle);

  const projectHits: SearchHit[] = projectRows
    .filter((row) => matched(row.name))
    .slice(0, HITS_PER_KIND)
    .map((row) => ({ kind: "project", label: row.name, projectId: row.projectId }));

  const drawingHits: SearchHit[] = drawingRows
    .filter((row) => matched(row.name))
    .slice(0, HITS_PER_KIND)
    .map((row) => ({ kind: "drawing", label: row.name, projectId: row.projectId, drawingId: row.drawingId }));

  const setHits: SearchHit[] = setRows
    .filter((row) => matched(row.name))
    .slice(0, HITS_PER_KIND)
    .map((row) => ({ kind: "set", label: row.name, projectId: row.projectId, setId: row.setId }));

  const sheetHits = await sheetsNamed(tenantId, needle, nearestProjects(projectRows, drawingHits));

  return { hits: [...projectHits, ...drawingHits, ...sheetHits, ...setHits] };
}

/** One project of the workspace, as the scan read it. */
interface ProjectRow {
  projectId: string;
  name: string;
}

/**
 * The projects the sheet search reads, closest first: the ones a drawing hit already named, then the
 * rest of the workspace's in name order, to the ceiling.
 */
function nearestProjects(projectRows: readonly ProjectRow[], drawingHits: readonly SearchHit[]): readonly string[] {
  const ordered = [...drawingHits.map((hit) => hit.projectId), ...projectRows.map((row) => row.projectId)];
  return [...new Set(ordered)].slice(0, SHEET_PROJECT_SCAN);
}

/**
 * The sheets of those projects whose layout name the query reached, through the sheet index's one
 * door (ARCH-02): this read composes the module's answer and never re-derives a sheet from a record.
 */
async function sheetsNamed(tenantId: string, needle: string, projectIds: readonly string[]): Promise<SearchHit[]> {
  const found: SearchHit[] = [];
  for (const projectId of projectIds) {
    if (found.length >= HITS_PER_KIND) break;
    const cards = await sheetIndexOf({ tenantId, projectId });
    for (const card of cards) {
      if (found.length >= HITS_PER_KIND) break;
      if (!card.layoutName.toLowerCase().includes(needle)) continue;
      found.push({ kind: "sheet", label: card.layoutName, projectId, drawingId: card.drawingId, layoutName: card.layoutName });
    }
  }
  return found;
}
