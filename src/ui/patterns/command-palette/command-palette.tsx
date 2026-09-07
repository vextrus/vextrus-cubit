"use client";
/**
 * R-SPINE-050's command palette: a WAI-ARIA combobox over the shipped overlay Dialog, fed a typed
 * command list (docs/design/command-palette.md §1). Pure props — the rows, their availability and
 * what choosing one does are all the caller's, because `src/ui` knows no address (ARCH-01).
 *
 * Everything the tenant cannot reach today is listed with its reason beside it and stays
 * arrow-reachable (I-138): silence never happens, and an empty list says why it is empty
 * (R-UI-020).
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { RefusalCode } from "@/core/errors";
import { Button, Input, Kbd, Skeleton } from "../../primitives/core";
import { Dialog, DialogContent } from "../../primitives/overlay";
import { REFUSAL_ENTRIES } from "../../screen-states/refusal-entries";
import { SHORTCUTS, chordOf } from "../../shell/shortcuts/roster";
import { fill, strings } from "../../strings";
import { RefusalState } from "../refusal-state";

import "./command-palette.css";

/** The codes this surface can answer with, of the register's own closed set (I-142). */
export type PaletteRefusalCode = Extract<RefusalCode, "SIGNED_OUT" | "WORKSPACE_PERMISSION_NOT_HELD">;

/** One row of the list. `available` is read from the caller's own truth, never written beside it. */
export interface CommandItem {
  /** The row's own key inside its group — what the option's id is built from (§1). */
  readonly key: string;
  /** The kind word the first column reads verbatim: project · drawing · sheet · set · area · action · shortcut. */
  readonly kind: string;
  readonly label: string;
  /** The hit's project or drawing, ellipsised — replaced by `reason` on an unavailable row. */
  readonly meta?: string;
  readonly available: boolean;
  /** Why this row cannot be taken today, in the words the string table holds (I-138). */
  readonly reason?: string;
  /** A shortcut row's chord, and the roster id it documents (AC-3). */
  readonly chord?: string;
  readonly shortcutId?: string;
}

/** One group of the list, in the fixed order §1 gives them. */
export interface CommandGroup {
  /** The `data-group` value: recent · navigate · areas · actions · shortcuts. */
  readonly id: string;
  readonly label: string;
  readonly items: readonly CommandItem[];
}

/** What a failed search leaves on the surface (I-143): a report id to quote and a way to try again. */
export interface CommandPaletteFault {
  readonly reportId: string;
  readonly onRetry: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  groups: readonly CommandGroup[];
  status: "idle" | "loading" | "empty" | "refused";
  refusal?: PaletteRefusalCode;
  onSelect: (item: CommandItem) => void;
  /** R-UI-050's error cell, which `status` names no arm for (I-143). */
  fault?: CommandPaletteFault;
  /** Whether the browser says it is offline — the notice, and the navigate group's absence (§2). */
  offline?: boolean;
  /** The footer's own door to the `?` sheet; absent when the caller mounts no sheet. */
  onShortcutSheet?: () => void;
}

/** Where each reachable refusal is resolved (§2) — a refusal always carries its evidence link. */
const EVIDENCE: Readonly<Record<PaletteRefusalCode, { href: string; label: string }>> = {
  SIGNED_OUT: { href: "/sign-in", label: strings.shell_evidence_sign_in },
  WORKSPACE_PERMISSION_NOT_HELD: { href: "/", label: strings.shell_evidence_home },
};

/** The loading block's bones — three rows, so the palette does not resize while an answer arrives. */
const LOADING_ROWS = [0, 1, 2];

/** The roster entry the footer's door to the sheet documents — its words are the roster's (I-147). */
const SHEET_SHORTCUT = SHORTCUTS.find((entry) => entry.action === "open-sheet");

/** That entry's chord, read at draw time so the platform is the reader's own (I-140). */
function sheetChordNow(): string {
  return SHEET_SHORTCUT === undefined ? "" : chordOf(SHEET_SHORTCUT);
}

/** Everything outside an identifier's alphabet folds to a dash, so an id is always a valid one (§1). */
const NOT_IN_AN_ID = /[^A-Za-z0-9_-]/g;

/** One option's id: `cx-palette-option-{group}-{key}`, folded (§1). */
function optionId(group: string, key: string): string {
  return `cx-palette-option-${group}-${key}`.replace(NOT_IN_AN_ID, "-");
}

export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  groups,
  status,
  refusal,
  onSelect,
  fault,
  offline = false,
  onShortcutSheet,
}: CommandPaletteProps) {
  const listId = useId();
  const headingPrefix = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const [active, setActive] = useState(0);

  /** The rows the keyboard walks, across group boundaries, in the order they are painted (§1). */
  const options = useMemo(() => groups.flatMap((group) => group.items.map((item) => ({ group: group.id, item }))), [groups]);

  // A query change re-activates the first option, and so does opening (§1's keyboard). The list is
  // the dependency rather than the query itself: what a person is choosing between is the rows.
  useEffect(() => {
    setActive(0);
  }, [options, open]);

  // Focus lives in the input, so the reticle is drawn there (I-137). Radix focuses the first
  // tabbable on open; this states it, so the combobox is where the first keystroke lands.
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const inPlace = fault !== undefined || status === "loading" || status === "empty" || status === "refused";
  const activeOption = options[active];
  const activeId = !inPlace && activeOption !== undefined ? optionId(activeOption.group, activeOption.item.key) : undefined;

  const choose = useCallback(
    (item: CommandItem): void => {
      // I-138: Enter on an unavailable row navigates nothing, closes nothing and announces nothing
      // new — the reason was already on the row before the press.
      if (!item.available) return;
      onSelect(item);
    },
    [onSelect],
  );

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (options.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((at) => (at + 1) % options.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((at) => (at - 1 + options.length) % options.length);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActive(options.length - 1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const chosen = options[active];
      if (chosen !== undefined) choose(chosen.item);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="command-palette" aria-label={strings.command_palette_label} className="cx-palette">
        <Input
          ref={input}
          data-testid="command-palette-input"
          className="cx-palette-input"
          role="combobox"
          aria-expanded={true}
          // Named only while the list stands: a reference to an id nothing carries names nothing,
          // and a dangling `aria-controls` is a serious finding on a surface Q-11 gates at zero.
          aria-controls={inPlace ? undefined : listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          autoComplete="off"
          aria-label={strings.command_palette_input_label}
          placeholder={strings.command_palette_placeholder}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onKeyDown}
        />

        {offline ? (
          <p role="status" className="cx-palette-notice">
            {strings.command_palette_offline}
          </p>
        ) : null}

        {fault !== undefined ? (
          <FaultCard fault={fault} />
        ) : status === "loading" ? (
          <div className="cx-palette-loading" data-testid="command-palette-loading" aria-busy="true">
            {LOADING_ROWS.map((row) => (
              <div className="cx-palette-loading-row" key={row}>
                <Skeleton className="cx-palette-bone" />
              </div>
            ))}
          </div>
        ) : status === "refused" && refusal !== undefined ? (
          <RefusalCard code={refusal} />
        ) : status === "empty" ? (
          <div className="cx-palette-empty" data-testid="command-palette-empty">
            <p className="cx-palette-empty-line">{fill(strings.command_palette_empty, { query })}</p>
            <Button
              variant="secondary"
              onClick={() => {
                onQueryChange("");
                input.current?.focus();
              }}
            >
              {strings.command_palette_empty_action}
            </Button>
          </div>
        ) : (
          <>
            <div id={listId} data-testid="command-palette-list" role="listbox" aria-label={strings.command_palette_list_label} className="cx-palette-list">
              {groups
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.id} role="group" data-testid="command-palette-group" data-group={group.id} aria-labelledby={`${headingPrefix}-${group.id}`}>
                    <p className="cx-palette-group-label" id={`${headingPrefix}-${group.id}`}>
                      {group.label}
                    </p>
                    {group.items.map((item) => {
                      const id = optionId(group.id, item.key);
                      return (
                        <div
                          key={item.key}
                          id={id}
                          role="option"
                          data-testid="command-palette-item"
                          data-kind={item.kind}
                          data-key={item.key}
                          data-available={item.available ? "true" : "false"}
                          data-shortcut={item.shortcutId}
                          aria-selected={id === activeId}
                          aria-disabled={item.available ? undefined : true}
                          className="cx-palette-item"
                          onMouseMove={() => setActive(options.findIndex((option) => option.group === group.id && option.item.key === item.key))}
                          onClick={() => choose(item)}
                        >
                          <span className="cx-palette-item-kind">{item.kind}</span>
                          <span className="cx-palette-item-label">{item.label}</span>
                          {item.available ? (
                            <span className="cx-palette-item-meta">{item.meta}</span>
                          ) : (
                            <span className="cx-palette-item-meta" data-testid="command-palette-item-reason">
                              {item.reason}
                            </span>
                          )}
                          {item.chord === undefined ? <span /> : <Kbd>{item.chord}</Kbd>}
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>
            {/* A refusal arriving beside rows that stand is the partial state: the hits that were
                answered are shown, and the card sits under them (I-142, R-UI-050). */}
            {refusal === undefined ? null : <RefusalCard code={refusal} />}
          </>
        )}

        <div className="cx-palette-footer">
          <p role="status" aria-live="polite" className="cx-palette-status">
            {statusLine(status, options.length, fault !== undefined)}
          </p>
          {onShortcutSheet === undefined ? null : (
            <Button variant="ghost" className="cx-palette-footer-sheet" onClick={onShortcutSheet}>
              {strings.command_palette_footer_shortcuts}
              {sheetChordNow() === "" ? null : <Kbd>{sheetChordNow()}</Kbd>}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The refusal, through the one renderer every surface uses — this pattern adds no chrome (I-142). */
function RefusalCard({ code }: { code: PaletteRefusalCode }) {
  return (
    <div data-testid="command-palette-refusal">
      <RefusalState refusal={REFUSAL_ENTRIES[code]} evidence={EVIDENCE[code]} />
    </div>
  );
}

/** R-UI-050's error cell: what happened, the id to quote, and the way to try again (I-143). */
function FaultCard({ fault }: { fault: CommandPaletteFault }) {
  return (
    <div role="alert" className="cx-palette-fault">
      <p className="cx-palette-fault-line">{strings.command_palette_error}</p>
      <p className="cx-palette-fault-report">{fill(strings.command_palette_error_report, { id: fault.reportId })}</p>
      <Button variant="ghost" onClick={fault.onRetry}>
        {strings.command_palette_error_retry}
      </Button>
    </div>
  );
}

/** The footer's live line — §3's four sentences, and silence while a fault stands (§1). */
function statusLine(status: CommandPaletteProps["status"], rows: number, faulted: boolean): string {
  if (faulted) return "";
  if (status === "loading") return strings.command_palette_status_searching;
  if (rows === 0) return strings.command_palette_status_none;
  if (rows === 1) return strings.command_palette_status_one;
  return fill(strings.command_palette_status_many, { count: String(rows) });
}
