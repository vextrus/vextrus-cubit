// R-UI-050's loading leg for the sets index: bones that keep the page's shape inside the frame,
// which never skeletons — the workspace it shows is resolved before the first paint. The bones are
// hidden from the accessibility tree by the primitive itself, and none of them spins (R-UI-004).
//
// Re-cut for the grid (I-285): one bone per track — the header, the create row — and then the
// grid's own rows at the compact row height, so the shape that arrives is the shape that was held.
import { Skeleton } from "@/ui/primitives/core";

/** The bones, in the page's own order: the header track, then the create row. */
const BONES = [
  { height: "24px", width: "360px" },
  { height: "32px", width: "280px" },
];

/** The row bones — eight at the compact row height, which is what a first screenful of sets holds. */
const ROW_BONES = 8;
const ROW_BONE = { height: "28px", width: "min(720px, 100%)" };

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
