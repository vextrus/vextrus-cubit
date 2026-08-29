// R-UI-050's loading leg for every workspace screen: bones that keep the page's shape, inside the
// frame — the frame itself never skeletons, because the workspace it shows is resolved before the
// first paint. The bones are hidden from the accessibility tree by the primitive itself.
import { Skeleton } from "../../../../ui/primitives/core";

export default function WorkspaceLoading() {
  return (
    <div className="cx-shell-skeletons">
      <Skeleton style={{ height: "24px", width: "240px" }} />
      <Skeleton style={{ height: "16px", width: "min(480px, 100%)" }} />
      <Skeleton style={{ height: "16px", width: "min(480px, 100%)" }} />
    </div>
  );
}
