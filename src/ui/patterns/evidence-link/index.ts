/**
 * The Trace affordance (R-UI-022): one renderer, imported from here by every surface that offers a
 * reader the entities a number came from — the register's `source` cell and the viewer inspector's
 * Trace and Cited-by blocks today (B-17, ARCH-02).
 *
 * Importing it brings its stylesheet and the reticle's single home (R-UI-012), so no consumer can
 * render the link unstyled or unfocusable.
 */
import "../../primitives/core/reticle.css";
import "./evidence-link.css";

export { EvidenceLink } from "./evidence-link";
export type { EvidenceLinkProps } from "./evidence-link";
