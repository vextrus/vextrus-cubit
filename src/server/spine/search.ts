// R-SPINE-050's one search door: what of a workspace answers to a few typed letters. The caller's
// membership is judged by the transport above (the `holdsWorkspace` shape every workspace-scoped
// door uses); everything here reads through the tenant handle, so the boundary is the policy's and
// not this function's — a statement that named another workspace's rows would touch nothing however
// this file were reordered.
//
// Four kinds answer today. Campaigns, estimates, bids and book items join `SEARCH_KINDS` as their
// screens land, which is why the roster is stated once and read everywhere (B-19).
import { drawingSets, drawings, forTenant, projects } from "../../core/db";
import { sheetIndexOf } from "../../modules/takeoff/sheets";

/** The closed roster a hit's kind belongs to. It grows by a line here, never by a second list. */
export const SEARCH_KINDS = ["project", "drawing", "sheet", "set"] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number];

/** How many hits one ask answers with, at most. Stated once; the door and its acceptance read it. */
export const SEARCH_LIMIT = 20;

/**
 * One answered row. Every hit names the project it belongs to, because every address the palette
 * builds from one stands inside a project; the other identities are carried by the kinds that need
 * them (a sheet by its drawing and layout, a set by its own id).
 */
export interface SearchHit {
  readonly kind: SearchKind;
  /** The stored name, answered as it stands — a person's own words are not ours to reshape. */
  readonly label: string;
  readonly projectId: string;
  readonly drawingId?: string | null;
  readonly setId?: string | null;
  readonly layoutName?: string | null;
  /** The row's second line: the project or drawing it stands in. */
  readonly meta?: string | null;
}

export interface SearchRequest {
  readonly tenantId: string;
  readonly query: string;
}

export interface SearchAnswer {
  readonly hits: readonly SearchHit[];
}

/** One card of the sheet index, as this door reads one — the fields a sheet hit is built from. */
export interface SheetIndexCard {
  readonly sheetId: string;
  readonly drawingId: string;
  readonly layoutName: string;
}

/**
 * The one seam this door takes injected. A sheet is not a row of a table: it is a reading of an
 * ingest record, and `src/modules/takeoff/sheets` is its one home (B-17). Taking it as a dependency
 * is what lets the sheet leg be proven without staging an ingest.
 */
export interface SearchDeps {
  sheetIndex?: (scope: { tenantId: string; projectId: string }) => Promise<readonly SheetIndexCard[]>;
}

/**
 * Does this stored name carry what was typed? Case-insensitively, over the letters a person really
 * typed — no metacharacter of theirs is a wildcard of ours.
 *
 * The comparison stands here rather than in the statement because the seam's one driver line hands
 * out the eight query operators and no containment among them (`src/core/db.ts`), and widening that
 * line belongs to the seam's owner, not to this door (B-17: one invariant, one home).
 */
function carries(name: string, lowered: string): boolean {
  return name.toLowerCase().includes(lowered);
}

/**
 * The workspace's own rows whose stored name carries the query, case-insensitively, capped. A blank
 * or whitespace query asks for nothing, so nothing is answered: a palette showing a workspace's
 * first twenty rows for an empty box would teach that the box does nothing.
 */
export async function searchWorkspace(input: SearchRequest, deps: SearchDeps = {}): Promise<SearchAnswer> {
  const asked = input.query.trim();
  if (asked === "") return { hits: [] };

  const scoped = forTenant({ tenantId: input.tenantId });
  const lowered = asked.toLowerCase();

  const [everyProject, everyDrawing, everySet] = await Promise.all([
    scoped.select({ projectId: projects.projectId, name: projects.name }).from(projects),
    scoped.select({ drawingId: drawings.drawingId, projectId: drawings.projectId, name: drawings.name }).from(drawings),
    scoped.select({ setId: drawingSets.setId, projectId: drawingSets.projectId, name: drawingSets.name }).from(drawingSets),
  ]);

  /** What a row's second line says: the project it stands in, by the name that project wears. */
  const projectName = new Map(everyProject.map((row) => [row.projectId, row.name]));

  const hits: SearchHit[] = [
    ...everyProject.filter((row) => carries(row.name, lowered)).map((row): SearchHit => ({ kind: "project", label: row.name, projectId: row.projectId })),
    ...everyDrawing
      .filter((row) => carries(row.name, lowered))
      .map((row): SearchHit => ({ kind: "drawing", label: row.name, projectId: row.projectId, drawingId: row.drawingId, meta: projectName.get(row.projectId) ?? null })),
    ...everySet
      .filter((row) => carries(row.name, lowered))
      .map((row): SearchHit => ({ kind: "set", label: row.name, projectId: row.projectId, setId: row.setId, meta: projectName.get(row.projectId) ?? null })),
  ];

  // The sheet leg is the expensive one — one index reading per project — so it is asked only while
  // the answer still has room for what it would add.
  if (hits.length < SEARCH_LIMIT) {
    const index = deps.sheetIndex ?? sheetIndexOf;
    const lowered = asked.toLowerCase();
    for (const project of everyProject) {
      const cards = await index({ tenantId: input.tenantId, projectId: project.projectId });
      for (const card of cards) {
        if (!card.layoutName.toLowerCase().includes(lowered)) continue;
        hits.push({ kind: "sheet", label: card.layoutName, projectId: project.projectId, drawingId: card.drawingId, layoutName: card.layoutName, meta: project.name });
      }
      if (hits.length >= SEARCH_LIMIT) break;
    }
  }

  return { hits: hits.slice(0, SEARCH_LIMIT) };
}
