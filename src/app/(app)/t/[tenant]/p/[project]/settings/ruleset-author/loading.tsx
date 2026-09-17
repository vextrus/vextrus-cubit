// R-UI-050's loading leg for this screen: bones that keep the shape the answer will take, inside the
// frame and the settings nav, which never skeleton. The bones are hidden from the accessibility tree
// by the primitive itself, and no spinner ever stands on this table (R-UI-004).
import { Skeleton } from "@/ui/primitives/core";

/** In the page's own order (§ 2): the title, the identity line, then the grid's rows. */
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
