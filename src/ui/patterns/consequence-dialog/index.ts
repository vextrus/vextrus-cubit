/**
 * The act pattern (R-UI-021), and its one home (B-17, ARCH-02): every act flow in the product opens
 * this dialog to show what the act would do and to carry the digest that binds it, and adds none of
 * its own. `ConsequenceSummary` is the dialog's body on its own, for a surface that previews an act
 * inline rather than in a modal (I-447) — the same consequence, read the same way.
 *
 * Importing it brings its stylesheet, the overlay Dialog's, the core primitives' and the reticle's
 * single home (R-UI-012), so no consumer can render a consequence unstyled or its confirm
 * unfocusable.
 */
import "../../primitives/core/reticle.css";
import "./consequence-dialog.css";

export {
  ConsequenceDialog,
  ConsequenceSummary,
  type CommittedAct,
  type ConsequenceDialogProps,
  type ConsequencePreview,
  type ConsequenceSummaryProps,
  type MeasurementFaces,
  variableWords as measurementVariableWords,
} from "./consequence-dialog";
