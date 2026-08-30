/**
 * The act pattern (R-UI-021), and its one home (B-17, ARCH-02): every act flow in the product opens
 * this dialog to show what the act would do and to carry the digest that binds it, and adds none of
 * its own.
 *
 * Importing it brings its stylesheet, the overlay Dialog's, the core primitives' and the reticle's
 * single home (R-UI-012), so no consumer can render a consequence unstyled or its confirm
 * unfocusable.
 */
import "./consequence-dialog.css";

export { ConsequenceDialog, type CommittedAct, type ConsequenceDialogProps, type ConsequencePreview } from "./consequence-dialog";
