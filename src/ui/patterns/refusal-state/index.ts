/**
 * The refusal pattern (R-UI-020): one renderer, imported from here by every surface that answers
 * with a refusal — including inside the overlay set's Dialog, where it renders between the body and
 * the actions and adds no chrome of its own (B-17, ARCH-02).
 *
 * Importing it brings its stylesheet and the reticle's single home (R-UI-012), so no consumer can
 * render a refusal unstyled or its evidence link unfocusable.
 */
import "../../primitives/core/reticle.css";
import "./refusal-state.css";

export { RefusalState } from "./refusal-state";
export type { RefusalEvidence, RefusalStateProps } from "./refusal-state";
