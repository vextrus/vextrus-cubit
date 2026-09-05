// R-TO-005 and L-REG-06 as a reading of the store and a pure address over it, in one home (B-17,
// ARCH-02): what a drawing revision IS, and what a pinned set revision is addressed by.
//
// A drawing is the lineage of `drawings` rows one project stores under one presented name, and each
// distinct sha256 in that lineage is a revision of it — so the upload seam already creates one the
// moment a changed file lands under a known name, and nothing here writes a row of its own. Both
// halves of L-REG-06's "(drawing, drawing revision) pairs by surrogate id" are ids the schema
// already mints: the first row's `drawing_id` names the drawing, and each row's own names the
// revision that row brought.
//
// The manifest's canonical form and its digest live here and only here: a second spelling of either
// would be a second address for one content, and a content address that two callers disagree about
// addresses nothing.
import { createHash } from "node:crypto";
import { and, desc, drawingSetRevisions, drawings, eq, isUuid, type TenantTx } from "../db";

/** Which workspace and project a reading is scoped to. */
export type SetScope = { readonly tenantId: string; readonly projectId: string };

/** One revision of a drawing: the row that brought this content, and where it stands in the lineage. */
export type DrawingRevision = {
  readonly revisionId: string;
  readonly sha256: string;
  readonly ordinal: number;
  readonly createdAt: Date;
};

/** One drawing, as the lineage of the rows a project stores under one presented name. */
export type DrawingLineage = {
  readonly drawingId: string;
  readonly name: string;
  readonly format: string;
  readonly revisions: readonly DrawingRevision[];
  readonly current: DrawingRevision;
};

/** One citation of a pinned manifest: which drawing, at which revision, of which content. */
export type ManifestMember = {
  readonly drawingId: string;
  readonly revisionId: string;
  readonly sha256: string;
  readonly name: string;
};

/** One pinned set revision, as the store holds it. */
export type SetRevisionRecord = {
  readonly setRevisionId: string;
  readonly digest: string;
  readonly actId: string;
  readonly pinnedAt: Date;
  readonly manifest: readonly ManifestMember[];
};

/** Code point order, never a locale's — `localeCompare` is a lint error tree-wide (L-REG-05). */
const byCodePoint = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

/** The tab the three surrogate facts of one citation are separated by. */
const FIELD = "\t";

/** One line of the canonical form: the drawing, the revision, and the content that revision is. */
const lineOf = (member: ManifestMember): string => `${member.drawingId}${FIELD}${member.revisionId}${FIELD}${member.sha256}`;

/**
 * The members in the order the address is taken over — L-REG-06's "members in canonical order". The
 * set is unordered, so the order a caller happened to build it in is not part of what it says.
 */
export function orderedManifest(members: readonly ManifestMember[]): ManifestMember[] {
  return [...members].sort((left, right) => byCodePoint(lineOf(left), lineOf(right)));
}

/**
 * The canonical text a manifest is addressed by: one line per member, sorted by code point, joined
 * by newlines. The presented name is deliberately absent — a drawing renamed is the same pair of
 * surrogate ids over the same content, and a set revision that changed address because somebody
 * re-typed a file name would not be content-addressed (L-REG-06, I-E).
 */
export function canonicalManifest(members: readonly ManifestMember[]): string {
  return orderedManifest(members).map(lineOf).join("\n");
}

/**
 * L-REG-06's content address: the sha-256 of the canonical text, lowercase hex. Adding, removing or
 * re-revving a member gives another text and therefore another address, which is what makes
 * "mutation is advance, never drift" checkable rather than promised.
 */
export function manifestDigest(members: readonly ManifestMember[]): string {
  return createHash("sha256").update(canonicalManifest(members), "utf8").digest("hex");
}

/**
 * Every drawing of a project, as lineages (R-TO-005, I-A).
 *
 * The rows are read oldest first — `created_at` asc, then `drawing_id` asc so two rows recorded in
 * one instant still have one order — and grouped by the presented name the project stores them
 * under. One revision per DISTINCT sha256 in first-appearance order: re-uploading bytes the lineage
 * already holds is not a changed file, so it adds no revision. The current revision is the one the
 * newest row stands at.
 */
export async function lineagesOf(tx: TenantTx, scope: SetScope): Promise<DrawingLineage[]> {
  if (!isUuid(scope.projectId)) return [];

  const rows = await tx
    .select({
      drawingId: drawings.drawingId,
      name: drawings.name,
      format: drawings.format,
      sha256: drawings.sha256,
      createdAt: drawings.createdAt,
    })
    .from(drawings)
    .where(and(eq(drawings.tenantId, scope.tenantId), eq(drawings.projectId, scope.projectId)));

  const arrived = [...rows].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime() || byCodePoint(left.drawingId, right.drawingId),
  );

  const held = new Map<string, { first: (typeof arrived)[number]; revisions: DrawingRevision[]; seen: Map<string, DrawingRevision>; current: DrawingRevision }>();
  for (const row of arrived) {
    const lineage = held.get(row.name);
    if (lineage === undefined) {
      const revision = { revisionId: row.drawingId, sha256: row.sha256, ordinal: 1, createdAt: row.createdAt };
      held.set(row.name, { first: row, revisions: [revision], seen: new Map([[row.sha256, revision]]), current: revision });
      continue;
    }
    // A content the lineage already holds is that same revision arriving again, never a new one:
    // "every upload of a CHANGED file creates a drawing revision" (R-TO-005).
    const known = lineage.seen.get(row.sha256);
    if (known !== undefined) {
      lineage.current = known;
      continue;
    }
    const revision = { revisionId: row.drawingId, sha256: row.sha256, ordinal: lineage.revisions.length + 1, createdAt: row.createdAt };
    lineage.revisions.push(revision);
    lineage.seen.set(row.sha256, revision);
    lineage.current = revision;
  }

  // Oldest lineage first: the order a drawing stands in never moves because it was revised.
  return [...held.values()].map((lineage) => ({
    drawingId: lineage.first.drawingId,
    name: lineage.first.name,
    format: lineage.first.format,
    revisions: lineage.revisions,
    current: lineage.current,
  }));
}

/**
 * The revision one set stands pinned at right now, or null where it has never been pinned. Newest
 * by the clock it was pinned at, tie-broken by its own id so the answer is one row and not a race.
 */
export async function currentSetRevisionOf(tx: TenantTx, scope: SetScope, setId: string): Promise<SetRevisionRecord | null> {
  if (!isUuid(setId)) return null;
  const rows = await tx
    .select()
    .from(drawingSetRevisions)
    .where(and(eq(drawingSetRevisions.tenantId, scope.tenantId), eq(drawingSetRevisions.setId, setId)))
    .orderBy(desc(drawingSetRevisions.createdAt), desc(drawingSetRevisions.setRevisionId))
    .limit(1);

  const newest = rows[0];
  return newest === undefined ? null : recordOf(newest);
}

/** One stored row read back as the record above — the one place the stored manifest is read. */
export function recordOf(row: {
  setRevisionId: string;
  digest: string;
  actId: string;
  createdAt: Date;
  manifest: { drawingId: string; revisionId: string; sha256: string; name: string }[];
}): SetRevisionRecord {
  return {
    setRevisionId: row.setRevisionId,
    digest: row.digest,
    actId: row.actId,
    pinnedAt: row.createdAt,
    manifest: row.manifest.map((member) => ({ drawingId: member.drawingId, revisionId: member.revisionId, sha256: member.sha256, name: member.name })),
  };
}
