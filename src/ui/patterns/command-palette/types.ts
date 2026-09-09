// What the palette lists, as a type. The pattern never learns what a project or an act IS: the app
// layer hands it rows already carrying their words and their address (ARCH-01), and everything this
// surface decides — is the row reachable, does it answer the query, which group does it stand in —
// is decided from the row alone.
import type { RefusalEntry } from "@/core/errors";
import type { RefusalEvidence } from "../refusal-state";

/** The groups, in the order the list renders them (Decision §1). */
export const PALETTE_GROUPS = ["recent", "navigate", "areas", "actions", "shortcuts"] as const;

export type PaletteGroupId = (typeof PALETTE_GROUPS)[number];

/**
 * One row. A row leads somewhere (`href`) or does something (`run`); a row that does neither is
 * unavailable and carries the `reason` it gives in place (I-138) — availability is READ off the
 * address or the action, never written beside the row, so the day a screen lands the row becomes
 * reachable by gaining an address and nothing else changes.
 */
export interface PaletteRow {
  /** Unique within its group; the option's DOM id is derived from it. */
  readonly key: string;
  readonly group: PaletteGroupId;
  /** The word the option's first column states verbatim: `project`, `area`, `shortcut`, … */
  readonly kind: string;
  readonly label: string;
  /** The second line — the row's project or drawing. */
  readonly meta?: string | null;
  readonly href?: string | null;
  readonly run?: (() => void) | null;
  /** Why this row leads nowhere today, in the product's own words. */
  readonly reason?: string | null;
  /** The roster binding this row stands for, on a shortcuts row. */
  readonly shortcutId?: string | null;
}

/** Can a person reach this row? Read off what it carries, never off a flag (I-138). */
export function isAvailable(row: PaletteRow): boolean {
  return (typeof row.href === "string" && row.href !== "") || typeof row.run === "function";
}

/**
 * Does a row answer what was typed? Case-insensitive, over the words a reader sees — the label and
 * its meta line. The navigate group never passes through this: those rows ARE the seam's answer to
 * the query, and filtering them again client-side would hide rows the server chose to send.
 */
export function matchesQuery(row: PaletteRow, query: string): boolean {
  const asked = query.trim().toLowerCase();
  if (asked === "") return true;
  return `${row.label} ${row.meta ?? ""}`.toLowerCase().includes(asked);
}

/** Everything outside `[A-Za-z0-9_-]`, folded to `-` so an id is one token (Decision §1). */
const NOT_IN_AN_ID = /[^A-Za-z0-9_-]/g;

/** The DOM id an option carries, so `aria-activedescendant` can name it. */
export function optionId(row: PaletteRow): string {
  return `cx-palette-option-${row.group}-${row.key}`.replace(NOT_IN_AN_ID, "-");
}

/**
 * The seam's answer, as the pattern reads it: rows, and at most one registered refusal or one fault
 * id beside them. This is the ONLY carrier — no other refusal shape is recognised, and a rejected
 * promise is a fault (risk note 3).
 */
export interface PaletteAnswer {
  readonly rows: readonly PaletteRow[];
  readonly refusal?: string | null;
  readonly faultId?: string | null;
}

/** A refusal resolved for rendering: the register's own entry, and where it is resolved (I-142). */
export interface PaletteRefusal {
  readonly entry: RefusalEntry;
  readonly evidence: RefusalEvidence;
}

/** What the list is showing where its rows would be (Decision §2; the fault cell is I-143's prop). */
export type PaletteStatus = "idle" | "loading" | "empty" | "refused";

/** A fault, as the list renders one: the id to quote, and the way to ask again (I-143). */
export interface PaletteFault {
  readonly reportId: string;
  readonly onRetry: () => void;
}
