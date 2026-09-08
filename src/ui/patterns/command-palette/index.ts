/**
 * R-SPINE-050's ⌘K palette and R-UI-032's ? sheet (B-17, ARCH-02): one provider, one dialog, one
 * sheet, imported from here by every surface that opens them. The app layer feeds it typed rows and
 * the address to move to; nothing about a project, a drawing or a procedure is known here (ARCH-01).
 *
 * Importing the pattern brings its stylesheet and the reticle's single home (R-UI-012), so no
 * consumer can render the palette unstyled or its input unfocusable.
 */
import "../../primitives/core/reticle.css";
import "./command-palette.css";

export { CommandPalette } from "./command-palette";
export { CommandPaletteProvider, useCommandPalette } from "./command-palette-provider";
export { ShortcutSheet } from "./shortcut-sheet";
export { COMMAND_PALETTE_STATES } from "./states";
export { PALETTE_GROUPS, isAvailable, matchesQuery, optionId } from "./types";
// `RECENT_STORAGE_KEY` is deliberately not re-exported here: the gallery's completeness surface
// reads an uppercase function in a barrel as a component owing an entry (R-UI-011), and a storage
// key is not one. Its home is `./recents`, which is where the palette's own layer reads it.
export { RECENT_LIMIT, readRecents, rememberRecent } from "./recents";
export { paletteRefusalOf } from "./palette-body";

export type { CommandPaletteProviderProps, CommandPaletteValue } from "./command-palette-provider";
export type { PaletteBodyProps, PaletteGroup } from "./palette-body";
export type { PaletteAnswer, PaletteFault, PaletteGroupId, PaletteRefusal, PaletteRow, PaletteStatus } from "./types";
export type { PaletteState, PaletteStateRow } from "./states";
