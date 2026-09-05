// R-UI-050's loading leg for the sets index: bones that keep the page's shape inside the frame,
// which never skeletons — the workspace it shows is resolved before the first paint. The bones are
// hidden from the accessibility tree by the primitive itself, and none of them spins (R-UI-004).
import { Skeleton } from "../../../../../../../../ui/primitives/core";

/** The bones, in the page's own order: heading, caption, the create row, then the set rows. */
const BONES = [
  { height: "24px", width: "240px" },
  { height: "16px", width: "360px" },
  { height: "32px", width: "280px" },
  { height: "32px", width: "120px" },
];

/** The row bones — four, which is what a first screenful of sets holds. */
const ROW_BONES = 4;
const ROW_BONE = { height: "56px", width: "min(720px, 100%)" };

export default function ProjectDrawingSetsLoading() {
  return (
    <div className="cx-shell-skeletons">
      {BONES.map((bone, index) => (
        <Skeleton key={`${bone.height}-${bone.width}-${index}`} style={bone} />
      ))}
      {Array.from({ length: ROW_BONES }, (_, index) => (
        <Skeleton key={`row-${index}`} style={ROW_BONE} />
      ))}
    </div>
  );
}
