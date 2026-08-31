// R-SPINE-003's invitation mail, and the machinery the tenancy module is handed to make one.
//
// Everything here is a binding, not an invariant: the token mint and its digest are `./secrets`, the
// address fold is `./session`'s (which is `./folded-key`'s, one tier down), the outbox is `./mail`,
// and the link's shape is the test contract's. A module may not reach any of them (ARCH-01), so the
// server binds them once and hands them over — the same way the rate limiter is handed over as
// `admit` (B-17: none of these gets a second implementation on the way).
import type { InvitationMachinery } from "../../modules/spine/tenancy";
import { deliver } from "./mail";
import { digestOf, mintSecret } from "./secrets";
import { mailedAddress, storedAddressKey } from "./session";
import { presentedValue } from "./folded-key";

/** Where a mailed invitation is spent — the accept screen, carrying the token in its query. */
export const ACCEPT_INVITATION_ROUTE = "/accept-invitation";

/**
 * The link an invitation mail carries. It is built on the address the DEPLOYMENT states it answers
 * at, never on a property of the request that asked for it: a caller writes those, and a link built
 * on one would point wherever the caller said (R-SPINE-001). A deployment that has stated no address
 * still mails a spendable path — relative to whatever origin the reader opens it from.
 */
export function acceptInvitationUrl(origin: string, token: string): string {
  return `${origin}${ACCEPT_INVITATION_ROUTE}?token=${encodeURIComponent(token)}`;
}

/**
 * The machinery an invitation is made with, bound once. Handed to `guardTenancyMutation` beside
 * `admit`, so every seam that dispatches an invitation move spends the same mint, the same fold and
 * the same outbox.
 */
export const invitationMachinery: InvitationMachinery = Object.freeze({
  mintToken: mintSecret,
  digestToken: digestOf,
  storedKey: storedAddressKey,
  mailedAddress,
  addressForKey: presentedValue,
  send: ({ to, token, origin }: { to: string; token: string; origin: string }): void => {
    deliver({ to, kind: "invitation", url: acceptInvitationUrl(origin, token), token });
  },
});
