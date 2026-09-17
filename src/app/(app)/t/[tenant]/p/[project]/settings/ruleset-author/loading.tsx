// R-UI-050's loading leg for this screen: bones that keep the page's shape inside the frame, which
// never skeletons — the nav it shows is resolved before the first paint. The bones are hidden from
// the accessibility tree by the primitive itself, and no spinner ever stands on this table.
import { Skeleton } from "@/ui/primitives/core";

/**
 * The bones, in the page's own order (§2): the 40 px header's title, the identity line, then the
 * diff grid's rows — all at the height the answer will draw them at, so nothing moves under the
 * reader when it lands (§5 rule 8).
 */
const BONES = [
  { height: "24px", width: "240px" },
  { height: "28px", width: "min(560px, 100%)" },
  { height: "28px", width: "min(880px, 100%)" },
  { height: "28px", width: "min(880px, 100%)" },
  { height: "28px", width: "min(880px, 100%)" },
  { height: "28px", width: "min(880px, 100%)" },
  { height: "28px", width: "min(880px, 100%)" },
  { height: "28px", width: "min(880px, 100%)" },
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
