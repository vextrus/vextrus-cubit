"use server";
// What the members screen asks the server to do: R-SPINE-003's two moves and nothing else. Each one
// authenticates, names the facts the guard judges, and hands request and move to the module's one
// guarded entry — origin, allowance and the two-sided role law are judged there, in the order
// R-SPINE-006 states, and a guard of this seam's own would be a second opinion about a question that
// has one (SEAM-ACT, B-17, ARCH-02).
//
// A registered refusal is carried back to the screen that asked, which renders it in place; anything
// else is a fault and travels on to the boundary with its recorded id, never onto the screen as a
// sentence nobody registered (ARCH-03, B-21).
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { REFUSALS, type RefusalCode } from "../../../../../../core/errors";
import { refusalCodeOf } from "../../../../../../core/faults/refusal-marker";
import { guardTenancyMutation, tenancyMutationFrom, type TenancyActor, type TenancyRequest } from "../../../../../../modules/spine/tenancy";
import { admitAttempt } from "../../../../../../server/auth/rate-limit";
import { presentedSessionToken } from "../../../../../../server/shell/session";
import { sessionOf } from "../../../../../../server/shell/resolve";
import { membersRoute } from "./route-address";

/** The door this screen's mutations spend, as `AUTH_RATE_LIMITS` names it (R-SPINE-006). */
const TENANCY_DOOR = "tenancyAdmin" as const;

/** The deployment's own statement of the address it answers at, empty when nothing is configured. */
const PUBLIC_ORIGIN_VAR = "CUBIT_PUBLIC_ORIGIN";

/**
 * The guarded entry, bound once to the shipped limiter — the same binding the tRPC lane makes, so
 * every tenant-administration move this deployment carries out spends the one allowance and is
 * judged by the same three steps in the same order.
 */
const guarded = guardTenancyMutation({ admit: (identity: string) => admitAttempt(TENANCY_DOOR, identity) });

/** What a move answered: it landed, or the registered refusal that stopped it. */
export type MembersAnswer = { moved: true } | { moved: false; refusal: RefusalCode };

/**
 * The workspace a submission is about — the one the address it was made from names (R-UI-031). It is
 * stated rather than derived because a person belongs to many workspaces and this screen is one of
 * them; it grants nothing, because the two-sided role law reads the acting member's role in that
 * workspace out of the store and refuses a caller who holds none (R-SPINE-006).
 */
interface WorkspaceRequest {
  tenantId: string;
}

/** The role a submission states for a member of this workspace. */
export interface ChangeMemberRoleRequest extends WorkspaceRequest {
  subjectUserId: string;
  role: string;
}

/** The membership a submission asks to be taken away. */
export interface RemoveMemberRequest extends WorkspaceRequest {
  subjectUserId: string;
}

export async function changeMemberRoleAction(request: ChangeMemberRoleRequest): Promise<MembersAnswer> {
  return move("assignRole", request.tenantId, request);
}

export async function removeMemberAction(request: RemoveMemberRequest): Promise<MembersAnswer> {
  return move("removeMember", request.tenantId, request);
}

/**
 * One move, from the session to the guarded entry and back. The body is read into the union by the
 * module's own reader, so this seam holds no opinion about the words a role is named by, and the
 * committed move is answered by re-reading: the roster is what changed, and it is server-rendered
 * from the store the guard just wrote to.
 */
async function move(kind: "assignRole" | "removeMember", tenantId: string, body: unknown): Promise<MembersAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  // A session that ended mid-action is not a refusal this screen can resolve in place: the way back
  // in is the door, which is where the layout above sends a sessionless request too (I-57).
  if (session === null) redirect("/sign-in");

  const actor: TenancyActor = { tenantId, userId: session.userId };
  const mutation = tenancyMutationFrom(kind, body);
  try {
    await guarded(await requestFor(actor, session.userId), mutation);
  } catch (thrown) {
    return { moved: false, refusal: refused(thrown) };
  }
  revalidatePath(membersRoute(actor.tenantId));
  return { moved: true };
}

/**
 * What the guarded entry is told about the request beside the move itself. Neither half of the actor
 * is taken from the submission: the account is the one the session resolved to, and the workspace is
 * the module's own `actingWorkspaceOf` (R-SPINE-001, SEAM-TENANT).
 *
 * The origin rule is the module's; what this seam owes it are the three facts it judges. A server
 * action carries no `Request`, so the address it arrived at is read off the headers the platform
 * kept — and the deployment's own statement of its address stands beside it, which is what a
 * deployment behind a proxy is admitted by.
 */
async function requestFor(actor: TenancyActor, identity: string): Promise<TenancyRequest> {
  const sent = await headers();
  const host = sent.get("host") ?? "";
  const scheme = sent.get("x-forwarded-proto") ?? "http";
  return {
    actor,
    identity,
    statedOrigin: sent.get("origin"),
    requestOrigin: host === "" ? "" : `${scheme}://${host}`,
    configuredOrigin: process.env[PUBLIC_ORIGIN_VAR] ?? "",
  };
}

/**
 * The registered code a failure travels with, or the failure itself. A refusal is an answer and is
 * carried back to the row that asked; anything else is a fault, and re-throwing it is what puts it on
 * the error boundary with a recorded id rather than on this screen as an improvised sentence.
 */
function refused(thrown: unknown): RefusalCode {
  const code = refusalCodeOf(thrown);
  if (code === null || !Object.hasOwn(REFUSALS, code)) throw thrown;
  return code as RefusalCode;
}
