"use client";
/**
 * The palette's frame-level half (R-UI-032): open state, the query, recents, and the one global key
 * handler the whole product's keyboard law goes through.
 *
 * The handler reads `SHORTCUTS` and only `SHORTCUTS` (shortcut-sheet I-147), so a key the `?` sheet
 * documents is the key that acts. `Mod+K` and Escape are honoured inside a text field; every other
 * entry is ignored while one has focus, because a person typing a project's name is typing, not
 * navigating.
 *
 * Addresses and transport are the app layer's (ARCH-01): what arrives here is groups already built
 * and a `navigate` that knows how to follow one. What this layer adds is the two groups it can build
 * from what it holds — the recents in this browser's storage (I-141) and the roster's own rows.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RefusalCode } from "@/core/errors";
import { CHORD_TIMEOUT_MS, SHORTCUTS, chordOf, matchStep, type Shortcut } from "../../shell/shortcuts/roster";
import { strings } from "../../strings";
import { CommandPalette } from "./command-palette";
import { ShortcutSheet } from "./shortcut-sheet";
import { matchesQuery } from "./types";
import type { CommandGroup, CommandItem, CommandPaletteContextValue, PaletteChildren, PaletteDestination, PaletteFault, PaletteStatus, RecentItem } from "./types";

/** The roster entry the trigger and the footer state their own key from. */
const PALETTE_ENTRY = "palette";
const SHEET_ENTRY = "shortcut-sheet";

/** The group ids § 1 fixes, in the order the list renders them. */
const RECENT = "recent";
const NAVIGATE = "navigate";
const SHORTCUTS_GROUP = "shortcuts";

/** How many selections this browser remembers per workspace (I-141). */
const RECENT_LIMIT = 8;

/** Where they are remembered — one key per workspace, so two workspaces never share a history. */
const RECENTS_KEY = "cubit.palette.recents.";

/** The elements a key press belongs to rather than to the frame (I-147). */
const TEXT_FIELDS = new Set(["input", "textarea", "select"]);

const PaletteContext = createContext<CommandPaletteContextValue | null>(null);

/**
 * The frame's palette, or null outside one. Null rather than a throw: the trigger is an occupant of
 * a bar that mounts in places the provider does not (jobs-tray I-116), and a bar that threw there
 * would take every bare mount of the frame down with it.
 */
export function useCommandPalette(): CommandPaletteContextValue | null {
  return useContext(PaletteContext);
}

export interface CommandPaletteProviderProps {
  children: PaletteChildren;
  /** The rows the app layer built for the query it was last told about (§ 1's wiring). */
  groups?: readonly CommandGroup[];
  status?: PaletteStatus;
  refusal?: RefusalCode;
  fault?: PaletteFault;
  /** What a person typed, handed to the app layer so it can ask the server. */
  onQueryChange?: (query: string) => void;
  /** Follow an address the app layer built. */
  navigate?: (href: string) => void;
  /** Where a `go` chord's target leads here, or the reason it leads nowhere (I-138, I-139). */
  resolveGo?: (target: string) => PaletteDestination;
  /** Which workspace's recents these are (I-141). */
  tenantId?: string;
}

export function CommandPaletteProvider({
  children,
  groups = [],
  status = "idle",
  refusal,
  fault,
  onQueryChange,
  navigate,
  resolveGo,
  tenantId,
}: CommandPaletteProviderProps) {
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string | undefined>(undefined);
  const [recents, setRecents] = useState<readonly RecentItem[]>([]);
  const held = useRef<readonly RecentItem[]>([]);
  const [offline, setOffline] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  // Whether the surface that is closing should hand focus back to the trigger: it should when a
  // person dismissed it, and must not when the ? sheet is taking the modality from it.
  const restore = useRef(true);

  const registerTrigger = useCallback((element: HTMLButtonElement | null): void => {
    trigger.current = element;
  }, []);

  useEffect(() => {
    const stored = readRecents(tenantId);
    held.current = stored;
    setRecents(stored);
  }, [tenantId]);

  // The connection is read from the browser rather than inferred from a failed request: a request
  // that never left names no cause, and a banner is owed before one is even attempted (§ 2).
  useEffect(() => {
    const read = (): void => setOffline(typeof navigator === "undefined" ? false : navigator.onLine === false);
    read();
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);

  const openPalette = useCallback((row?: string): void => {
    setActiveKey(row);
    setSheetOpen(false);
    restore.current = true;
    setOpen(true);
  }, []);

  const askQuery = useCallback(
    (asked: string): void => {
      setQuery(asked);
      setActiveKey(undefined);
      onQueryChange?.(asked);
    },
    [onQueryChange],
  );

  // A closed palette holds no question. Reopening on the last search would answer a person with rows
  // for words they typed a screen ago and hide the recents a blank query exists to offer (I-141).
  const forgetQuery = useCallback((): void => {
    askQuery("");
  }, [askQuery]);

  const closePalette = useCallback((): void => {
    setOpen(false);
    forgetQuery();
  }, [forgetQuery]);

  const openSheet = useCallback((): void => {
    // One modal surface at a time (shortcut-sheet I-145): the palette gives up the modality, and it
    // does not take focus back on the way out — the sheet is where a person is going.
    restore.current = false;
    setOpen(false);
    forgetQuery();
    setSheetOpen(true);
  }, [forgetQuery]);

  const remember = useCallback(
    (item: CommandItem): void => {
      const href = item.href;
      if (href === undefined) return;
      const row: RecentItem = { key: item.key, kind: item.kind, label: item.label, href, ...(item.meta === undefined ? {} : { meta: item.meta }) };
      const kept = writeRecents(tenantId, [row, ...held.current]);
      held.current = kept;
      setRecents(kept);
    },
    [tenantId],
  );

  const choose = useCallback(
    (item: CommandItem): void => {
      remember(item);
      setOpen(false);
      forgetQuery();
      if (item.href !== undefined) navigate?.(item.href);
      else item.run?.();
    },
    [forgetQuery, navigate, remember],
  );

  /** What a roster entry does when its chord completes, or when its row is chosen. */
  const act = useCallback(
    (entry: Shortcut): void => {
      if (entry.action === "open-palette") {
        openPalette();
        return;
      }
      if (entry.action === "open-sheet") {
        openSheet();
        return;
      }
      const where = destinationOf(entry, resolveGo);
      if ("href" in where) {
        setOpen(false);
        navigate?.(where.href);
        return;
      }
      // A key whose destination this workspace has no screen for opens the palette on that very row,
      // with the reason showing: the answer is shown in place, never swallowed (I-138, R-UI-020).
      openPalette(entry.id);
    },
    [navigate, openPalette, openSheet, resolveGo],
  );

  // The one global handler. Held in a ref so the listener is attached once and still reads the
  // freshest state — a handler re-attached on every keystroke would drop a chord mid-sequence.
  const pending = useRef<{ candidates: readonly Shortcut[]; depth: number; at: number }>({ candidates: [], depth: 0, at: 0 });
  const onKey = useRef<(event: KeyboardEvent) => void>(() => undefined);
  onKey.current = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    const globals = SHORTCUTS.filter((entry) => entry.scope === "global");
    const typing = inTextField(event.target);

    const step = (candidates: readonly Shortcut[], depth: number): Shortcut[] =>
      candidates.filter((entry) => entry.keys.length > depth && matchStep(event, entry.keys[depth] as string) && (!typing || isFieldSafe(entry)));

    const now = Date.now();
    const fresh = pending.current.depth > 0 && now - pending.current.at <= CHORD_TIMEOUT_MS;
    let depth = fresh ? pending.current.depth : 0;
    let matched = step(fresh ? pending.current.candidates : globals, depth);
    if (matched.length === 0 && depth > 0) {
      depth = 0;
      matched = step(globals, 0);
    }
    if (matched.length === 0) {
      pending.current = { candidates: [], depth: 0, at: 0 };
      return;
    }

    const done = matched.find((entry) => entry.keys.length === depth + 1);
    if (done !== undefined) {
      pending.current = { candidates: [], depth: 0, at: 0 };
      event.preventDefault();
      act(done);
      return;
    }
    pending.current = { candidates: matched, depth: depth + 1, at: now };
    event.preventDefault();
  };

  useEffect(() => {
    const listener = (event: KeyboardEvent): void => onKey.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const paletteChord = chordOf({ keys: entryOf(PALETTE_ENTRY).keys });
  const sheetChord = chordOf({ keys: entryOf(SHEET_ENTRY).keys });

  const context = useMemo<CommandPaletteContextValue>(
    () => ({ open, openPalette: () => openPalette(), closePalette, openSheet, registerTrigger, paletteChord }),
    [open, openPalette, closePalette, openSheet, registerTrigger, paletteChord],
  );

  // Recents answer a blank query only: with a query typed the list is answering the query (I-141).
  // Offline, the navigate group is absent — search needs the server — while everything local stands.
  // A group left with no rows does not render, which is what lets a query nothing matches reach the
  // empty state rather than standing beside four groups that answered nothing (§ 1, § 2).
  const rows = SHORTCUTS.map((entry) => shortcutItem(entry, resolveGo, act)).filter((item) => matchesQuery(item.label, query));
  const shown: CommandGroup[] = [
    ...(query.trim() === "" && recents.length > 0 ? [{ id: RECENT, label: strings.command_palette_group_recent, items: recents.map(recentItem) }] : []),
    ...groups.filter((group) => !(offline && group.id === NAVIGATE)),
    ...(rows.length === 0 ? [] : [{ id: SHORTCUTS_GROUP, label: strings.command_palette_group_shortcuts, items: rows }]),
  ].filter((group) => group.items.length > 0);

  return (
    <PaletteContext.Provider value={context}>
      {children}
      <CommandPalette
        open={open}
        onOpenChange={(next) => {
          if (next) return;
          setOpen(false);
          forgetQuery();
        }}
        query={query}
        onQueryChange={askQuery}
        groups={shown}
        status={status}
        refusal={refusal}
        fault={fault}
        onSelect={choose}
        offline={offline}
        activeKey={activeKey}
        onRestoreFocus={() => {
          if (restore.current) trigger.current?.focus();
          restore.current = true;
        }}
        onOpenShortcutSheet={openSheet}
        shortcutSheetChord={sheetChord}
      />
      <ShortcutSheet open={sheetOpen} onOpenChange={setSheetOpen} shortcuts={SHORTCUTS} />
    </PaletteContext.Provider>
  );
}

/** One roster entry by id. The roster is frozen in the bundle, so a missing id is a build error. */
function entryOf(id: string): Shortcut {
  const found = SHORTCUTS.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`the shortcut roster names no \`${id}\` entry`);
  return found;
}

/** The two entries a text field still answers: opening the palette, and leaving it (I-147). */
function isFieldSafe(entry: Shortcut): boolean {
  return entry.action === "open-palette";
}

/** Whether the press belongs to something a person is typing into. */
function inTextField(target: EventTarget | null): boolean {
  if (target === null || !(target instanceof Element)) return false;
  if (TEXT_FIELDS.has(target.tagName.toLowerCase())) return true;
  return target.closest("[contenteditable]:not([contenteditable='false'])") !== null;
}

/** Where a roster entry leads, and why it leads nowhere when it does not (I-138, I-148). */
function destinationOf(entry: Shortcut, resolveGo: ((target: string) => PaletteDestination) | undefined): PaletteDestination {
  if (entry.scope === "viewer") return { reason: strings.command_palette_reason_scope_viewer };
  if (entry.scope === "table") return { reason: strings.command_palette_reason_scope_table };
  if (entry.action === "go") {
    if (entry.target === undefined || resolveGo === undefined) return { reason: strings.command_palette_reason_area_unbuilt };
    return resolveGo(entry.target);
  }
  return { reason: strings.command_palette_reason_already_open };
}

/** One roster entry as a row of the palette's shortcuts group (AC-3). */
function shortcutItem(entry: Shortcut, resolveGo: ((target: string) => PaletteDestination) | undefined, act: (entry: Shortcut) => void): CommandItem {
  const where = destinationOf(entry, resolveGo);
  const reachable = "href" in where || entry.action === "open-sheet";
  return {
    key: entry.id,
    kind: "shortcut",
    label: strings[entry.label],
    shortcut: entry.id,
    chord: chordOf(entry),
    ...(reachable ? { run: () => act(entry) } : { reason: "reason" in where ? where.reason : strings.command_palette_reason_area_unbuilt }),
  };
}

/** One remembered selection as a row again — it kept the address it was chosen by (I-141). */
function recentItem(item: RecentItem): CommandItem {
  return { key: item.key, kind: item.kind, label: item.label, href: item.href, ...(item.meta === undefined ? {} : { meta: item.meta }) };
}

/**
 * This browser's recents for a workspace. Storage that throws or is unavailable simply yields none:
 * a history is a convenience, and a private-mode browser is not a fault and not a refusal (I-141).
 */
function readRecents(tenantId: string | undefined): readonly RecentItem[] {
  if (tenantId === undefined || typeof window === "undefined") return [];
  try {
    const held: unknown = JSON.parse(window.localStorage.getItem(`${RECENTS_KEY}${tenantId}`) ?? "[]");
    if (!Array.isArray(held)) return [];
    return held.filter(isRecent).slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

/** The newest first, deduplicated by the address they lead to, capped (I-141). */
function writeRecents(tenantId: string | undefined, held: readonly RecentItem[]): readonly RecentItem[] {
  const seen = new Set<string>();
  const kept = held.filter((item) => (seen.has(item.href) ? false : (seen.add(item.href), true))).slice(0, RECENT_LIMIT);
  if (tenantId !== undefined && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`${RECENTS_KEY}${tenantId}`, JSON.stringify(kept));
    } catch {
      // Storage that will not take a write loses nothing a person can miss: the list they just acted
      // from is still on screen, and the next visit simply offers no history (I-141).
    }
  }
  return kept;
}

/** A stored row is trusted only as far as its shape: anything else in that slot is not a recent. */
function isRecent(value: unknown): value is RecentItem {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row["key"] === "string" && typeof row["kind"] === "string" && typeof row["label"] === "string" && typeof row["href"] === "string";
}
