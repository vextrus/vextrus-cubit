// The signed-in frame (R-UI-030) and the parts it is built from. The stylesheet is imported here,
// beside the components it paints, so a screen that renders the frame cannot render it unstyled;
// the reticle is the one focus ring the tree has, from its single home (B-17).
import "../primitives/core/reticle.css";
import "./shell.css";

export { AppShell } from "./app-shell";
export { CommandPaletteTrigger } from "./command-palette-trigger";
export { DensityToggle } from "./density-toggle";
export { ThemeToggle, resolveChoice, storedTheme } from "./theme-toggle";
export { JobsTray } from "./jobs-tray";
export { ShellDenied } from "./shell-denied";
export { ShellEmptyState } from "./shell-empty-state";
// The provider and the slot are the frame's own parts, mounted by `AppShell` and by nothing else:
// they are deliberately NOT published here, because a second right column is exactly what R-UI-080
// forbids and an exported slot is an invitation to mount one. A screen reaches the region through
// `useInspector`, which is the whole of its public surface.
export { useInspector, useInspectorSlot, inspectorWidthWithin, storedInspectorWidth, INSPECTOR_WIDTH, INSPECTOR_WIDTH_MAX, INSPECTOR_WIDTH_MIN } from "./inspector";
// Likewise the state provider: the frame publishes `data-state` on the screen root, and a screen
// declares its state through the hook rather than by mounting a second publication of it.
export { SCREEN_ROOT_DEFAULT, SCREEN_ROOT_STATES, useDeclareScreenState, useScreenState } from "./screen-state";
export { STATUS_CELLS, StatusBar } from "./status-bar";
export { ShellToolbar, ShellToolbarGroup } from "./shell-toolbar";
export { HOVER_HOLD_MS, ShellRail } from "./shell-rail";
export { ShellTopBar } from "./shell-top-bar";
export { useFailureHandOff } from "./failure-hand-off";
export { SHELL_AREAS, areaLabel, areaOf, hasVisibleText, isAreaHome, projectHref, projectLabel, shellCrumbs, shellHref, workspaceLabel, workspaceOf } from "./routes";
export { CHORD_TIMEOUT_MS, SCOPE_LABEL, SHORTCUTS, SHORTCUT_SCOPES, chordOf, isTextField, keyWords, matchesStep, shortcutById } from "./shortcuts/roster";
export { SHELL_STATES, SHELL_STATE_NAMES, shellStateKey } from "./states";

export type { AppShellProps } from "./app-shell";
export type { DensityToggleProps } from "./density-toggle";
export type { ThemeChoice, ThemeToggleProps } from "./theme-toggle";
export type { ShellDeniedProps } from "./shell-denied";
export type { ShellEmptyStateProps } from "./shell-empty-state";
export type { ShellRailProps } from "./shell-rail";
export type { ShellTopBarProps } from "./shell-top-bar";
export type { ShellArea, ShellCrumbsInput, ShellProject, ShellWorkspace } from "./routes";
export type { ScreenRootState } from "./screen-state";
export type { StatusBarProps, StatusCellId, StatusJobState } from "./status-bar";
export type { ShellToolbarGroupProps, ShellToolbarProps } from "./shell-toolbar";
export type { Shortcut, ShortcutKeyEvent, ShortcutScope } from "./shortcuts/roster";
export type { ShellStateCell, ShellStateMatrix, ShellStateName } from "./states";
