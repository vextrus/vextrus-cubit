"use client";
// Everything the palette shows below its input, as a function of what it was handed: the offline
// notice, the list or the one cell standing in the list's place, and the footer. It holds no state
// of its own, which is what lets `COMMAND_PALETTE_STATES` mount every R-UI-050 cell of it directly
// (B-19) — the declaration and the running palette render the same component, never two.
import type { RefusalEntry } from "@/core/errors";
import { Button, Kbd, Skeleton } from "../../primitives/core";
import { REFUSAL_ENTRIES } from "../../screen-states/refusal-entries";
import { chordOf, shortcutById } from "../../shell/shortcuts/roster";
import { fill, strings, type StringKey } from "../../strings";
import { RefusalState } from "../refusal-state";
import { isAvailable, optionId, type PaletteFault, type PaletteGroupId, type PaletteRefusal, type PaletteRow, type PaletteStatus } from "./types";

/** One group of the list: the rows it holds, under the words that name it. */
export interface PaletteGroup {
  readonly id: PaletteGroupId;
  readonly rows: readonly PaletteRow[];
}

export interface PaletteBodyProps {
  /** The listbox's own id, which the combobox above names in `aria-controls`. */
  listId: string;
  status: PaletteStatus;
  groups: readonly PaletteGroup[];
  /** The active option's DOM id, or null while no option is active. */
  activeId?: string | null;
  query?: string;
  /** A refusal beside rows is the partial state: the card stands under them (I-142). */
  refusal?: PaletteRefusal | null;
  /** The error cell, which outranks `status` (I-143). */
  fault?: PaletteFault | null;
  offline?: boolean;
  onClear?: () => void;
  onChoose?: (row: PaletteRow) => void;
  onHover?: (row: PaletteRow) => void;
  /** The footer control, which is the roster's own `shortcut-sheet` binding pressed by hand. */
  onShortcuts?: () => void;
}

/** What a group is called (R-SPINE-060) — one key per group id, so a new group owes its line. */
const GROUP_LABEL: Readonly<Record<PaletteGroupId, StringKey>> = {
  recent: "command_palette_group_recent",
  navigate: "command_palette_group_navigate",
  areas: "command_palette_group_areas",
  actions: "command_palette_group_actions",
  shortcuts: "command_palette_group_shortcuts",
};

/** The three bones the wait keeps the list's height with (Decision §2). Never a spinner. */
const WAIT_BONES = ["a", "b", "c"];

/** Where a refusal of this surface is resolved, for the codes that resolve somewhere of their own. */
const EVIDENCE: Readonly<Record<string, { href: string; label: string }>> = {
  SIGNED_OUT: { href: "/sign-in", label: strings.shell_evidence_sign_in },
};

/**
 * Where every other registered refusal is resolved: the workspace a person came from. R-UI-020 makes
 * the evidence link part of the answer rather than a per-code luxury, so the register decides WHAT is
 * said and this decides only where the reader is sent when the code names nowhere better (I-142).
 */
const EVIDENCE_ELSEWHERE = { href: "/", label: strings.shell_evidence_home };

/**
 * The registered refusal a code names, with the evidence link that resolves it — or null for a word
 * no entry answers. ARCH-01 keeps `src/core`'s register out of this layer, so the entry is read from
 * the ui-side register the screens share (B-17); the card is offered to every code that register
 * holds, never to a hand-picked pair, so a door that grows a second registered answer renders it on
 * the day it arrives. A code the register does not hold is not a refusal — the caller answers that
 * as the fault it is, because inventing a card would put a sentence in a person's mouth the taxonomy
 * never wrote and showing nothing would be the silence R-UI-020 forbids.
 */
export function paletteRefusalOf(code: string | null | undefined): PaletteRefusal | null {
  if (typeof code !== "string" || code === "") return null;
  const registered: Readonly<Record<string, RefusalEntry>> = REFUSAL_ENTRIES;
  const entry = registered[code];
  if (entry === undefined) return null;
  return { entry, evidence: EVIDENCE[code] ?? EVIDENCE_ELSEWHERE };
}

/** Which single cell stands where the list would (Decision §2) — the list itself being one of them. */
export type PaletteCell = "fault" | "refusal" | "loading" | "empty" | "list";

/**
 * Which cell the body renders, decided once (B-17). The combobox above reads this too: it may only
 * claim `aria-expanded` and name a listbox in `aria-controls` while the listbox is actually in the
 * document, and a second reading of the rule here would let the claim and the DOM drift apart.
 */
export function paletteCell({
  status,
  groups,
  refusal = null,
  fault = null,
}: {
  status: PaletteStatus;
  groups: readonly PaletteGroup[];
  refusal?: PaletteRefusal | null;
  fault?: PaletteFault | null;
}): PaletteCell {
  if (fault !== null) return "fault";
  // A refusal that arrived beside rows is the partial state — the answered rows stand and the card
  // sits under them (R-UI-050: shown, not hidden). With no rows it stands in their place (I-142).
  if (refusal !== null && groups.reduce((total, group) => total + group.rows.length, 0) === 0) return "refusal";
  if (status === "loading") return "loading";
  if (status === "empty") return "empty";
  return "list";
}

/** The footer's status line: what the list is saying about itself, in one sentence (Decision §3). */
function statusLine(status: PaletteStatus, rows: number): string {
  if (status === "loading") return strings.command_palette_status_searching;
  if (rows === 0) return strings.command_palette_status_none;
  if (rows === 1) return strings.command_palette_status_one;
  return fill(strings.command_palette_status_many, { count: String(rows) });
}

export function PaletteBody({
  listId,
  status,
  groups,
  activeId = null,
  query = "",
  refusal = null,
  fault = null,
  offline = false,
  onClear,
  onChoose,
  onHover,
  onShortcuts,
}: PaletteBodyProps) {
  const rows = groups.reduce((total, group) => total + group.rows.length, 0);
  const cell = paletteCell({ status, groups, refusal, fault });

  return (
    <>
      {offline ? (
        <p role="status" className="cx-palette-notice">
          {strings.command_palette_offline}
        </p>
      ) : null}

      {cell === "fault" && fault !== null ? (
        <div role="alert" className="cx-palette-fault">
          <p className="cx-palette-fault-line">{strings.command_palette_error}</p>
          {fault.reportId === "" ? null : <p className="cx-palette-fault-id">{fill(strings.command_palette_error_report, { id: fault.reportId })}</p>}
          <Button variant="ghost" onClick={fault.onRetry}>
            {strings.command_palette_error_retry}
          </Button>
        </div>
      ) : cell === "refusal" && refusal !== null ? (
        <div data-testid="command-palette-refusal" data-code={refusal.entry.code} className="cx-palette-refusal">
          <RefusalState refusal={refusal.entry} evidence={refusal.evidence} />
        </div>
      ) : cell === "loading" ? (
        <div data-testid="command-palette-loading" aria-busy="true" className="cx-palette-wait">
          {WAIT_BONES.map((bone) => (
            <div key={bone} className="cx-palette-wait-row">
              <Skeleton className="cx-palette-bone" />
            </div>
          ))}
        </div>
      ) : cell === "empty" ? (
        <div data-testid="command-palette-empty" className="cx-palette-empty">
          <p className="cx-palette-empty-line">{fill(strings.command_palette_empty, { query })}</p>
          <Button variant="secondary" onClick={onClear}>
            {strings.command_palette_empty_action}
          </Button>
        </div>
      ) : (
        <>
          <div id={listId} data-testid="command-palette-list" role="listbox" aria-label={strings.command_palette_list_label} className="cx-palette-list">
            {groups.map((group) => (
              <Group key={group.id} group={group} activeId={activeId} onChoose={onChoose} onHover={onHover} />
            ))}
          </div>
          {refusal === null ? null : (
            <div data-testid="command-palette-refusal" data-code={refusal.entry.code} className="cx-palette-refusal">
              <RefusalState refusal={refusal.entry} evidence={refusal.evidence} />
            </div>
          )}
        </>
      )}

      <div className="cx-palette-footer">
        {/* Always mounted, so an answer that changes the count is announced rather than appearing
            in a region that was not there to be watched (R-UI-012). */}
        <p role="status" aria-live="polite" className="cx-palette-status">
          {fault === null ? statusLine(status, rows) : ""}
        </p>
        <Button variant="ghost" className="cx-palette-footer-shortcuts" onClick={onShortcuts}>
          {strings.command_palette_footer_shortcuts}
          <Kbd>{chordOf(shortcutById("shortcut-sheet"))}</Kbd>
        </Button>
      </div>
    </>
  );
}

function Group({
  group,
  activeId,
  onChoose,
  onHover,
}: {
  group: PaletteGroup;
  activeId: string | null;
  onChoose?: (row: PaletteRow) => void;
  onHover?: (row: PaletteRow) => void;
}) {
  const labelId = `cx-palette-group-${group.id}`;
  return (
    <div role="group" data-testid="command-palette-group" data-group={group.id} aria-labelledby={labelId} className="cx-palette-group">
      <p id={labelId} className="cx-palette-group-label">
        {strings[GROUP_LABEL[group.id]]}
      </p>
      {group.rows.map((row) => (
        <Option key={row.key} row={row} active={optionId(row) === activeId} onChoose={onChoose} onHover={onHover} />
      ))}
    </div>
  );
}

function Option({
  row,
  active,
  onChoose,
  onHover,
}: {
  row: PaletteRow;
  active: boolean;
  onChoose?: (row: PaletteRow) => void;
  onHover?: (row: PaletteRow) => void;
}) {
  const available = isAvailable(row);
  return (
    // Options are never tab stops: WAI-ARIA keeps DOM focus in the combobox and moves the active
    // option with `aria-activedescendant` (I-137), so a row is reached by the arrows and by the
    // pointer — and an unavailable row is reachable too, because its reason is what it is there
    // to say (I-138).
    <div
      role="option"
      id={optionId(row)}
      data-testid="command-palette-item"
      data-kind={row.kind}
      data-available={available ? "true" : "false"}
      data-shortcut={row.shortcutId ?? undefined}
      aria-selected={active}
      aria-disabled={available ? undefined : true}
      className="cx-palette-item"
      onMouseEnter={() => onHover?.(row)}
      onClick={() => onChoose?.(row)}
    >
      <span className="cx-palette-item-kind">{row.kind}</span>
      <span className="cx-palette-item-label">{row.label}</span>
      {available ? (
        <span className="cx-palette-item-meta">{row.meta ?? ""}</span>
      ) : (
        <span data-testid="command-palette-item-reason" className="cx-palette-item-reason">
          {row.reason ?? ""}
        </span>
      )}
      {typeof row.shortcutId === "string" ? <Kbd>{chordOf(shortcutById(row.shortcutId))}</Kbd> : <span className="cx-palette-item-keys" />}
    </div>
  );
}
