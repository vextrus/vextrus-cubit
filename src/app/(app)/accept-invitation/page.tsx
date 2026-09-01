// R-SPINE-003's ACCEPT screen: the invitee, signed in, decides about the workspace a mailed token
// names. It sits under the `(app)` session door, so a request carrying no session meets `/sign-in`
// before this file runs — the remedy for an ended session, never a permission answer (ARCH-03).
//
// The page is thin. It authenticates, reads the offer the token names through the tenancy module's
// one home, and renders it; a token that names nothing this account may claim is refused in place
// with the register's own words. Nothing here judges the token: `offeredInvitation` judges exactly
// what accepting judges, so the screen never shows an offer the accept would then refuse.
import "./accept-invitation.css";

import { redirect } from "next/navigation";
import { refusalOf } from "../../../core/errors";
import { refusalCodeOf } from "../../../core/faults/refusal-marker";
import { offeredInvitation } from "../../../modules/spine/tenancy";
import { invitationMachinery } from "../../../server/auth/invitation-mail";
import { presentedSessionToken } from "../../../server/shell/session";
import { sessionOf } from "../../../server/shell/resolve";
import { AcceptInvitationForm, AcceptInvitationNoToken, AcceptInvitationUnclaimable } from "./accept-invitation-form";
import { acceptInvitationStrings } from "./strings";

export const metadata = { title: acceptInvitationStrings.accept_heading };

export default async function AcceptInvitation({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const session = await sessionOf(await presentedSessionToken());
  // The group's own layout redirects a sessionless request; reaching here without one at all is a
  // race with a session that ended, and the way back in is the same door.
  if (session === null) redirect("/sign-in");

  // An address with no link behind it is not a refusal — nobody presented anything to be refused —
  // so it is the empty state, which teaches what is missing (R-UI-020).
  if (token === undefined || token === "") return <AcceptInvitationNoToken />;

  try {
    const offer = await offeredInvitation({ userId: session.userId, token }, invitationMachinery);
    return <AcceptInvitationForm token={token} offer={{ workspaceName: offer.workspaceName, workspaceRole: offer.workspaceRole }} />;
  } catch (thrown) {
    const code = refusalCodeOf(thrown);
    if (code !== refusalOf("INVITATION_NOT_CLAIMABLE").code) throw thrown;
    // Nothing is left to submit over a token no accept can claim, and no disarmed control stands in
    // its place: the answer is the refusal, with its code, its message and its remedy (I-65).
    return <AcceptInvitationUnclaimable refusal={refusalOf("INVITATION_NOT_CLAIMABLE")} />;
  }
}
