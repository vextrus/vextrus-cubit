// R-UI-050's loading leg for the set browser: bones that keep the page's shape inside the frame,
// hidden from the accessibility tree by the primitive itself, and never a spinner (R-UI-004).
import { Skeleton } from "../../../../../../../../../ui/primitives/core";

/** The bones, in the page's own order: heading and caption, then the pin door. */
const BONES = [
  { height: "24px", width: "280px" },
  { height: "16px", width: "360px" },
];

/** The drawing rows a first screenful holds, then the pin door, then the pinned revision cards. */
const DRAWING_BONES = 5;
const DRAWING_BONE = { height: "72px", width: "min(720px, 100%)" };
const PIN_BONE = { height: "32px", width: "160px" };
const REVISION_BONES = 3;
const REVISION_BONE = { height: "96px", width: "min(720px, 100%)" };

export default function ProjectDrawingSetLoading() {
  return (
    <div className="cx-shell-skeletons">
      {BONES.map((bone, index) => (
        <Skeleton key={`${bone.height}-${bone.width}-${index}`} style={bone} />
      ))}
      {Array.from({ length: DRAWING_BONES }, (_, index) => (
        <Skeleton key={`drawing-${index}`} style={DRAWING_BONE} />
      ))}
      <Skeleton style={PIN_BONE} />
      {Array.from({ length: REVISION_BONES }, (_, index) => (
        <Skeleton key={`revision-${index}`} style={REVISION_BONE} />
      ))}
    </div>
  );
}
