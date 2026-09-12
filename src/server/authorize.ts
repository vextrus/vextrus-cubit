// The one door-guard (B-17, ARCH-02): every entry point that names a workspace, a project, a
// drawing or a permission asks THIS function, and no transport keeps a guard of its own.
//
// Before this file the tree held three half-guards, and each was half in a different way:
//
//  * `projectActorFor` (routers/spine.ts) took a `permission`, admitted on `holdsWorkspace` and then
//    used the permission it had been handed only to WORD the refusal — so the named permission was
//    never tested, and any member of the workspace passed every project door in it (L-ACT-03's
//    "the permission check lives in the act seam" held only on the write paths that reach
//    `requirePermission`; every read path and every preview was admitted by membership alone).
//  * `drawingInScope` (modules/takeoff/ingest/request.ts) scoped a drawing by tenant through the
//    row policy and never by project — so one project's door could name another project's drawing
//    inside the same workspace, and the policy, which is a TENANT boundary, could not tell.
//  * `GET /api/events` asked nothing at all.
//
// So the guard states all four questions in one place and answers them in one order — session, then
// workspace membership, then the named permission against the grants the ledger actually holds,
// then the drawing's binding to the project that named it. The permission reading is the act seam's
// own (`permissionsHeld`): this file asks it, it does not re-derive it, because "what does this
// person hold on this project" has one answer and L-ACT-03 says where it lives.
//
// The answer is a closed refusal in both of the shapes the tree already carries one in — a returned
// `RefusalCode` for the action doors that answer with a union, and the settled refusal marker for
// the tRPC doors that throw. Nothing here throws a raw Error at a caller (ARCH-03, B-21).
import { participatesIn, permissionNotHeld, permissionsHeld, type ActType, type ActorCtx, type Permission } from "../core/acts";
import { and, drawings, eq, forTenant, isUuid, projects, runAsSystem } from "../core/db";
import { REFUSALS, type RefusalCode } from "../core/errors";
import { refusal } from "../core/faults/refusal-marker";
import { holdsWorkspace } from "./shell/workspace";

/**
 * What a door presents. `userId` is the resolved session's — a door with no session has nothing to
 * authorize and answers SIGNED_OUT before it gets here.
 *
 * `tenantId` is an ASSERTION, never a source: where a project is named the owning workspace is
 * looked up as the system and a presented tenant that disagrees with it is refused rather than
 * believed, because a tenant id on the wire is a value the caller wrote.
 *
 * `permission` is the one L-ACT-03 says the door moves. Naming it is what makes it tested.
 */
export type AuthorizeRequest = {
  readonly userId: string;
  readonly tenantId?: string;
  readonly projectId?: string;
  readonly drawingId?: string;
  readonly permission?: Permission;
  /**
   * L-ACT-03's OTHER question, which a permission cannot ask: is this person ON the project at all?
   * The clause admits a door "tenant OWNER/ADMIN or participation on the project", and every read of
   * what a project holds is a participant's daily work — a door that asked MEASURE for a READ locked
   * out four of the six shipped roles (REVIEWER, LEAD, ESTIMATOR, BID_MANAGER hold no MEASURE).
   *
   * At M0 the clause reduces to participation: `memberships` carries no role column and the tree
   * declares no tenant OWNER/ADMIN anywhere, exactly as the lifecycle seam records. When workspace
   * roles land, this is where the OR widens.
   */
  readonly participation?: boolean;
  /** The act the permission is moving, or null on a read path — it words the refusal (L-ACT-03). */
  readonly actType?: ActType | null;
};

/** What a door gets when every question above was answered yes: the actor ctx the seams take. */
export type Authorized = {
  readonly authorized: true;
  readonly actor: ActorCtx;
  readonly tenantId: string;
  readonly userId: string;
};

/** What a door gets otherwise: a code of the closed taxonomy, never a sentence and never a fault. */
export type Refused = { readonly authorized: false; readonly refusal: RefusalCode };

export type AuthorizeAnswer = Authorized | Refused;

/** The codes this guard answers with, read off the closed registry rather than agreed by chance. */
const PERMISSION_NOT_HELD: RefusalCode = REFUSALS.PERMISSION_NOT_HELD.code;
const WORKSPACE_PERMISSION_NOT_HELD: RefusalCode = REFUSALS.WORKSPACE_PERMISSION_NOT_HELD.code;

/** Why the guard reads a project's owning workspace — recorded beside the statement it travels to. */
const OWNING_TENANT_REASON = "src/server/authorize.ts: the workspace a named project belongs to, before any tenant handle is opened";

/**
 * The guard. The order is the order the questions stop being answerable in: a project's workspace
 * has to be known before a membership can be tested, a membership before a grant can be read
 * (the grants are tenant-scoped rows), and a project before a drawing can be bound to it.
 */
export async function authorize(request: AuthorizeRequest): Promise<AuthorizeAnswer> {
  const tenantId = await owningTenant(request);
  if (tenantId === null) return { authorized: false, refusal: workspaceCodeFor(request) };
  if (!(await holdsWorkspace(request.userId, tenantId))) return { authorized: false, refusal: workspaceCodeFor(request) };

  // The named permission, tested against what the ledger holds — the whole reason this file exists.
  // A door that names no permission is a door that moves nothing and is admitted by membership, as
  // the shell's own screens are; a door that names one and a project gets L-ACT-03's real check.
  if (request.permission !== undefined) {
    if (request.projectId === undefined) return { authorized: false, refusal: PERMISSION_NOT_HELD };
    const held = await forTenant({ tenantId }).transaction(async (tx) => permissionsHeld(tx, request.projectId as string, request.userId));
    if (!held.has(request.permission)) return { authorized: false, refusal: PERMISSION_NOT_HELD };
  }

  // Participation, where the door asks for it. Asked after membership and beside the permission,
  // because it is the same shape of question about the same project: a door may name either, or
  // both. The refusal is the one a project door already answers with (R-SPINE-062, B-06).
  if (request.participation === true) {
    if (request.projectId === undefined) return { authorized: false, refusal: PERMISSION_NOT_HELD };
    const onIt = await forTenant({ tenantId }).transaction(async (tx) => participatesIn(tx, request.projectId as string, request.userId));
    if (!onIt) return { authorized: false, refusal: PERMISSION_NOT_HELD };
  }

  // The drawing is bound to the project that named it, not merely to the workspace. The row policy
  // already cut the read to this tenant; what it cannot say is which PROJECT inside the tenant owns
  // the row, and that is exactly the confusion a door naming both was open to.
  if (request.drawingId !== undefined && !(await drawingBoundTo(tenantId, request.drawingId, request.projectId))) {
    return { authorized: false, refusal: WORKSPACE_PERMISSION_NOT_HELD };
  }

  return { authorized: true, actor: { tenantId, userId: request.userId, actorKind: "human" }, tenantId, userId: request.userId };
}

/**
 * The same guard for the doors that throw: tRPC's procedures and the act-seam transports, which
 * carry a refusal as the settled marker rather than as a returned union. It throws a marked Error —
 * one the fault seam reads as an answer and never records as an outage — and never a raw one.
 */
export async function authorizeOrThrow(request: AuthorizeRequest): Promise<ActorCtx> {
  const answer = await authorize(request);
  if (answer.authorized) return answer.actor;
  if (answer.refusal === PERMISSION_NOT_HELD && request.permission !== undefined) {
    // L-ACT-03's refusal carries the act type and the missing permission; the act seam owns its
    // wording, so it is built there rather than spelled a second time here (B-17).
    throw permissionNotHeld(request.actType ?? null, request.permission);
  }
  throw refusal(answer.refusal, `the presented session does not hold what this door asks for`, { refusalCode: answer.refusal });
}

/**
 * The workspace a request is really in: the project's owner where one is named, the presented
 * tenant where none is. A presented tenant that disagrees with the project's owner is a caller
 * naming somebody else's workspace, and it names none.
 */
async function owningTenant(request: AuthorizeRequest): Promise<string | null> {
  if (request.projectId === undefined) {
    return request.tenantId !== undefined && isUuid(request.tenantId) ? request.tenantId : null;
  }
  if (!isUuid(request.projectId)) return null;
  const owning = await runAsSystem(OWNING_TENANT_REASON).select({ tenantId: projects.tenantId }).from(projects).where(eq(projects.projectId, request.projectId)).limit(1);
  const owner = owning[0]?.tenantId;
  if (owner === undefined) return null;
  if (request.tenantId !== undefined && request.tenantId !== owner) return null;
  return owner;
}

/**
 * Is this drawing this project's? Read through the tenant's handle, so the policy has already cut
 * the rows to the workspace; the project column is the question the policy cannot answer.
 *
 * A door that names a drawing and no project is asking only the workspace question, and gets it.
 */
async function drawingBoundTo(tenantId: string, drawingId: string, projectId: string | undefined): Promise<boolean> {
  if (!isUuid(drawingId)) return false;
  const rows = await forTenant({ tenantId })
    .select({ projectId: drawings.projectId })
    .from(drawings)
    .where(projectId === undefined ? eq(drawings.drawingId, drawingId) : and(eq(drawings.drawingId, drawingId), eq(drawings.projectId, projectId)))
    .limit(1);
  return rows[0] !== undefined;
}

/**
 * Which "you may not" a workspace-level miss answers with. A door that named a project keeps the
 * act seam's PERMISSION_NOT_HELD — that is the answer its callers already read and its tests
 * already assert — and a door that named only a workspace keeps R-SPINE-004's own code.
 */
function workspaceCodeFor(request: AuthorizeRequest): RefusalCode {
  return request.projectId === undefined ? WORKSPACE_PERMISSION_NOT_HELD : PERMISSION_NOT_HELD;
}
