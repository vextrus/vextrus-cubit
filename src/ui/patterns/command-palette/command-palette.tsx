"use client";
/**
 * R-SPINE-050's palette: one dialog over the signed-in frame that finds anything the workspace holds
 * and runs what it can run, driven from the keyboard first (R-UI-032).
 *
 * There is no cmdk here and no second modality: the surface is the shipped overlay Dialog with a
 * hand-rolled WAI-ARIA combobox inside it (I-136), so the focus, the scrim, the portal and the
 * entrance are the primitive's own. Focus stays in the text field and `aria-activedescendant` moves
 * (I-137) — an option never holds focus, so the reticle is drawn where focus actually is.
 *
 * Pure props: the rows, their addresses and what choosing one does are all the caller's. A row that
 * the tenant cannot reach today is listed with its reason beside it rather than hidden or disabled
 * (I-138, R-UI-020: silence never happens).
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { RefusalCode, RefusalEntry } from "@/core/errors";
import { Button, Input, Kbd, Skeleton } from "../../primitives/core";
import { Dialog, DialogContent } from "../../primitives/overlay";
import { REFUSAL_ENTRIES } from "../../screen-states/refusal-entries";
import { fill, strings } from "../../strings";
import { RefusalState, type RefusalEvidence } from "../refusal-state";
import { isAvailable, type CommandGroup, type CommandItem, type PaletteFault, type PaletteStatus } from "./types";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  groups: readonly CommandGroup[];
  status: PaletteStatus;
  /** The code a refused read carried; resolved through the ui-side register (I-142). */
  refusal?: RefusalCode;
  /** R-UI-050's error cell, which `status` deliberately does not name (I-143). */
  fault?: PaletteFault;
  onSelect: (item: CommandItem) => void;
  /** Whether this browser has a connection; the offline notice and the read-only list (§ 2). */
  offline?: boolean;
  /** Where focus belongs once the dialog closes — the trigger it came from (AC-1). */
  onRestoreFocus?: () => void;
  /** The footer's way into the `?` sheet, which closes this surface as it opens that one. */
  onOpenShortcutSheet?: () => void;
  /** The chord the footer's keycap reads, drawn by the caller's roster (I-140). */
  shortcutSheetChord?: string;
}

/** How many bones the loading list holds, so the palette does not resize while an answer arrives. */
const LOADING_ROWS = [0, 1, 2];

/** Everything outside this is folded to a dash, so an option id is one token (§ 1). */
const NOT_ID_SAFE = /[^A-Za-z0-9_-]/g;

/** The evidence each reachable refusal resolves at, in the register's own voice (I-142). */
const EVIDENCE: Readonly<Record<string, RefusalEvidence>> = Object.freeze({
  SIGNED_OUT: Object.freeze({ href: "/sign-in", label: strings.shell_evidence_sign_in }),
});

/** Where a refusal that names no door of its own is resolved: the place every session can reach. */
const HOME_EVIDENCE: RefusalEvidence = Object.freeze({ href: "/", label: strings.shell_evidence_home });

/** The registered entry a code stands for, or null when this layer's register does not hold it. */
function entryOf(code: RefusalCode | undefined): RefusalEntry | null {
  if (code === undefined) return null;
  const held = REFUSAL_ENTRIES as Readonly<Record<string, RefusalEntry | undefined>>;
  return held[code] ?? null;
}

export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  groups,
  status,
  refusal,
  fault,
  onSelect,
  offline = false,
  onRestoreFocus,
  onOpenShortcutSheet,
  shortcutSheetChord,
}: CommandPaletteProps) {
  const listId = useId();
  const noticeId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // One flat reading of the rows, in the order a person arrows through them: the groups are the
  // sections, and the keyboard crosses their boundaries as if they were not there (§ 1).
  const options = useMemo(
    () => groups.flatMap((group) => group.items.map((item) => ({ group: group.id, item, id: optionId(group.id, item.key) }))),
    [groups],
  );

  const [active, setActive] = useState(0);

  // A new answer re-activates the first row: the row a person was on may not exist any more, and an
  // index kept across a query change would leave the highlight on a different thing than before.
  // The rows are compared by what they ARE, not by the array that carried them — a caller rebuilding
  // its groups on every render would otherwise reset the highlight under a person's arrow keys.
  const signature = useMemo(() => options.map((option) => option.id).join("|"), [options]);
  const held = useRef(options);
  held.current = options;
  useEffect(() => {
    setActive(0);
  }, [signature]);

  const entry = entryOf(refusal);
  const rowsStand = options.length > 0;
  // Whether the listbox is what stands in the list's place right now. Loading, the fault card, the
  // refusal card and the empty block each replace it, and every id reference the combobox makes has
  // to name an element that is actually in the document (R-UI-012, Q-11).
  const listStands = fault === undefined && status !== "loading" && rowsStand;
  // A refusal beside rows is the partial state: what was answered stands, and the card sits under it
  // rather than in its place (I-142, R-UI-050 — shown, not hidden).
  const card =
    entry === null ? null : (
      <div className="cx-palette-refusal" data-testid="command-palette-refusal">
        <RefusalState refusal={entry} evidence={EVIDENCE[entry.code] ?? HOME_EVIDENCE} />
      </div>
    );

  const activeOption = options[active];
  const move = (delta: number): void => {
    if (options.length === 0) return;
    setActive((current) => (current + delta + options.length) % options.length);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActive(Math.max(0, options.length - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      // An unavailable row announces nothing new: the reason was already on it before the press
      // (I-138), so the palette neither navigates nor closes nor says anything a second time.
      if (activeOption !== undefined && isAvailable(activeOption.item)) onSelect(activeOption.item);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `asChild` so the contract's own id and label ride on the dialog element itself rather than
          on a second box inside it — the primitive keeps its role, its modality and its portal. */}
      <DialogContent
        asChild
        onOpenAutoFocus={(event: Event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
        onCloseAutoFocus={(event: Event) => {
          event.preventDefault();
          onRestoreFocus?.();
        }}
      >
        <div className="cx-palette" data-testid="command-palette" aria-label={strings.command_palette_label}>
          <Input
            ref={inputRef}
            className="cx-palette-input"
            data-testid="command-palette-input"
            role="combobox"
            aria-expanded={true}
            // Named only while the listbox stands: loading, empty, refused and faulted each replace
            // the list in place, and a reference to an id that is not in the document is a dangling
            // one — the serious `aria-valid-attr-value` finding Q-11 gates at zero (R-UI-012).
            aria-controls={listStands ? listId : undefined}
            aria-activedescendant={listStands ? activeOption?.id : undefined}
            aria-autocomplete="list"
            aria-label={strings.command_palette_input_label}
            autoComplete="off"
            placeholder={strings.command_palette_placeholder}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onKeyDown}
          />

          {offline ? (
            <p className="cx-palette-notice" id={noticeId} role="status">
              {strings.command_palette_offline}
            </p>
          ) : null}

          {fault !== undefined ? (
            <div className="cx-palette-fault" role="alert">
              <p className="cx-palette-fault-line">{strings.command_palette_error}</p>
              <p className="cx-palette-fault-report">{fill(strings.command_palette_error_report, { id: fault.reportId })}</p>
              <Button variant="ghost" onClick={fault.onRetry}>
                {strings.command_palette_error_retry}
              </Button>
            </div>
          ) : status === "loading" ? (
            <div className="cx-palette-loading" data-testid="command-palette-loading" aria-busy="true">
              {LOADING_ROWS.map((row) => (
                <div className="cx-palette-loading-row" key={row}>
                  <Skeleton className="cx-palette-bone" />
                </div>
              ))}
            </div>
          ) : !rowsStand && entry !== null ? (
            card
          ) : !rowsStand ? (
            <div className="cx-palette-empty" data-testid="command-palette-empty">
              <p className="cx-palette-empty-line">{fill(strings.command_palette_empty, { query })}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  onQueryChange("");
                  inputRef.current?.focus();
                }}
              >
                {strings.command_palette_empty_action}
              </Button>
            </div>
          ) : (
            <>
              <div className="cx-palette-list" id={listId} data-testid="command-palette-list" role="listbox" aria-label={strings.command_palette_list_label}>
                {groups.map((group) => (
                  <PaletteGroup
                    key={group.id}
                    group={group}
                    activeId={activeOption?.id}
                    onActivate={(index) => setActive(index)}
                    indexOf={(item) => options.findIndex((option) => option.group === group.id && option.item.key === item.key)}
                    onSelect={onSelect}
                  />
                ))}
              </div>
              {card}
            </>
          )}

          <div className="cx-palette-footer">
            <p className="cx-palette-status" role="status" aria-live="polite">
              {statusLine(status, options.length, fault !== undefined)}
            </p>
            <Button variant="ghost" className="cx-palette-footer-sheet" onClick={onOpenShortcutSheet}>
              {strings.command_palette_footer_shortcuts}
              {shortcutSheetChord === undefined ? null : <Kbd>{shortcutSheetChord}</Kbd>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The sentence the footer's live region reads — one of § 3's four, and nothing while a fault stands. */
function statusLine(status: PaletteStatus, rows: number, faulted: boolean): string {
  if (faulted) return "";
  if (status === "loading") return strings.command_palette_status_searching;
  if (rows === 0) return strings.command_palette_status_none;
  if (rows === 1) return strings.command_palette_status_one;
  return fill(strings.command_palette_status_many, { count: String(rows) });
}

/** One option's id, folded to a single token so `aria-activedescendant` can name it (§ 1). */
function optionId(group: string, key: string): string {
  return `cx-palette-option-${group}-${key}`.replace(NOT_ID_SAFE, "-");
}

interface PaletteGroupProps {
  group: CommandGroup;
  activeId: string | undefined;
  indexOf: (item: CommandItem) => number;
  onActivate: (index: number) => void;
  onSelect: (item: CommandItem) => void;
}

function PaletteGroup({ group, activeId, indexOf, onActivate, onSelect }: PaletteGroupProps) {
  const labelId = useId();
  return (
    <div className="cx-palette-group" data-testid="command-palette-group" data-group={group.id} role="group" aria-labelledby={labelId}>
      <p className="cx-palette-group-label" id={labelId}>
        {group.label}
      </p>
      {group.items.map((item) => {
        const id = optionId(group.id, item.key);
        const available = isAvailable(item);
        return (
          <div
            key={item.key}
            id={id}
            className="cx-palette-item"
            data-testid="command-palette-item"
            data-kind={item.kind}
            data-available={available ? "true" : "false"}
            data-shortcut={item.shortcut}
            data-area={item.area}
            data-action={item.action}
            role="option"
            aria-selected={activeId === id}
            aria-disabled={available ? undefined : true}
            // The pointer and the keyboard share one active option, so a mouse hover and an arrow
            // press cannot leave two rows looking chosen (§ 1).
            onMouseMove={() => onActivate(indexOf(item))}
            onClick={() => {
              onActivate(indexOf(item));
              if (available) onSelect(item);
            }}
          >
            <span className="cx-palette-item-kind">{item.kind}</span>
            <span className="cx-palette-item-label">{item.label}</span>
            {available ? (
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
  );
}
