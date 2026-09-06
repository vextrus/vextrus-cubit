// R-UI-050's loading leg for S-Project: bones that keep the page's shape inside the frame, which
// never skeletons — the workspace it shows is resolved before the first paint. The bones are hidden
// from the accessibility tree by the primitive itself, and nothing here spins (R-UI-004).
import { Skeleton } from "../../../../../../ui/primitives/core";

/** The bones, in the page's own order: the name, the four facts, the areas, the actions, the body. */
const BONES = [
  { height: "32px", width: "320px" },
  { height: "16px", width: "160px" },
  { height: "16px", width: "160px" },
  { height: "16px", width: "160px" },
  { height: "16px", width: "160px" },
  { height: "32px", width: "min(1080px, 100%)" },
  { height: "32px", width: "160px" },
  { height: "32px", width: "160px" },
  { height: "32px", width: "160px" },
  { height: "200px", width: "min(720px, 100%)" },
  { height: "200px", width: "320px" },
];

export default function ProjectHomeLoading() {
  return (
    <div className="cx-shell-skeletons">
      {BONES.map((bone, index) => (
        <Skeleton key={`${bone.height}-${bone.width}-${index}`} style={bone} />
      ))}
    </div>
  );
}
