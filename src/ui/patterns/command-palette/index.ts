/**
 * R-SPINE-050's palette and R-UI-032's `?` sheet (docs/design/command-palette.md,
 * docs/design/shortcut-sheet.md): the dialog, the sheet and the provider that holds the open state,
 * the query, this browser's recents and the one global key handler.
 *
 * Importing the pattern brings its stylesheet and the reticle's single home (R-UI-012), so no
 * consumer can render the palette unstyled or its input unfocusable.
 */
import "../../primitives/core/reticle.css";
import "./command-palette.css";

export { CommandPalette } from "./command-palette";
export { ShortcutSheet } from "./shortcut-sheet";
export { CommandPaletteProvider, useCommandPalette, RECENTS_LIMIT, recentsStorageKey } from "./provider";

export type { CommandGroup, CommandItem, CommandPaletteFault, CommandPaletteProps, PaletteRefusalCode } from "./command-palette";
export type { ShortcutSheetProps } from "./shortcut-sheet";
export type { CommandPaletteProviderProps, CommandPaletteState, PaletteRecent } from "./provider";
