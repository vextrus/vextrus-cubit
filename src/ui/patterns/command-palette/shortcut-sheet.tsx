"use client";
/**
 * R-UI-032's `?` sheet: every key this product promises, and where each one works (docs/design/
 * shortcut-sheet.md §1). It is a document to read, not a set of controls — nothing inside it is
 * focusable, and no row highlights.
 *
 * The rendering IS the derivation (B-19): sections come from `SHORTCUT_SCOPES` and rows from the
 * roster handed in, filtered by scope. Nothing here spells a key, a chord or a label beside the one
 * roster, so a documented key and a bound key cannot differ (I-147).
 */
import { Kbd } from "../../primitives/core";
import { Sheet, SheetContent } from "../../primitives/overlay";
import { SHORTCUT_SCOPES, chordOf, type Shortcut, type ShortcutScope } from "../../shell/shortcuts/roster";
import { strings } from "../../strings";

import "./command-palette.css";

/** What each scope's heading says — the words a reader needs before the key itself (I-146). */
const SCOPE_HEADING: Readonly<Record<ShortcutScope, string>> = {
  global: strings.shortcut_scope_global,
  viewer: strings.shortcut_scope_viewer,
  table: strings.shortcut_scope_table,
};

export interface ShortcutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The roster to document. One row per entry and one entry per row, in its order (AC-3). */
  shortcuts: readonly Shortcut[];
}

export function ShortcutSheet({ open, onOpenChange, shortcuts }: ShortcutSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" data-testid="shortcut-sheet" aria-label={strings.shortcut_sheet_label} className="cx-shortcut-sheet">
        <h2 className="cx-shortcut-sheet-heading">{strings.shortcut_sheet_heading}</h2>
        <p className="cx-shortcut-sheet-hint">{strings.shortcut_sheet_hint}</p>
        {SHORTCUT_SCOPES.map((scope) => {
          const held = shortcuts.filter((entry) => entry.scope === scope);
          if (held.length === 0) return null;
          return (
            <section key={scope} className="cx-shortcut-scope" data-scope={scope} aria-labelledby={`cx-shortcut-scope-${scope}`}>
              <h3 className="cx-shortcut-scope-heading" id={`cx-shortcut-scope-${scope}`}>
                {SCOPE_HEADING[scope]}
              </h3>
              <dl className="cx-shortcut-rows">
                {held.map((entry) => (
                  <div key={entry.id} className="cx-shortcut-row" data-testid="shortcut-sheet-row" data-shortcut={entry.id} data-scope={entry.scope}>
                    <dt className="cx-shortcut-row-label">{strings[entry.label]}</dt>
                    <dd className="cx-shortcut-row-keys" data-testid="shortcut-sheet-keys">
                      <Kbd>{chordOf(entry)}</Kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </SheetContent>
    </Sheet>
  );
}
