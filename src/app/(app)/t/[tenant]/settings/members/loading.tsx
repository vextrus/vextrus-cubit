// R-UI-050's loading leg for this screen: bones that keep the page's shape inside the frame, which
// never skeletons — the workspace it shows is resolved before the first paint. The bones are hidden
// from the accessibility tree by the primitive itself.
import { Skeleton } from "@/ui/primitives/core";

/**
 * The bones, in the page's own order (§2): the 40 px header's title, then the grid — a header row
 * and five member rows at the row height the table will draw them at. A skeleton that kept a
 * different height from the thing it stands in for is a layout that moves under the reader
 * (§5 rule 8: "loading (skeleton rows keep heights)").
 */
const BONES = [
  { height: "24px", width: "240px" },
  { height: "28px", width: "min(880px, 100%)" },
  { height: "28px", width: "min(880px, 100%)" },
  { height: "28px", width: "min(880px, 100%)" },
  { height: "28px", width: "min(880px, 100%)" },
  { height: "28px", width: "min(880px, 100%)" },
  { height: "28px", width: "min(880px, 100%)" },
];

export default function WorkspaceMembersLoading() {
  return (
    <div className="cx-shell-skeletons">
      {BONES.map((bone, index) => (
        <Skeleton key={`${bone.height}-${bone.width}-${index}`} style={bone} />
      ))}
    </div>
  );
}
