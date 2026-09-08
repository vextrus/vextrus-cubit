/**
 * What the palette is fed and what it hands back (R-SPINE-050). Every address in here was built by
 * the app layer: `src/ui` spells no route (ARCH-01), so a row that leads somewhere arrives already
 * carrying the place it leads to.
 *
 * Availability is read, never written (command-palette I-138): a row is reachable exactly when it
 * carries a destination or an act, and a row that carries neither carries the reason instead. There
 * is no `available` field to set wrongly.
 */
import type { ReactNode } from "react";

/** What the list is doing. The fault is a prop of its own, never a fifth arm (I-143). */
export type PaletteStatus = "idle" | "loading" | "empty" | "refused";

/** The error cell's two facts: the id a person can quote, and the way to ask again (R-UI-050). */
export interface PaletteFault {
  readonly reportId: string;
  readonly onRetry: () => void;
}

/** One row of the list. */
export interface CommandItem {
  /** Unique within its group; the option's id is built from the group and this. */
  readonly key: string;
  /** The word the kind column reads, verbatim — `project`, `area`, `shortcut` … (§ 1). */
  readonly kind: string;
  /** The words a person reads. A hit's label is the workspace's own data, rendered as it stands. */
  readonly label: string;
  /** Where the row's subject lives — its project or its drawing. */
  readonly meta?: string;
  /** The address the app layer built for this row, when the tenant can reach it. */
  readonly href?: string;
  /** What the row does when it does something other than go somewhere. */
  readonly run?: () => void;
  /** Why the tenant cannot reach it today — shown in place of the meta (I-138). */
  readonly reason?: string;
  /** The roster entry a shortcut row documents. */
  readonly shortcut?: string;
  /** The `PROJECT_AREAS` key an area row is for — the machine hook a chord and a journey find it by. */
  readonly area?: string;
  /** The act an action row runs, by its key in `PALETTE_ACTIONS`. */
  readonly action?: string;
  /** The chord a shortcut row's keycap reads, drawn by `chordOf` after the gesture (I-140). */
  readonly chord?: string;
}

/** One labelled section of the list, in the fixed order § 1 gives the groups. */
export interface CommandGroup {
  /** The `data-group` value: `recent` · `navigate` · `areas` · `actions` · `shortcuts`. */
  readonly id: string;
  readonly label: string;
  readonly items: readonly CommandItem[];
}

/** Whether a row leads anywhere at all — the one answer both the row and the keyboard read. */
export function isAvailable(item: CommandItem): boolean {
  return item.href !== undefined || item.run !== undefined;
}

/**
 * Whether a row answers what a person typed. One rule for every group — the workspace's own subjects
 * and the rows this layer builds are found by the same reading, so a project and a shortcut can
 * never be matched by different rules (B-17). A blank query asks for nothing and answers everything:
 * with no query the list is showing what is there, not what was asked for.
 */
export function matchesQuery(label: string, query: string): boolean {
  const asked = query.trim().toLowerCase();
  return asked === "" || label.toLowerCase().includes(asked);
}

/**
 * How many selections this browser remembers per workspace (I-141). One home for the cap, so the
 * store that trims and any surface that counts read the same number (B-17).
 */
export const RECENT_LIMIT = 8;

/** A row a person chose, remembered so a blank query can offer it again (I-141). */
export interface RecentItem {
  readonly key: string;
  readonly kind: string;
  readonly label: string;
  readonly href: string;
  readonly meta?: string;
}

/**
 * Where a `go` chord leads in the context a person pressed it in, or why it leads nowhere. A
 * destination that leads nowhere carries the words its row is named by as well as the reason: the
 * chord opens the palette on that row by asking for it in the query, which is how the row a person
 * pressed for becomes the one standing in front of them (§1's wiring, I-138).
 */
export type PaletteDestination = { readonly href: string } | { readonly reason: string; readonly label: string };

/** What the provider hands the frame around it. */
export interface CommandPaletteContextValue {
  readonly open: boolean;
  readonly openPalette: () => void;
  readonly closePalette: () => void;
  readonly openSheet: () => void;
  /** The trigger registers itself here so closing can hand focus back to it (AC-1). */
  readonly registerTrigger: (element: HTMLButtonElement | null) => void;
  /** The chord the trigger states to the eye, drawn only after a gesture (I-140). */
  readonly paletteChord: string;
}

/** The children a surface wraps — named so the provider's props read as a shape, not a tuple. */
export type PaletteChildren = ReactNode;
