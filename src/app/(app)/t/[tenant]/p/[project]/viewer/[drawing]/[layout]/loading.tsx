// R-UI-050's loading leg for S-Viewer: bones in the shape the sheet will take — the panel's heading
// over its layer rows, and one bone where the sheet itself is drawn. They are the same bones the
// client shows while the head is in flight, and they are spelled once (B-17).
import { SheetBones } from "./viewer-bones";

export default function ViewerSheetLoading() {
  return (
    <div className="cx-viewer cx-viewer-bones">
      <SheetBones />
    </div>
  );
}
