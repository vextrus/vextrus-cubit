// R-SPINE-050's read: everything a workspace holds that the command palette can navigate to — its
// projects, its drawings, the sheets of those drawings' current records, and its drawing sets.
//
// It lives in the server layer rather than in a module because it composes across two of them: the
// sheets are `sheetIndexOf`'s answer (src/modules/takeoff/sheets) and the rest are the tenant's own
// tables, and ARCH-01 lets only this layer hold both. Nothing here re-derives a sheet, re-counts a
// record or re-spells an address: the four kinds are named, and the app layer maps each to the
// route-address home that owns it (B-17).
import { asc, desc, eq, forTenant, drawingSets, drawings, projects } from "../../core/db";
import { sheetIndexOf } from "../../modules/takeoff/sheets";

/** The four kinds R-SPINE-050 names for navigation, and the only kinds this read answers. */
export const SEARCH_KINDS = ["project", "drawing", "sheet", "set"] as const;

/** One of the four. The union is the tuple's, so a kind exists in exactly one place. */
export type SearchKind = (typeof SEARCH_KINDS)[number];

/**
 * One thing the workspace holds. Every id the four addresses need travels beside the label, so the
 * caller builds an address out of the answer rather than asking a second question for it.
 */
export interface SearchHit {
  readonly kind: SearchKind;
  /** The subject's own name, as the workspace stored it — never a sentence this layer wrote. */
  readonly label: string;
  readonly id: string;
  readonly projectId: string;
  readonly drawingId?: string;
  readonly setId?: string;
  readonly sheetId?: string;
  readonly layoutName?: string;
  /** Where the subject lives — the project or the drawing a reader recognises it by. */
  readonly meta?: string;
}

/** Which workspace is being searched. The tenant is the caller's to have already admitted. */
export interface SearchScope {
  readonly tenantId: string;
}

/**
 * How many of each kind one query answers. A palette is a list a person reads, not a report, and an
 * unbounded read over a growing workspace would pay for rows nobody scrolls to.
 */
const PER_KIND = 50;

/**
 * What the workspace holds that matches, or nothing at all for a query that asks for nothing. A
 * blank query is not "everything": the palette lists recents, areas, actions and shortcuts without
 * asking the server, and answering the whole workspace here would replace all four.
 *
 * The match is a case-insensitive containment of the query in the subject's own name, judged in one
 * place for all four kinds so a project and a sheet can never be found by different rules.
 */
export async function searchWorkspace(scope: SearchScope, query: string): Promise<{ hits: SearchHit[] }> {
  const asked = query.trim().toLowerCase();
  if (asked === "") return { hits: [] };

  const matches = (name: string): boolean => name.toLowerCase().includes(asked);
  const held = forTenant(scope);

  const projectRows = await held
    .select({ projectId: projects.projectId, name: projects.name })
    .from(projects)
    .where(eq(projects.tenantId, scope.tenantId))
    .orderBy(desc(projects.updatedAt), asc(projects.projectId));

  const drawingRows = await held
    .select({ drawingId: drawings.drawingId, projectId: drawings.projectId, name: drawings.name })
    .from(drawings)
    .where(eq(drawings.tenantId, scope.tenantId))
    .orderBy(desc(drawings.createdAt), asc(drawings.drawingId));

  const setRows = await held
    .select({ setId: drawingSets.setId, projectId: drawingSets.projectId, name: drawingSets.name })
    .from(drawingSets)
    .where(eq(drawingSets.tenantId, scope.tenantId))
    .orderBy(desc(drawingSets.createdAt), asc(drawingSets.setId));

  const projectName = new Map(projectRows.map((row) => [row.projectId, row.name]));

  const hits: SearchHit[] = [
    ...projectRows
      .filter((row) => matches(row.name))
      .slice(0, PER_KIND)
      .map((row): SearchHit => ({ kind: "project", label: row.name, id: row.projectId, projectId: row.projectId })),
    ...drawingRows
      .filter((row) => matches(row.name))
      .slice(0, PER_KIND)
      .map((row): SearchHit => named({ kind: "drawing", label: row.name, id: row.drawingId, projectId: row.projectId, drawingId: row.drawingId }, projectName)),
    ...(await sheetHits(scope, projectRows, matches)).slice(0, PER_KIND).map((hit) => named(hit, projectName)),
    ...setRows
      .filter((row) => matches(row.name))
      .slice(0, PER_KIND)
      .map((row): SearchHit => named({ kind: "set", label: row.name, id: row.setId, projectId: row.projectId, setId: row.setId }, projectName)),
  ];

  return { hits };
}

/**
 * The sheets that match. A sheet is not a row of its own — it is a layout of the ingest record that
 * currently stands for a drawing — so it is read back through the sheet index's one door rather than
 * re-derived from the record here (ARCH-02, B-17).
 */
async function sheetHits(
  scope: SearchScope,
  projectRows: readonly { projectId: string }[],
  matches: (name: string) => boolean,
): Promise<SearchHit[]> {
  const found: SearchHit[] = [];
  for (const project of projectRows) {
    const cards = await sheetIndexOf({ tenantId: scope.tenantId, projectId: project.projectId });
    for (const card of cards) {
      if (!matches(card.layoutName)) continue;
      found.push({
        kind: "sheet",
        label: card.layoutName,
        id: card.sheetId,
        projectId: project.projectId,
        drawingId: card.drawingId,
        sheetId: card.sheetId,
        layoutName: card.layoutName,
      });
    }
  }
  return found;
}

/** The project a hit lives in, named for the reader — the same fact, never a second lookup. */
function named(hit: SearchHit, projectName: ReadonlyMap<string, string>): SearchHit {
  const meta = projectName.get(hit.projectId);
  return meta === undefined ? hit : { ...hit, meta };
}
