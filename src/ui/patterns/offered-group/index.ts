/**
 * The offered-group pattern (L-ACT-02, R-UI-023, R-UI-011): the one place bulk is offered, and the
 * one shape it is offered in. Every surface that acts on more than one subject opens this — a second
 * one would be a second answer to who chose the subjects (B-17, ARCH-02).
 *
 * Importing it brings its stylesheet and the reticle's single home (R-UI-012), so no consumer can
 * render the offer unstyled or its door unfocusable.
 */
import "../../primitives/core/reticle.css";
import "./offered-group.css";

export { OfferedGroups } from "./offered-groups";
export type { OfferedGroupItem, OfferedGroupsProps } from "./offered-groups";
