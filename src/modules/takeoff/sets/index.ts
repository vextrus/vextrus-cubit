// R-TO-005's one door for drawing sets (ARCH-02): the lineages a project holds, the sets over them,
// and the two draft writes a set's membership is edited by. A caller — the screens' pages, their
// server actions — speaks to a set through this file and never reaches past it.
//
// It composes rather than computes: what a drawing revision IS and what a manifest is addressed by
// are core's (src/core/sets), the pin is the act seam's, and what this file adds is the reading of
// the store around them. The manifest's canonical form and its digest are re-exported rather than
// re-derived — one address, one home (B-17).
import {
  and,
  asc,
  desc,
  drawingSetMembers,
  drawingSetRevisions,
  drawingSets,
  eq,
  forTenant,
  isUuid,
  type TenantTx,
} from "../../../core/db";
import { permissionsHeld } from "../../../core/acts";
import { REFUSALS } from "../../../core/errors";
import { lineagesOf, recordOf, type DrawingLineage, type ManifestMember } from "../../../core/sets";

export { canonicalManifest, manifestDigest } from "../../../core/sets";
export type { DrawingLineage, DrawingRevision, ManifestMember } from "../../../core/sets";

/** Which workspace and project a call is scoped to. */
export type SetScope = { readonly tenantId: string; readonly projectId: string };

/** One row of the sets index: what the set is, how big it is, and the address it stands pinned at. */
export type DrawingSetSummary = {
  readonly setId: string;
  readonly name: string;
  readonly memberCount: number;
  readonly revisionCount: number;
  readonly currentDigest: string | null;
};

/** One pinned set revision, as the browser is given one. */
export type SetRevision = {
  readonly setRevisionId: string;
  readonly digest: string;
  readonly actId: string;
  readonly pinnedAt: Date;
  readonly current: boolean;
  readonly manifest: readonly ManifestMember[];
};

/** One set, whole: what it names now, and every revision it has been pinned at. */
export type DrawingSetView = {
  readonly setId: string;
  readonly name: string;
  readonly members: readonly string[];
  readonly revisions: readonly SetRevision[];
};

/** The codes this door answers with, read off the closed taxonomy rather than spelled beside it (Q-07). */
const SET_NAME_NOT_USABLE = REFUSALS.SET_NAME_NOT_USABLE.code;
const SET_MEMBER_NOT_IN_PROJECT = REFUSALS.SET_MEMBER_NOT_IN_PROJECT.code;
const SET_NOT_PINNABLE = REFUSALS.SET_NOT_PINNABLE.code;

/**
 * A project key that is no uuid names nothing, and it is judged before this door is reached: the
 * pages answer such an address with Next's 404 and the server actions with the denial their actor
 * lookup raises. So a write door reached under one is a defect of the caller, not a person's
 * mistake — and it is not answered with a registered refusal, whose sentence would describe
 * something the person did (the name they typed, the set they toggled) that was never the trouble.
 */
function addressable(scope: SetScope): void {
  if (isUuid(scope.projectId)) return;
  throw new Error("a drawing-set door was asked under a project key that is no address — the address is judged before this module is reached");
}

/** What naming a set answered: the set, or the registered code that says why none was named. */
export type CreatedSet = { readonly created: true; readonly setId: string } | { readonly created: false; readonly refusal: typeof SET_NAME_NOT_USABLE };

/** What a toggle answered: whether the drawing is now a member, or why the draft did not move. */
export type ToggledMember =
  | { readonly toggled: true; readonly member: boolean }
  | { readonly toggled: false; readonly refusal: typeof SET_MEMBER_NOT_IN_PROJECT | typeof SET_NOT_PINNABLE };

/** Postgres' own code for a key already held — a name this project took while this call was in flight. */
const ALREADY_HELD = "23505";

/** The permission naming, changing and pinning a set moves (L-ACT-03, verbatim). */
const PIN_SET = "PIN_SET";

/**
 * Whether a person may name, change and pin the sets of this project — L-ACT-03's own reading, so
 * the two screens disclose exactly what the act seam would enforce and never a second opinion of it
 * (B-17). Both screens and both draft doors ask this one question.
 */
export async function holdsPinSet(scope: SetScope, userId: string): Promise<boolean> {
  if (!isUuid(scope.projectId)) return false;
  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => (await permissionsHeld(tx, scope.projectId, userId)).has(PIN_SET));
}

/** Every drawing of a project, as the lineages R-TO-005 makes a drawing (I-A). */
export async function drawingLineagesOf(scope: SetScope): Promise<DrawingLineage[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => lineagesOf(tx, scope));
}

/**
 * Every set of a project, newest first — with how many drawings it names, how many times it has been
 * pinned, and the digest it stands at now (null where it has never been pinned: an absence, never a
 * fake address).
 */
export async function setsOf(scope: SetScope): Promise<DrawingSetSummary[]> {
  if (!isUuid(scope.projectId)) return [];

  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const sets = await tx
      .select()
      .from(drawingSets)
      .where(and(eq(drawingSets.tenantId, scope.tenantId), eq(drawingSets.projectId, scope.projectId)))
      .orderBy(desc(drawingSets.createdAt), desc(drawingSets.setId));

    const summaries: DrawingSetSummary[] = [];
    for (const set of sets) {
      const members = await membersOf(tx, scope, set.setId);
      const revisions = await revisionsOf(tx, scope, set.setId);
      summaries.push({
        setId: set.setId,
        name: set.name,
        memberCount: members.length,
        revisionCount: revisions.length,
        currentDigest: revisions[0]?.digest ?? null,
      });
    }
    return summaries;
  });
}

/**
 * One set, whole, or null where this project holds no such set — an address naming nothing is an
 * absence the screen answers with Next's 404, never an empty set nobody created.
 */
export async function setOf(scope: SetScope, setId: string): Promise<DrawingSetView | null> {
  if (!isUuid(scope.projectId) || !isUuid(setId)) return null;

  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const held = await tx
      .select()
      .from(drawingSets)
      .where(and(eq(drawingSets.tenantId, scope.tenantId), eq(drawingSets.setId, setId), eq(drawingSets.projectId, scope.projectId)))
      .limit(1);
    const set = held[0];
    if (set === undefined) return null;

    const revisions = await revisionsOf(tx, scope, setId);
    return {
      setId: set.setId,
      name: set.name,
      members: await membersOf(tx, scope, setId),
      // The newest pinned revision is the one the set stands at; every older one stands exactly as
      // it was pinned (L-REG-06).
      revisions: revisions.map((revision, at) => ({ ...revision, current: at === 0 })),
    };
  });
}

/**
 * Name a set of this project. The name is taken as the person typed it, minus the whitespace around
 * it; a blank name names nothing, and a name the project already carries names no new set — both are
 * the one registered answer, because a person who typed either is told the same thing (R-TO-005).
 *
 * The pre-check and the store's own key both stand: the key is what makes the property true, and the
 * read is what turns a collision into an answer rather than a driver error nobody registered.
 */
export async function createSet(scope: SetScope, actor: { userId: string }, name: string): Promise<CreatedSet> {
  addressable(scope);
  const named = name.trim();
  if (named === "") return { created: false, refusal: SET_NAME_NOT_USABLE };

  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const taken = await tx
      .select({ setId: drawingSets.setId })
      .from(drawingSets)
      .where(and(eq(drawingSets.tenantId, scope.tenantId), eq(drawingSets.projectId, scope.projectId), eq(drawingSets.name, named)))
      .limit(1);
    if (taken[0] !== undefined) return { created: false, refusal: SET_NAME_NOT_USABLE };

    try {
      const written = await tx
        .insert(drawingSets)
        .values({ tenantId: scope.tenantId, projectId: scope.projectId, name: named, createdBy: actor.userId })
        .returning({ setId: drawingSets.setId });
      const setId = written[0]?.setId;
      if (setId === undefined) throw new Error("the drawing-set store accepted no row for a named set — a set nobody can point at is not a set");
      return { created: true, setId };
    } catch (thrown) {
      // Two people naming one set at the same moment: the key refused the second, and that is the
      // same answer the read above gives — a constraint reachable from a door owes a named answer
      // rather than a fault (ARCH-03).
      if (sqlStateOf(thrown) !== ALREADY_HELD) throw thrown;
      return { created: false, refusal: SET_NAME_NOT_USABLE };
    }
  });
}

/**
 * Put a drawing into a set or take it back out — the single-subject write a draft is edited by
 * (I-B). Nothing is derived from a draft, so this writes at once and records no act; what a set
 * cites is fixed by the pin, which is the act.
 */
export async function toggleMember(scope: SetScope, setId: string, drawingId: string, actor?: { userId: string }): Promise<ToggledMember> {
  addressable(scope);
  if (!isUuid(setId)) return { toggled: false, refusal: SET_NOT_PINNABLE };
  if (!isUuid(drawingId)) return { toggled: false, refusal: SET_MEMBER_NOT_IN_PROJECT };

  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const held = await tx
      .select({ setId: drawingSets.setId, createdBy: drawingSets.createdBy })
      .from(drawingSets)
      .where(and(eq(drawingSets.tenantId, scope.tenantId), eq(drawingSets.setId, setId), eq(drawingSets.projectId, scope.projectId)))
      .limit(1);
    const set = held[0];
    if (set === undefined) return { toggled: false, refusal: SET_NOT_PINNABLE };

    // A set names drawings of its own project: the roster is read through the lineages, so what may
    // be toggled is exactly what the browser lists (B-17).
    const lineages = await lineagesOf(tx, scope);
    const named = lineages.some((lineage) => lineage.drawingId === drawingId);
    if (!named) return { toggled: false, refusal: SET_MEMBER_NOT_IN_PROJECT };

    const standing = await membersOf(tx, scope, setId);
    if (standing.includes(drawingId)) {
      await tx
        .delete(drawingSetMembers)
        .where(and(eq(drawingSetMembers.tenantId, scope.tenantId), eq(drawingSetMembers.setId, setId), eq(drawingSetMembers.drawingId, drawingId)));
      return { toggled: true, member: false };
    }

    // The edit is attributed to the caller where it names one; a caller that names nobody — a lane
    // or a repair reading the draft as a whole — leaves it standing with the set's own author.
    await tx.insert(drawingSetMembers).values({ tenantId: scope.tenantId, setId, drawingId, addedBy: actor?.userId ?? set.createdBy }).onConflictDoNothing();
    return { toggled: true, member: true };
  });
}

/** The drawings one set names right now, in the order they were added. */
async function membersOf(tx: TenantTx, scope: SetScope, setId: string): Promise<string[]> {
  const rows = await tx
    .select({ drawingId: drawingSetMembers.drawingId })
    .from(drawingSetMembers)
    .where(and(eq(drawingSetMembers.tenantId, scope.tenantId), eq(drawingSetMembers.setId, setId)))
    .orderBy(asc(drawingSetMembers.addedAt), asc(drawingSetMembers.drawingId));
  return rows.map((row) => row.drawingId);
}

/** Every revision one set has been pinned at, newest first — the order the browser reads them in. */
async function revisionsOf(tx: TenantTx, scope: SetScope, setId: string): Promise<Omit<SetRevision, "current">[]> {
  const rows = await tx
    .select()
    .from(drawingSetRevisions)
    .where(and(eq(drawingSetRevisions.tenantId, scope.tenantId), eq(drawingSetRevisions.setId, setId)))
    .orderBy(desc(drawingSetRevisions.createdAt), desc(drawingSetRevisions.setRevisionId));
  return rows.map((row) => recordOf(row));
}

/** The database's own code for a failure, where the driver reported one. */
function sqlStateOf(thrown: unknown): string | null {
  if (typeof thrown !== "object" || thrown === null) return null;
  const code = (thrown as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}
