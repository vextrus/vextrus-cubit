// Who is asking, and of which workspace — the shape every door of this module takes first. It is
// the participants module's `ParticipantsCtx` minus the actor kind: a workspace role is moved by a
// person or it is not moved at all, and tenant administration writes no act to name a kind on
// (SEAM-ACT).
import { soleMembershipOf } from "./roles/store";

export interface TenancyActor {
  readonly tenantId: string;
  readonly userId: string;
}

/**
 * Which workspace a request is administering, given the tenant it named and the account asking.
 *
 * R-SPINE-002 makes the active tenant explicit — "a user may belong to many tenants; the active
 * tenant is explicit in the URL (`/t/{tenantSlug}/…`) and in the session" — so the tenant a request
 * states is the one it acts in, whoever states it. Nothing is granted by stating one: a workspace
 * this account holds no membership of is refused WORKSPACE_PERMISSION_NOT_HELD by the same law that
 * refuses every other stranger, and the value is judged against the store before any handle opens.
 *
 * A request that names none is the transports and callers that predate the switcher, and it is
 * answered from the account itself — but only where that is unambiguous. A person who belongs to
 * one workspace is administering that one; a person who belongs to several has named no workspace at
 * all, and is answered as the stranger to the unnamed workspace they are, never served the oldest
 * membership they happen to hold as though they had asked for it.
 */
export async function actingWorkspaceOf(userId: string, statedTenantId: string | null): Promise<string> {
  if (statedTenantId !== null && statedTenantId !== "") return statedTenantId;
  return (await soleMembershipOf(userId)) ?? "";
}
