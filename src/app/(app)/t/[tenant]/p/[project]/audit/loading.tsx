// R-UI-050's loading leg for this screen: bones that keep the page's shape inside the frame, which
// never skeletons — the workspace it shows is resolved before the first paint. The bones are hidden
// from the accessibility tree by the primitive itself.
import { Skeleton } from "../../../../../../../ui/primitives/core";

/** The bones, in the page's own order: heading, caption, the filter row, the entries, the panels. */
const BONES = [
  { height: "24px", width: "240px" },
  { height: "16px", width: "360px" },
  { height: "32px", width: "200px" },
  { height: "32px", width: "200px" },
  { height: "32px", width: "200px" },
  { height: "48px", width: "min(1080px, 100%)" },
  { height: "48px", width: "min(1080px, 100%)" },
  { height: "48px", width: "min(1080px, 100%)" },
  { height: "48px", width: "min(1080px, 100%)" },
  { height: "96px", width: "min(520px, 100%)" },
  { height: "96px", width: "min(520px, 100%)" },
];

export default function ProjectAuditLoading() {
  return (
    <div className="cx-shell-skeletons">
      {BONES.map((bone, index) => (
        <Skeleton key={`${bone.height}-${bone.width}-${index}`} style={bone} />
      ))}
    </div>
  );
}
