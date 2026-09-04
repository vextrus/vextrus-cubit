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
import { refusalOf, type RefusalCode } from "../../../core/errors";
import { refusalCodeOf } from "../../../core/faults/refusal-marker";
import { offeredInvitation } from "../../../modules/spine/tenancy";
import { admitAttempt } from "../../../server/auth/rate-limit";
import { invitationMachinery } from "../../../server/auth/invitation-mail";
import { presentedSessionToken } from "../../../server/shell/session";
import { sessionOf } from "../../../server/shell/resolve";
import { AcceptInvitationForm, AcceptInvitationNoToken, AcceptInvitationRefused } from "./accept-invitation-form";
import { acceptInvitationStrings } from "./strings";

export const metadata = { title: acceptInvitationStrings.accept_heading };

/**
 * The two registered answers this screen renders in place of an offer: a token no accept can claim,
 * and the metered door refusing the read itself. Both are answers, not faults (ARCH-03).
 */
const ANSWERED_IN_PLACE: readonly RefusalCode[] = ["INVITATION_NOT_CLAIMABLE", "RATE_LIMITED"];

/** Is the mark the seam left one of those two — a membership question, and the answer's own code. */
function answeredInPlace(code: string | null): code is RefusalCode {
  const registered: readonly string[] = ANSWERED_IN_PLACE;
  return code !== null && registered.includes(code);
}

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
    // Reading an offer for whatever token an address carries is, unmetered, a token oracle: a
    // signed-in account can walk the space of tokens as fast as this screen will render. The read is
    // metered at the same door the accept itself spends (R-SPINE-006's `tenancyAdmin`), keyed on the
    // server-derived account rather than on anything the request carries, and spent BEFORE the token
    // is read so a refused walk learns nothing about the token it presented.
    await admitAttempt("tenancyAdmin", session.userId);

    const offer = await offeredInvitation({ userId: session.userId, token }, invitationMachinery);
    return <AcceptInvitationForm token={token} offer={{ workspaceName: offer.workspaceName, workspaceRole: offer.workspaceRole }} />;
  } catch (thrown) {
    const code = refusalCodeOf(thrown);
    // Anything the seam did not mark as one of this screen's registered answers is a fault of the
    // machine and travels on unchanged — a swallowed catch is how an outage becomes a shrug.
    if (!answeredInPlace(code)) throw thrown;
    // Nothing is left to submit over a token no accept can claim — or while the door is closed —
    // and no disarmed control stands in its place: the answer is the refusal, with its code, its
    // message and its remedy, through the one renderer (I-65, ARCH-03).
    return <AcceptInvitationRefused refusal={refusalOf(code)} />;
  }
}
