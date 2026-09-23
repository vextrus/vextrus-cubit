// R-SPINE-050's one search door: what of a workspace answers to a few typed letters — and, inside a
// project, R-SPINE-052's first cut: the marks its register holds and the words its sheets show. The
// caller's membership is judged by the transport above (the `holdsWorkspace` shape every
// workspace-scoped door uses), and a project is searched only for a person the transport has found
// ON it (`authorize`'s participation); everything here reads through the tenant handle, so the
// boundary is the policy's and not this function's — a statement that named another workspace's rows
// would touch nothing however this file were reordered.
//
// Six kinds answer today. Campaigns, estimates, bids, book items and R-SPINE-052's item descriptions
// and notes join `SEARCH_KINDS` as their screens land, which is why the roster is stated once and
// read everywhere (B-19).
import { campaignsOf } from "../../core/campaigns";
import { drawingSets, drawings, forTenant, projects } from "../../core/db";
import { dotlessUpper } from "../../core/identity";
import { layoutNamesOf, projectDrawingsOf, sheetIdOf } from "../../core/sheets";
import { traceCitations } from "../../core/sheets/frames";
import { drawingsPlacingIn } from "../../modules/takeoff/partition/placement/store";
import { registerObjectsOf, repudiatedObjectsOf } from "../../modules/takeoff/register";
import { sheetTextHitsOf, type SheetTextHit } from "../../modules/takeoff/sheets/text-index";
import { pinnedRecordsOf } from "../../modules/takeoff/trace";

/** The closed roster a hit's kind belongs to. It grows by a line here, never by a second list. */
export const SEARCH_KINDS = ["project", "drawing", "sheet", "set", "mark", "text"] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number];

/** How many hits one ask answers with, at most. Stated once; the door and its acceptance read it. */
export const SEARCH_LIMIT = 20;

/**
 * One answered row. Every hit names the project it belongs to, because every address the palette
 * builds from one stands inside a project; the other identities are carried by the kinds that need
 * them (a sheet by its drawing and layout, a set by its own id, a find by the entities it opens on).
 */
export interface SearchHit {
  readonly kind: SearchKind;
  /**
   * The stored name, answered as it stands — a person's own words are not ours to reshape. A mark
   * find's label is the mark as the register holds it; a text find's is what the sheet says, as much
   * of it as a row shows around the words asked for.
   */
  readonly label: string;
  readonly projectId: string;
  readonly drawingId?: string | null;
  readonly setId?: string | null;
  readonly layoutName?: string | null;
  /** The row's second line: the project or drawing it stands in. A find's is composed where it is shown. */
  readonly meta?: string | null;
  /**
   * A find's own source key, which is also what keeps its row apart from every other: the text's key
   * (or its block reference's), or the first entity a mark find selects. Null on the name kinds.
   */
  readonly sourceKey?: string | null;
  /** The entities the viewer selects and flies to when a find is opened, each standing on `layoutName`. */
  readonly selection?: readonly string[] | null;
  /** How a reader names the sheet a find stands on: its number, else its layout's name; null for model space. */
  readonly sheetLabel?: string | null;
  /** A text find: the drawing's stored name, and whether its label was cut before or after the words shown. */
  readonly drawingName?: string | null;
  readonly clippedStart?: boolean;
  readonly clippedEnd?: boolean;
  /** A mark find: the element type its register rows were sighted as, and how many stand on this sheet. */
  readonly elementType?: string | null;
  readonly count?: number | null;
}

export interface SearchRequest {
  readonly tenantId: string;
  readonly query: string;
  /**
   * The project the palette stands inside, whose register and sheets are searched too — named only
   * once the transport has found the caller on it (I-476). Absent, the workspace's names alone.
   */
  readonly projectId?: string | null;
}

export interface SearchAnswer {
  readonly hits: readonly SearchHit[];
  /**
   * A registered refusal answered BESIDE the hits: the project the palette named is one this person
   * may not search, so its register and sheets were not read, while the workspace's own names were
   * (I-476; the palette's partial state, command-palette I-142).
   */
  readonly refusal?: string | null;
}

/** One card of the sheet index, as this door reads one — the fields a sheet hit is built from. */
export interface SheetIndexCard {
  readonly sheetId: string;
  readonly drawingId: string;
  readonly layoutName: string;
}

/** One mark a project's register holds, standing on one sheet, as the mark leg answers it. */
export interface MarkFind {
  readonly mark: string;
  readonly elementType: string;
  readonly drawingId: string | null;
  readonly layoutName: string | null;
  readonly sheetLabel: string | null;
  /** How many of the register's rows under this mark stand on this sheet. */
  readonly count: number;
  /** The members' outlines and marks on this sheet (core's `traceCitations`, I-421). */
  readonly selection: readonly string[];
}

type ProjectScope = { tenantId: string; projectId: string };

/**
 * The sheets of a project by name: one card per layout each drawing's current record lists, in the
 * order the sheet index lists them (`sheetIndexOf`'s cards, less everything the artifact says of a
 * sheet). Read off the stored records alone (`layoutNamesOf`): the sheet index proper reads every
 * artifact twice and every raster row, and asked as a person types over a set of more drawings than
 * `artifactAt` keeps, it re-read and re-validated the drawings on every keystroke — about three
 * seconds a search over the Edison set's five (I-478).
 */
export async function sheetNamesOf(scope: ProjectScope): Promise<SheetIndexCard[]> {
  const held = await forTenant({ tenantId: scope.tenantId }).transaction((tx) => projectDrawingsOf(tx, scope));
  return held.flatMap((drawing) => {
    const record = drawing.record;
    if (record === null) return [];
    return layoutNamesOf(record).map((layoutName) => ({ sheetId: sheetIdOf(record.ingestId, layoutName), drawingId: drawing.drawingId, layoutName }));
  });
}

/**
 * The seams this door takes injected. A sheet is not a row of a table: it is a reading of an ingest
 * record, and `src/core/sheets` is its one home (B-17). Taking it as a dependency is what lets the
 * sheet leg be proven without staging an ingest — and the two project legs likewise.
 */
export interface SearchDeps {
  sheetIndex?: (scope: ProjectScope) => Promise<readonly SheetIndexCard[]>;
  sheetText?: (scope: ProjectScope, query: string, limit: number) => Promise<readonly SheetTextHit[]>;
  registerMarks?: (scope: ProjectScope, query: string) => Promise<readonly MarkFind[]>;
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
 * The workspace's own rows whose stored name carries the query, case-insensitively, capped — then,
 * where a project is named, the marks its register holds and the words its sheets show. A blank or
 * whitespace query asks for nothing, so nothing is answered: a palette showing a workspace's first
 * twenty rows for an empty box would teach that the box does nothing.
 *
 * The names stand first: they are few, and a project's name is painted into every title block of
 * its drawings, so words ranked above names would bury the project a person asked for under its own
 * sheets. The finds fill the room the names leave.
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

  // The sheet leg reads one project's records per project, so it is asked only while the answer still
  // has room for what it would add.
  if (hits.length < SEARCH_LIMIT) {
    const index = deps.sheetIndex ?? sheetNamesOf;
    for (const project of everyProject) {
      const cards = await index({ tenantId: input.tenantId, projectId: project.projectId });
      for (const card of cards) {
        if (!card.layoutName.toLowerCase().includes(lowered)) continue;
        hits.push({ kind: "sheet", label: card.layoutName, projectId: project.projectId, drawingId: card.drawingId, layoutName: card.layoutName, meta: project.name });
      }
      if (hits.length >= SEARCH_LIMIT) break;
    }
  }

  // The project legs. A project this workspace does not hold names nothing to search: the tenant
  // handle already cut the roster above to this workspace, and the named project must be on it.
  const projectId = input.projectId ?? null;
  if (projectId !== null && projectName.has(projectId) && hits.length < SEARCH_LIMIT) {
    const scope = { tenantId: input.tenantId, projectId };
    const marks = await (deps.registerMarks ?? registerMarksOf)(scope, asked);
    for (const find of marks) hits.push(markHitOf(projectId, find));
    const room = SEARCH_LIMIT - hits.length;
    if (room > 0) {
      const texts = await (deps.sheetText ?? sheetTextHitsOf)(scope, asked, room);
      for (const find of texts) hits.push(textHitOf(projectId, find));
    }
  }

  return { hits: hits.slice(0, SEARCH_LIMIT) };
}

/** A mark of the register, as a row of the answer. */
function markHitOf(projectId: string, find: MarkFind): SearchHit {
  return {
    kind: "mark",
    label: find.mark,
    projectId,
    drawingId: find.drawingId,
    layoutName: find.layoutName,
    sheetLabel: find.sheetLabel,
    sourceKey: find.selection[0] ?? null,
    selection: find.selection,
    elementType: find.elementType,
    count: find.count,
  };
}

/** A text a sheet shows, as a row of the answer. */
function textHitOf(projectId: string, find: SheetTextHit): SearchHit {
  return {
    kind: "text",
    label: find.excerpt.text,
    projectId,
    drawingId: find.drawingId,
    layoutName: find.layoutName,
    sheetLabel: find.sheetLabel,
    sourceKey: find.sourceKey,
    selection: [find.sourceKey],
    drawingName: find.drawingName,
    clippedStart: find.excerpt.clippedStart,
    clippedEnd: find.excerpt.clippedEnd,
  };
}

/* ----------------------------------------------------------------------- the register's marks */

/**
 * The marks of a project's register that ARE what was asked — compared as the drawing's marks are
 * (`dotlessUpper`, L-CAD-07: `c-2` is `C2`), never as a substring: `C2` is not `C21`. Read over the
 * campaign the register renders (the project's latest), without the rows a person has struck — the
 * register withholds their lines, and a way to a row nobody can use is no way (I-173).
 *
 * Each row's member is placed by the Trace's own reading (`traceCitations` over the record the
 * campaign's revision pinned, I-421): the sheet its outline stands on, and the outline and mark
 * there. One find per mark, class and sheet, counting the rows standing on it and selecting every
 * member's two entities. A row whose placement no pinned record holds is answered with no sheet.
 *
 * Only the drawings that place in the named rows' views are read: a placement key begins with its
 * view's key (L-REG-04), so no other drawing can hold one. Reading every drawing of the project would
 * re-read and re-validate graphs past the four `artifactAt` keeps each time a mark is typed — and
 * retire the ones the viewer and the Trace are holding (I-475).
 */
export async function registerMarksOf(scope: ProjectScope, query: string): Promise<MarkFind[]> {
  const asked = dotlessUpper(query);
  if (asked === "") return [];
  const open = await campaignsOf(scope);
  const campaign = open[open.length - 1];
  if (campaign === undefined) return [];

  const registerScope = { tenantId: scope.tenantId, projectId: scope.projectId, setRevisionId: campaign.setRevisionId };
  const [objects, struck] = await Promise.all([registerObjectsOf(registerScope), repudiatedObjectsOf(registerScope)]);
  const gone = new Set(struck.map((row) => row.objectKey));
  const named = objects.filter((row) => !gone.has(row.objectKey) && dotlessUpper(row.mark) === asked);
  if (named.length === 0) return [];

  const views = [...new Set(named.map((row) => row.viewKey))];
  const drawingIds = await forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const placing = new Set<string>();
    for (const viewKey of views) for (const drawingId of await drawingsPlacingIn(tx, { ...scope, viewKey })) placing.add(drawingId);
    // In the project's own order, so a placement two records held would be read off the same one as before.
    return (await projectDrawingsOf(tx, scope)).map((drawing) => drawing.drawingId).filter((drawingId) => placing.has(drawingId));
  });
  const records = await pinnedRecordsOf(scope, campaign.setRevisionId, drawingIds);

  const finds = new Map<string, { mark: string; elementType: string; drawingId: string | null; layoutName: string | null; sheetLabel: string | null; count: number; selection: string[] }>();
  for (const row of named) {
    let drawingId: string | null = null;
    let layoutName: string | null = null;
    let sheetLabel: string | null = null;
    let flyTo: readonly string[] = [];
    for (const [heldBy, record] of records) {
      if (!record.standing.members.has(row.placementKey)) continue;
      const traced = traceCitations({ viewKey: row.viewKey, sources: [row.placementKey] }, record.standing);
      drawingId = heldBy;
      layoutName = traced.layoutName;
      sheetLabel = layoutName === null ? null : record.labelOf(layoutName);
      flyTo = traced.flyTo;
      break;
    }
    const at = `${dotlessUpper(row.mark)}\u0000${row.elementType}\u0000${drawingId ?? ""}\u0000${layoutName ?? ""}`;
    const find = finds.get(at) ?? { mark: row.mark, elementType: row.elementType, drawingId, layoutName, sheetLabel, count: 0, selection: [] };
    find.count += 1;
    for (const key of flyTo) if (!find.selection.includes(key)) find.selection.push(key);
    finds.set(at, find);
  }
  return [...finds.values()];
}
