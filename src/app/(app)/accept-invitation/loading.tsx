// R-UI-050's loading leg for this screen: bones that keep the page's shape in the screen's own
// card — the route stands outside the shell, so the column it is laid in is its own (§1) and the
// bones are laid out by this route's own stylesheet. They stand inside the card the offer will fill,
// so nothing moves when it arrives. They are hidden from the accessibility tree by the primitive.
import "./accept-invitation.css";

import { Skeleton } from "@/ui/primitives/core";

/** The bones, in the screen's own order: the heading, the offer, then the control (§2). */
const BONES = [
  { height: "24px", width: "180px" },
  { height: "48px", width: "100%" },
  { height: "32px", width: "100%" },
];

export default function AcceptInvitationLoading() {
  return (
    <main className="cx-accept">
      <div className="cx-accept-column">
        <div className="cx-accept-card cx-accept-skeletons">
          {BONES.map((bone, index) => (
            <Skeleton key={`${bone.height}-${bone.width}-${index}`} style={bone} />
          ))}
        </div>
      </div>
    </main>
  );
}
