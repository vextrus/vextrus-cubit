// R-UI-050's loading leg for this screen: bones that keep the page's shape inside the frame, which
// never skeletons — the workspace it shows is resolved before the first paint. The bones are hidden
// from the accessibility tree by the primitive itself, and none of them spins (R-UI-004).
import { Skeleton } from "../../../../../../../ui/primitives/core";

/** The bones, in the page's own order: heading, caption, the upload region, the controls, the grid. */
const BONES = [
  { height: "24px", width: "240px" },
  { height: "16px", width: "360px" },
  { height: "160px", width: "min(720px, 100%)" },
  { height: "32px", width: "200px" },
  { height: "32px", width: "200px" },
];

/** The card bones, in the grid's own columns — six, which is what a first screenful holds. */
const CARD_BONES = 6;
const CARD_BONE = { height: "220px", width: "min(280px, 100%)" };

export default function ProjectDrawingsLoading() {
  return (
    <div className="cx-shell-skeletons">
      {BONES.map((bone, index) => (
        <Skeleton key={`${bone.height}-${bone.width}-${index}`} style={bone} />
      ))}
      {Array.from({ length: CARD_BONES }, (_, index) => (
        <Skeleton key={`card-${index}`} style={CARD_BONE} />
      ))}
    </div>
  );
}
