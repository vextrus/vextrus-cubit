"use client";
/**
 * R-UI-032's `?` sheet: every key this workspace binds, and where each one works
 * (docs/design/shortcut-sheet.md).
 *
 * It documents keys this increment does not bind — the viewer's tools and table navigation belong to
 * the screens that own them (I-148) — because a key the product promises is a key a person will
 * press. Which is why the scope heading is above the row and not a note beside it.
 *
 * Nothing here is a list: the sections are `SHORTCUT_SCOPES` and the rows are `SHORTCUTS` filtered
 * by scope, so a twentieth key joins this sheet by joining the roster and nothing else (B-19).
 */
import { useId } from "react";
import { Kbd } from "../../primitives/core";
import { Sheet, SheetContent } from "../../primitives/overlay";
import { SHORTCUT_SCOPES, chordOf, type Shortcut, type ShortcutScope } from "../../shell/shortcuts/roster";
import { strings } from "../../strings";

export interface ShortcutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The roster to document. Passed in so a gallery entry can mount the sheet as authored data. */
  shortcuts: readonly Shortcut[];
}

/** The heading each scope is read under, from the one table both surfaces read (B-17). */
const SCOPE_HEADING: Readonly<Record<ShortcutScope, string>> = Object.freeze({
  global: strings.shortcut_scope_global,
  viewer: strings.shortcut_scope_viewer,
  table: strings.shortcut_scope_table,
});

export function ShortcutSheet({ open, onOpenChange, shortcuts }: ShortcutSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* `asChild` so the contract's id and the sheet's own accessible name ride on the dialog
          element itself; the primitive keeps its side, its scrim, its portal and its focus trap. */}
      <SheetContent asChild side="right">
        <div className="cx-shortcut-sheet" data-testid="shortcut-sheet" aria-label={strings.shortcut_sheet_label}>
          <h2 className="cx-shortcut-sheet-heading">{strings.shortcut_sheet_heading}</h2>
          <p className="cx-shortcut-sheet-hint">{strings.shortcut_sheet_hint}</p>
          {SHORTCUT_SCOPES.map((scope) => (
            <ScopeSection key={scope} scope={scope} shortcuts={shortcuts.filter((entry) => entry.scope === scope)} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ScopeSection({ scope, shortcuts }: { scope: ShortcutScope; shortcuts: readonly Shortcut[] }) {
  const headingId = useId();
  // A scope the roster names no key for renders nothing: a heading over an empty list would tell a
  // reader the product binds keys there when it binds none (R-UI-020's honesty).
  if (shortcuts.length === 0) return null;
  return (
    <section className="cx-shortcut-scope" data-scope={scope} aria-labelledby={headingId}>
      <h3 className="cx-shortcut-scope-heading" id={headingId}>
        {SCOPE_HEADING[scope]}
      </h3>
      <dl className="cx-shortcut-rows">
        {shortcuts.map((entry) => (
          <div className="cx-shortcut-row" key={entry.id} data-testid="shortcut-sheet-row" data-shortcut={entry.id} data-scope={entry.scope}>
            <dt className="cx-shortcut-row-label">{strings[entry.label]}</dt>
            <dd className="cx-shortcut-row-keys" data-testid="shortcut-sheet-keys">
              <Kbd>{chordOf(entry)}</Kbd>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
