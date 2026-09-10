/**
 * The core slice of the Datum primitive set (R-UI-010). Consumers import primitives from here, and
 * importing them brings their stylesheets — the primitives' own and the reticle's single home
 * (B-17, R-UI-012) — so no consumer can render one of these unstyled or unfocusable.
 */
import "./reticle.css";
import "./core.css";

export { Badge } from "./badge";
// R-UI-002's glyph table and the roster derived from it, published beside the chip that renders it:
// every surface that shows a basis reads the pair from this one home, through this one barrel (B-17).
export { BASIS_GLYPHS, type Basis } from "./basis";
export { BasisChip } from "./basis-chip";
export { Button } from "./button";
export { Chip } from "./chip";
export { CoverageChip } from "./coverage-chip";
export { Input } from "./input";
export { Kbd } from "./kbd";
export { Skeleton } from "./skeleton";
export { Textarea } from "./textarea";
export { Tooltip } from "./tooltip";
export { UnitBadge } from "./unit-badge";
