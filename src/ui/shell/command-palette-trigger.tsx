"use client";
// The top bar's ⌘K occupant (R-UI-030, shell I-135): the one control that says the palette exists
// and where its key is. Provider-gated exactly as the jobs tray is (I-116) — outside a
// `CommandPaletteProvider` it renders nothing at all, which is what keeps every bare mount of the
// bar, and the shell gallery entry, standing exactly as they are.
//
// It wears no keycap. `chordOf` reads the platform, which the server cannot know, so a cap painted
// at first paint would either hydrate differently on an Apple machine or freeze the Control form as
// a lie (I-140): the key reaches assistive technology on `aria-keyshortcuts` and the eye through the
// Tooltip, which mounts only on hover or focus.
import { Button, Tooltip } from "../primitives/core";
import { useCommandPalette } from "../patterns/command-palette";
import { fill, strings } from "../strings";

/** The two chords AC-1 names, as WAI-ARIA 1.2 spells a chord. */
const KEYSHORTCUTS = "Meta+K Control+K";

export function CommandPaletteTrigger() {
  const palette = useCommandPalette();
  if (palette === null) return null;

  return (
    <Tooltip content={fill(strings.command_palette_trigger_tooltip, { keys: palette.paletteChord })}>
      {/* No `aria-label`: the visible word is the accessible name (WCAG 2.5.3). */}
      <Button
        ref={palette.registerTrigger}
        variant="ghost"
        className="cx-palette-trigger"
        data-testid="shell-command-palette"
        aria-haspopup="dialog"
        aria-keyshortcuts={KEYSHORTCUTS}
        onClick={palette.openPalette}
      >
        <span className="cx-palette-trigger-glyph" aria-hidden="true">
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="5" cy="5" r="3.25" />
            <path d="M7.6 7.6 L10.5 10.5" strokeLinecap="round" />
          </svg>
        </span>
        <span className="cx-palette-trigger-label">{strings.command_palette_trigger}</span>
      </Button>
    </Tooltip>
  );
}
