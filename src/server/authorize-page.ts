// The door a SERVER COMPONENT asks through (B-17, ARCH-02, R-SPINE-001).
//
// A route handler, an action and a tRPC procedure all reach `authorize()`. A page reached nothing:
// it took the tenant out of the URL, handed it to `forTenant({ tenantId })` — which arms the row
// policy with whatever it is given — and read the project. `projectHeld` then answered "yes, that
// project is in that workspace", which is true of a workspace the caller has never been a member of,
// so the check that looked like a guard was an existence test scoped by a value the caller wrote.
// The only membership check above these pages is the tenant layout's, and it never sees the project.
//
// So this is the pages' one call, and it asks the same guard in the same order: session, then the
// workspace the PROJECT is really in (never the segment), then the named permission. It answers the
// two ways this shell already answers, so nothing new appears on a screen: a request with no live
// session is sent to sign in, and a project this session may not have is not there.
import { notFound, redirect } from "next/navigation";
import type { Permission } from "../core/acts";
import { authorize, type Authorized } from "./authorize";
import { sessionOf } from "./shell/resolve";
import { presentedSessionToken } from "./shell/session";

/** Where a request with no live session goes — the shell's own answer, spelled once. */
const SIGN_IN = "/sign-in";

/**
 * Admit this render, or leave it. The answer is the actor the reads below it are scoped by: a page
 * that takes its `tenantId` from here rather than from `params` cannot arm the policy with a
 * workspace the caller merely typed, because a presented tenant that disagrees with the project's
 * owner is refused by the guard rather than believed.
 */
export async function authorizePage(named: { tenant: string; project?: string; permission?: Permission; participation?: boolean }): Promise<Authorized> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) redirect(SIGN_IN);

  const answer = await authorize({
    userId: session.userId,
    tenantId: named.tenant,
    ...(named.project === undefined ? {} : { projectId: named.project }),
    ...(named.permission === undefined ? {} : { permission: named.permission, actType: null }),
    ...(named.participation === true ? { participation: true } : {}),
  });
  // A project this session may not have and a project that is not there are the same answer, which
  // is the answer these pages already give for the second (notFound): a screen that distinguished
  // them would tell a stranger which project ids exist inside a workspace they are not in.
  if (!answer.authorized) notFound();
  return answer;
}
