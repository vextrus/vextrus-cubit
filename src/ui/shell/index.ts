// The signed-in frame (R-UI-030) and the parts it is built from. The stylesheet is imported here,
// beside the components it paints, so a screen that renders the frame cannot render it unstyled;
// the reticle is the one focus ring the tree has, from its single home (B-17).
import "../primitives/core/reticle.css";
import "./shell.css";

export { AppShell } from "./app-shell";
export { ShellDenied } from "./shell-denied";
export { ShellEmptyState } from "./shell-empty-state";
export { ShellInspector } from "./shell-inspector";
export { ShellRail } from "./shell-rail";
export { ShellTopBar } from "./shell-top-bar";
export { useFailureHandOff } from "./failure-hand-off";
export { SHELL_AREAS, areaOf, hasVisibleText, isAreaHome, shellHref } from "./routes";
export { SHELL_STATES } from "./states";

export type { AppShellProps } from "./app-shell";
export type { ShellDeniedProps } from "./shell-denied";
export type { ShellEmptyStateProps } from "./shell-empty-state";
export type { ShellRailProps } from "./shell-rail";
export type { ShellTopBarProps } from "./shell-top-bar";
export type { ShellArea, ShellWorkspace } from "./routes";
export type { ShellStateCell, ShellStateMatrix, ShellStateName } from "./states";
