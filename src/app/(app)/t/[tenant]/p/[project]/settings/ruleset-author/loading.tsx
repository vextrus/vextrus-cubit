// R-UI-050's loading leg for the Author edition screen: bones that keep the shape the answer will
// take, inside a frame that never skeletons. No spinner ever stands on this table (R-UI-004), and
// the bones are hidden from the accessibility tree by the primitive itself.
import { Skeleton } from "@/ui/primitives/core";

/**
 * The bones, in the screen's own order (§ 2): the title, the identity line, then the diff grid's
 * seventeen rows at the row height the grid will draw them at, so nothing moves under the reader
 * when the answer lands (§5 rule 8).
 */
const BONES = [
  { height: "24px", width: "240px" },
  { height: "28px", width: "360px" },
  ...Array.from({ length: 17 }, () => ({ height: "28px", width: "min(880px, 100%)" })),
];

export default function ProjectRulesetAuthorLoading() {
  return (
    <div className="cx-shell-skeletons">
      {BONES.map((bone, index) => (
        <Skeleton key={`${bone.height}-${bone.width}-${index}`} style={bone} />
      ))}
    </div>
  );
}
