"use client";
// The top bar's occupant for R-SPINE-050's ⌘K door (I-135). Like the jobs tray (I-116) it is
// provider-gated: outside a `CommandPaletteProvider` there is no palette to open, so it renders
// nothing at all and a bare `ShellTopBar` mount stands exactly as it always has.
//
// It wears no keycap. `chordOf` reads the platform, which the server cannot know, so a cap drawn at
// first paint would either hydrate differently on an Apple machine or freeze the Control form as a
// lie; the keys reach assistive technology on `aria-keyshortcuts` and the eye in the Tooltip, which
// mounts only on hover or focus (I-140).
import { useCommandPalette } from "../patterns/command-palette/command-palette-provider";
import { Button, Tooltip } from "../primitives/core";
import { fill, strings } from "../strings";
import { chordOf, shortcutById } from "./shortcuts/roster";

export function CommandPaletteTrigger() {
  const palette = useCommandPalette();
  if (palette === null) return null;

  return (
    <Tooltip content={fill(strings.command_palette_trigger_tooltip, { keys: chordOf(shortcutById("palette")) })}>
      {/* No `aria-label`: the visible word is the accessible name (WCAG 2.5.3). */}
      <Button
        variant="ghost"
        className="cx-palette-trigger"
        data-testid="shell-command-palette"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={palette.openPalette}
      >
        <svg className="cx-palette-trigger-glyph" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
          <circle cx="5" cy="5" r="3.25" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="7.5" y1="7.5" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="cx-palette-trigger-label">{strings.command_palette_trigger}</span>
      </Button>
    </Tooltip>
  );
}
