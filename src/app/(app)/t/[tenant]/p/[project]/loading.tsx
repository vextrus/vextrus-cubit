// R-UI-050's loading leg for S-Project: bones that keep the page's shape inside the frame, which
// never skeletons — the workspace it shows is resolved before the first paint. The bones are hidden
// from the accessibility tree by the primitive itself, and nothing here spins (R-UI-004).
import { Skeleton } from "../../../../../../ui/primitives/core";
import "./home/project-home.css";

/**
 * The bones, grouped as the page groups them (Decision §2): the name, then the four fact cells side
 * by side, the tab row, the three quick actions side by side, and the body's two columns beside each
 * other. A bone that stood in its own row where the page holds four abreast keeps a ladder's shape,
 * not the page's.
 */
const BONE_ROWS = [
  [{ height: "32px", width: "320px" }],
  [
    { height: "16px", width: "160px" },
    { height: "16px", width: "160px" },
    { height: "16px", width: "160px" },
    { height: "16px", width: "160px" },
  ],
  [{ height: "32px", width: "min(1080px, 100%)" }],
  [
    { height: "32px", width: "160px" },
    { height: "32px", width: "160px" },
    { height: "32px", width: "160px" },
  ],
  [
    { height: "200px", width: "min(720px, 100%)" },
    { height: "200px", width: "320px" },
  ],
];

export default function ProjectHomeLoading() {
  return (
    <div className="cx-shell-skeletons">
      {BONE_ROWS.map((row, rowIndex) => (
        <div className="cx-project-bone-row" key={`row-${rowIndex}`}>
          {row.map((bone, index) => (
            <Skeleton key={`${bone.height}-${bone.width}-${index}`} style={bone} />
          ))}
        </div>
      ))}
    </div>
  );
}
