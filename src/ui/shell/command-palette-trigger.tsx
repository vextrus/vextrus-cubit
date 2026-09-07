"use client";
/**
 * The top bar's ⌘K occupant (docs/design/command-palette.md §1, shell I-135). It is the shipped
 * ghost Button under the shipped Tooltip and draws no chrome of its own.
 *
 * Provider-gated like the jobs tray (I-116): outside a `CommandPaletteProvider` the palette's state
 * answers null and the trigger renders nothing at all, which is what keeps a bare `ShellTopBar`
 * mount and the shell gallery entry standing exactly as they are.
 *
 * It wears no keycap. `chordOf` reads the platform, which the server cannot know, so a cap painted
 * at first paint would either hydrate differently on an Apple machine or freeze the Control form as
 * a lie (I-140). The keys reach assistive technology on `aria-keyshortcuts` and the eye through the
 * Tooltip, which mounts only on hover or focus.
 */
import { Tooltip } from "../primitives/core";
import { useCommandPalette } from "../patterns/command-palette";
import { SHORTCUTS, chordOf } from "./shortcuts/roster";
import { fill, strings } from "../strings";

/** The chords WAI-ARIA 1.2 spells for `aria-keyshortcuts`: Meta or Control, whichever the machine has. */
const KEYSHORTCUTS = "Meta+K Control+K";

/** The roster entry this control is the affordance for — its words come from the one roster (I-147). */
const PALETTE_SHORTCUT = SHORTCUTS.find((entry) => entry.action === "open-palette");

export function CommandPaletteTrigger() {
  const palette = useCommandPalette();
  // The hint is this browser's, and only this browser's: `chordOf` reads the platform, which the
  // server cannot know (I-140). Mounting the Tooltip only after the frame is standing keeps the
  // server's markup and the client's first render the same button, so the document the server sent
  // hydrates rather than being torn down and re-rendered around it.
  const [standing, setStanding] = useState(false);
  useEffect(() => {
    setStanding(true);
  }, []);

  if (palette === null) return null;
  const keys = PALETTE_SHORTCUT === undefined ? "" : chordOf(PALETTE_SHORTCUT);

  const trigger = (
    <>
      {/* The visible word IS the accessible name (WCAG 2.5.3), so no aria-label competes with it.
          The bar's own button size wins by naming `.cx-btn` beside the class (shell §1). */}
      <button
        type="button"
        className="cx-btn cx-palette-trigger cx-reticle"
        data-variant="ghost"
        data-testid="shell-command-palette"
        aria-haspopup="dialog"
        aria-keyshortcuts={KEYSHORTCUTS}
        ref={palette.registerTrigger}
        onClick={() => palette.setOpen(true)}
      >
        <span className="cx-palette-trigger-glyph" aria-hidden="true">
          {/* Geometry only: the stroke's colour and width are the stylesheet's, so no paint is
              authored in a component (R-UI-001). */}
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden="true">
            <circle cx="5" cy="5" r="3.5" />
            <path d="M7.6 7.6 L11 11" strokeLinecap="round" />
          </svg>
        </span>
        <span className="cx-palette-trigger-label">{strings.command_palette_trigger}</span>
      </button>
    </Tooltip>
  );
}
