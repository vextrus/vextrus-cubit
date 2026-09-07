/**
 * The command palette (R-SPINE-050) and the `?` sheet (R-UI-032), and their one home (B-17,
 * ARCH-02): the dialog a person finds anything by, the sheet that documents every key, and the
 * provider that owns the open state, the query, the recents and the single global key handler both
 * of them answer to.
 *
 * Importing it brings its stylesheet and the reticle's single home (R-UI-012), so no consumer can
 * render the palette unstyled or its input unfocusable.
 */
import "../../primitives/core/reticle.css";
import "./command-palette.css";

export { CommandPalette } from "./command-palette";
export type { CommandPaletteProps } from "./command-palette";
export { ShortcutSheet } from "./shortcut-sheet";
export type { ShortcutSheetProps } from "./shortcut-sheet";
export { CommandPaletteProvider, useCommandPalette } from "./provider";
export type { CommandPaletteProviderProps } from "./provider";
export { isAvailable, matchesQuery } from "./types";
export type { CommandGroup, CommandItem, CommandPaletteContextValue, PaletteDestination, PaletteFault, PaletteStatus, RecentItem } from "./types";
export { COMMAND_PALETTE_STATES } from "./states";
export type { PaletteStateCell, PaletteStateRow } from "./states";
