"use client";
// R-UI-032's "documented in the ? sheet": the roster, rendered. Every row here is an entry of
// `SHORTCUTS` and every entry has a row — the sheet enumerates the one roster rather than repeating
// it (B-19), so a binding added there is documented here by existing.
import { Kbd } from "../../primitives/core";
import { Dialog, DialogContent } from "../../primitives/overlay";
import { SCOPE_LABEL, SHORTCUTS, SHORTCUT_SCOPES, keyWords } from "../../shell/shortcuts/roster";
import { strings } from "../../strings";
import { useCommandPalette } from "./command-palette-provider";

/** The sheet's contents, free of the overlay around them, so every state can mount them (B-19). */
export function ShortcutSheetBody() {
  return (
    <>
      <h2 className="cx-shortcut-sheet-title">{strings.shortcut_sheet_label}</h2>
      {SHORTCUT_SCOPES.map((scope) => {
        const bound = SHORTCUTS.filter((entry) => entry.scope === scope);
        if (bound.length === 0) return null;
        return (
          <section key={scope} className="cx-shortcut-sheet-scope">
            <h3 className="cx-shortcut-sheet-scope-name">{strings[SCOPE_LABEL[scope]]}</h3>
            <ul className="cx-shortcut-sheet-rows">
              {bound.map((entry) => (
                <li key={entry.id} data-testid="shortcut-sheet-row" data-shortcut={entry.id} className="cx-shortcut-sheet-row">
                  <span className="cx-shortcut-sheet-name">{strings[entry.label]}</span>
                  <span data-testid="shortcut-sheet-keys" className="cx-shortcut-sheet-keys">
                    {keyWords(entry).map((word) => (
                      <Kbd key={`${entry.id}:${word}`}>{word}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

export function ShortcutSheet() {
  const palette = useCommandPalette();
  if (palette === null) return null;

  return (
    <Dialog
      open={palette.sheetOpen}
      onOpenChange={(next) => {
        if (!next) palette.closeSheet();
      }}
      // Non-modal for the palette's own reason (I-118): `aria-hidden` over a frame whose links stay
      // focusable is the serious axe finding Q-11 admits none of at a checkpoint.
      modal={false}
    >
      {palette.sheetOpen ? <div className="cx-scrim" aria-hidden="true" /> : null}
      <DialogContent asChild aria-label={strings.shortcut_sheet_label}>
        <div data-testid="shortcut-sheet" className="cx-shortcut-sheet">
          {/* The roster is taller than a short window, so it is bounded here and the Dialog's own
              overflow never engages (I-136, as the palette's list is bounded). A region that scrolls
              is reached by the keyboard as well as by the wheel — the sheet holds nothing focusable
              of its own, so without this a person on a keyboard could not read its last rows (axe
              `scrollable-region-focusable`, R-UI-012) — and where focus lands, the reticle is drawn
              from its one home, in the beam form that home keeps for a box that scrolls (corner
              ticks on a scroll container strand themselves mid-content when it is scrolled). */}
          <div className="cx-shortcut-sheet-scroll cx-reticle cx-reticle-scroll" tabIndex={0}>
            <ShortcutSheetBody />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
