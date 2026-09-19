// R-UI-050's loading leg for the Site facts panel: bones that keep the shape the answer will take,
// inside a frame that never skeletons. No spinner ever stands on this table (R-UI-004), and the bones
// are hidden from the accessibility tree by the primitive itself.
import { Skeleton } from "@/ui/primitives/core";
import { SITE_FACTS } from "@/core/site-facts/law";

/**
 * The bones, in the screen's own order (§ 2): the title, the face line, then one pair per fact of the
 * roster — the row at the height the table will draw it at, and the deferral beneath it — so nothing
 * moves under the reader when the answer lands.
 */
const BONES = [
  { height: "24px", width: "240px" },
  { height: "16px", width: "420px" },
  ...SITE_FACTS.flatMap(() => [
    { height: "28px", width: "min(1088px, 100%)" },
    { height: "72px", width: "min(880px, 100%)" },
  ]),
];

export default function ProjectSiteFactsLoading() {
  return (
    <div className="cx-shell-skeletons">
      {BONES.map((bone, index) => (
        <Skeleton key={`${bone.height}-${bone.width}-${index}`} style={bone} />
      ))}
    </div>
  );
}
