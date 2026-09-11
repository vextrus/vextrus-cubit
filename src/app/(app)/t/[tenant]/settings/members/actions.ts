"use server";
// What the members screen asks the server to do: R-SPINE-003's two moves and nothing else. Each one
// authenticates, names the facts the guard judges, and hands request and move to the module's one
// guarded entry — origin, allowance and the two-sided role law are judged there, in the order
// R-SPINE-006 states, and a guard of this seam's own would be a second opinion about a question that
// has one (SEAM-ACT, B-17, ARCH-02).
//
// Both moves are opened through the one server-call seam (`@/server/call`): it reads what the row
// submitted against the schemas below and resolves the presented session ONCE for the action. A
// registered refusal is carried back to the screen that asked, which renders it in place; a
// submission that is not the shape a move is asked in is answered REQUEST_MALFORMED rather than reaching
// the module's reader as a body nobody can read; anything else is a fault and travels on to the
// boundary with its recorded id, never onto the screen as a sentence nobody registered (ARCH-03,
// B-21).
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { RefusalCode } from "@/core/errors";
import { guardTenancyMutation, tenancyMutationFrom, type TenancyActor, type TenancyRequest } from "@/modules/spine/tenancy";
import { admitAttempt } from "@/server/auth/rate-limit";
import { serverCall } from "@/server/call";
import { originFactsFromHeaders } from "@/server/context";
import { membersRoute } from "./route-address";

/** The door this screen's mutations spend, as `AUTH_RATE_LIMITS` names it (R-SPINE-006). */
const TENANCY_DOOR = "tenancyAdmin" as const;

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

/** What a row may state at these two doors. */
const ROLE_CHANGE: z.ZodType<ChangeMemberRoleRequest> = z.object({ tenantId: z.string(), subjectUserId: z.string(), role: z.string() });
const REMOVAL: z.ZodType<RemoveMemberRequest> = z.object({ tenantId: z.string(), subjectUserId: z.string() });

/**
 * What a refusal is to this screen. A session that ended mid-action is not a refusal it can resolve
 * in place: the way back in is the door, which is where the layout above sends a sessionless request
 * too (I-57). Every other registered refusal is rendered on the row that asked.
 */
function refusedAs(refusal: RefusalCode): MembersAnswer {
  if (refusal === "SIGNED_OUT") redirect("/sign-in");
  return { moved: false, refusal };
}

const changing = serverCall(
  ROLE_CHANGE,
  async (request, session): Promise<MembersAnswer> => move("assignRole", request, session.userId),
  refusedAs,
);

const removing = serverCall(
  REMOVAL,
  async (request, session): Promise<MembersAnswer> => move("removeMember", request, session.userId),
  refusedAs,
);

export async function changeMemberRoleAction(request: ChangeMemberRoleRequest): Promise<MembersAnswer> {
  return changing(request);
}

export async function removeMemberAction(request: RemoveMemberRequest): Promise<MembersAnswer> {
  return removing(request);
}

/**
 * One move, from the session to the guarded entry and back. The body is read into the union by the
 * module's own reader, so this seam holds no opinion about the words a role is named by, and the
 * committed move is answered by re-reading: the roster is what changed, and it is server-rendered
 * from the store the guard just wrote to. A refusal the guard raises needs no catch here — the seam
 * that opened the door carries it back in this screen's answer shape (ARCH-03).
 */
async function move(kind: "assignRole" | "removeMember", body: WorkspaceRequest, userId: string): Promise<MembersAnswer> {
  const actor: TenancyActor = { tenantId: body.tenantId, userId };
  await guarded(await requestFor(actor, userId), tenancyMutationFrom(kind, body));
  revalidatePath(membersRoute(actor.tenantId));
  return { moved: true };
}

/**
 * What the guarded entry is told about the request beside the move itself. Neither half of the actor
 * is taken from the submission: the account is the one the session resolved to, and the workspace is
 * the module's own `actingWorkspaceOf` (R-SPINE-001, SEAM-TENANT).
 *
 * The origin rule is the module's; what this seam owes it are the three facts it judges, and it
 * takes them from the one seam that derives them — `src/server/context.ts`, which the tRPC lane
 * reads through `createContext`. A server action carries no `Request`, so it hands over the headers
 * the platform kept instead; the env var's name, the configured value's normalisation and the
 * arrival address are answered there and nowhere twice (B-17).
 */
async function requestFor(actor: TenancyActor, identity: string): Promise<TenancyRequest> {
  return { actor, identity, ...originFactsFromHeaders(await headers()) };
}
