"use client";
// R-SPINE-050 / R-UI-032: the palette's state, and the one global key handler the product has. The
// provider owns whether the palette stands, what has been typed into it, which row is active, what
// the workspace answered, the chord buffer and this browser's recents; the app layer above it owns
// addresses and transport (ARCH-01), and the surfaces below it only render what is here.
//
// The handler reads `SHORTCUTS` and only `SHORTCUTS` (B-17): a binding exists because the roster
// names it, so the keys the ? sheet documents and the keys this listener arms cannot drift apart.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CHORD_TIMEOUT_MS, SHORTCUTS, isTextField, matchesStep, shortcutById } from "../../shell/shortcuts/roster";
import { strings } from "../../strings";
import { paletteRefusalOf, type PaletteGroup } from "./palette-body";
import { readRecents, rememberRecent } from "./recents";
import { isAvailable, matchesQuery, optionId, type PaletteAnswer, type PaletteFault, type PaletteRefusal, type PaletteRow, type PaletteStatus } from "./types";

/**
 * How long the palette waits for typing to settle before it asks the workspace. Short enough that
 * an answer feels like the keystroke's own, long enough that a name typed at speed is one question
 * and not eight (R-UI-004's "an answer arrives as fast as a success would").
 */
const SETTLE_MS = 90;

/** What every surface of the palette reads. `null` outside a provider — see `useCommandPalette`. */
export interface CommandPaletteValue {
  readonly open: boolean;
  readonly sheetOpen: boolean;
  readonly query: string;
  readonly status: PaletteStatus;
  readonly groups: readonly PaletteGroup[];
  readonly activeId: string | null;
  readonly refusal: PaletteRefusal | null;
  readonly fault: PaletteFault | null;
  readonly offline: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  openSheet: () => void;
  closeSheet: () => void;
  ask: (query: string) => void;
  clear: () => void;
  choose: (row: PaletteRow) => void;
  hover: (row: PaletteRow) => void;
  move: (delta: number) => void;
  jump: (to: "first" | "last") => void;
  activate: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteValue | null>(null);

/**
 * The palette a surface stands in, or null where there is none. Null rather than a throw: the top
 * bar's trigger renders nothing outside a provider (I-135), exactly as the jobs tray does, so a bare
 * `ShellTopBar` mount stands as it always has.
 */
export function useCommandPalette(): CommandPaletteValue | null {
  return useContext(CommandPaletteContext);
}

export interface CommandPaletteProviderProps {
  tenantId: string;
  /** The project the palette stands inside, or null for a workspace-level address. */
  projectId: string | null;
  /** The rows that stand without a query — the project's areas and the actions roster. */
  rows?: readonly PaletteRow[];
  /** The workspace, asked. The app layer has already turned the seam's hits into rows. */
  search: (query: string) => Promise<PaletteAnswer>;
  navigate: (href: string) => void;
  /** Where a go-to binding leads today, as a row: available, or carrying the reason it is not. */
  goRow?: (shortcutId: string) => PaletteRow | null;
  children?: ReactNode;
}

/** The fault id a rejection carries, or "" for a rejection that named none (ARCH-03). */
function faultIdOf(thrown: unknown): string {
  if (typeof thrown !== "object" || thrown === null) return "";
  const own = (thrown as { faultId?: unknown }).faultId;
  if (typeof own === "string") return own;
  const data = (thrown as { data?: { faultId?: unknown } }).data;
  return typeof data?.faultId === "string" ? data.faultId : "";
}

// `projectId` is part of the provider's stated props (Decision §1) and is read by the app layer
// that builds the rows and resolves a go-to's target; nothing inside the pattern reads it, so it is
// not destructured here.
export function CommandPaletteProvider({ tenantId, rows = [], search, navigate, goRow, children }: CommandPaletteProviderProps) {
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [answer, setAnswer] = useState<PaletteAnswer | null>(null);
  /** A rejected ask, as the id it named — `""` for one that named none (ARCH-03). */
  const [thrown, setThrown] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [recents, setRecents] = useState<readonly PaletteRow[]>([]);
  const [offline, setOffline] = useState(false);

  /** Where focus stood before the palette took it, so closing gives it back (AC-1). */
  const heldFocus = useRef<HTMLElement | null>(null);

  const openPalette = useCallback((): void => {
    if (!open) {
      const active = typeof document === "undefined" ? null : document.activeElement;
      heldFocus.current = active instanceof HTMLElement ? active : null;
    }
    setOpen(true);
    setQuery("");
    setActiveKey(null);
  }, [open]);

  const closePalette = useCallback((): void => {
    setOpen(false);
    setQuery("");
    setActiveKey(null);
  }, []);

  const togglePalette = useCallback((): void => {
    if (open) closePalette();
    else openPalette();
  }, [open, openPalette, closePalette]);

  const openSheet = useCallback((): void => {
    // The sheet takes focus for itself, so the palette's held focus is released rather than
    // restored: returning focus to the frame while a second overlay opens would fight it.
    heldFocus.current = null;
    setOpen(false);
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback((): void => setSheetOpen(false), []);

  // Focus goes back where it stood. Radix's non-modal content declines to restore it (it aims at a
  // trigger this palette does not render), so the one place that knows is the one that took it.
  useEffect(() => {
    if (open) return;
    const back = heldFocus.current;
    heldFocus.current = null;
    if (back !== null && back.isConnected) back.focus();
  }, [open]);

  /* --------------------------------------------------------------- this browser's own memory */

  useEffect(() => {
    if (open) setRecents(readRecents(tenantId));
  }, [open, tenantId]);

  /* ------------------------------------------------------------------------- the connection */

  useEffect(() => {
    const read = (): void => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    read();
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);

  /* ---------------------------------------------------------------------- asking the workspace */

  const asked = query.trim();

  useEffect(() => {
    // Nothing is asked for a blank query, and nothing is asked while offline: search needs the
    // server, and the groups that do not stand exactly as they did (Decision §2).
    if (!open || asked === "" || offline) {
      setAnswer(null);
      setThrown(null);
      setPending(false);
      return;
    }
    let current = true;
    setPending(true);
    setThrown(null);
    const timer = setTimeout(() => {
      search(query).then(
        (given) => {
          if (!current) return;
          setAnswer(given);
          setPending(false);
        },
        (raised: unknown) => {
          if (!current) return;
          // A rejected promise is a fault, never a refusal: the envelope is the only refusal
          // carrier there is (risk note 3, ARCH-03).
          setAnswer(null);
          setThrown(faultIdOf(raised));
          setPending(false);
        },
      );
    }, SETTLE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [open, query, asked, offline, search, attempt]);

  /* ------------------------------------------------------------------------------- the groups */

  const shortcutRows = useMemo<readonly PaletteRow[]>(
    () =>
      SHORTCUTS.map((entry) => {
        const led = entry.scope === "global" && entry.id.startsWith("go-") ? (goRow?.(entry.id) ?? null) : null;
        const reason =
          entry.id === "palette"
            ? strings.command_palette_reason_already_open
            : entry.scope === "viewer"
              ? strings.command_palette_reason_scope_viewer
              : entry.scope === "table"
                ? strings.command_palette_reason_scope_table
                : led === null
                  ? strings.command_palette_reason_no_project
                  : (led.reason ?? null);
        return {
          key: entry.id,
          group: "shortcuts" as const,
          kind: "shortcut",
          label: strings[entry.label],
          shortcutId: entry.id,
          // Availability is read off what the row can do (I-138): the sheet's own binding runs
          // here, a go-to leads where its target leads, and everything else says why it does not.
          href: led !== null && isAvailable(led) ? led.href : null,
          run: entry.id === "shortcut-sheet" ? openSheet : null,
          reason,
        };
      }),
    [goRow, openSheet],
  );

  const groups = useMemo<readonly PaletteGroup[]>(() => {
    const listed: PaletteGroup[] = [];
    if (asked === "") {
      listed.push({ id: "recent", rows: recents });
    } else if (!offline) {
      listed.push({ id: "navigate", rows: answer?.rows ?? [] });
    }
    const matching = (group: PaletteRow["group"], from: readonly PaletteRow[]): PaletteGroup => ({
      id: group,
      rows: from.filter((row) => row.group === group && matchesQuery(row, asked)),
    });
    listed.push(matching("areas", rows), matching("actions", rows), matching("shortcuts", shortcutRows));
    return listed.filter((group) => group.rows.length > 0);
  }, [asked, offline, recents, answer, rows, shortcutRows]);

  const flat = useMemo(() => groups.flatMap((group) => group.rows), [groups]);
  // A query change re-activates the first option, and so does an answer that no longer holds the
  // row that was active: the active option is a reading of the rows on screen, never a second
  // state that can name a row nobody can see (Decision §1).
  const activeRow = flat.find((row) => optionId(row) === activeKey) ?? flat[0] ?? null;
  const activeId = activeRow === null ? null : optionId(activeRow);

  const refusal = paletteRefusalOf(answer?.refusal);
  const faultId = thrown ?? answer?.faultId ?? null;
  const fault = useMemo<PaletteFault | null>(
    () => (typeof faultId === "string" ? { reportId: faultId, onRetry: () => setAttempt((at) => at + 1) } : null),
    [faultId],
  );

  const status: PaletteStatus = pending ? "loading" : refusal !== null && flat.length === 0 ? "refused" : flat.length === 0 && asked !== "" ? "empty" : "idle";

  /* ------------------------------------------------------------------------------ choosing */

  const choose = useCallback(
    (row: PaletteRow): void => {
      // I-138: Enter on an unavailable row navigates nothing and closes nothing. The answer was
      // already on the row before the press.
      if (!isAvailable(row)) return;
      setRecents(rememberRecent(tenantId, row));
      if (typeof row.run === "function") {
        row.run();
        closePalette();
        return;
      }
      const href = row.href ?? "";
      closePalette();
      navigate(href);
    },
    [tenantId, navigate, closePalette],
  );

  const move = useCallback(
    (delta: number): void => {
      if (flat.length === 0) return;
      const at = activeRow === null ? -1 : flat.findIndex((row) => optionId(row) === optionId(activeRow));
      const next = (((at === -1 ? 0 : at + delta) % flat.length) + flat.length) % flat.length;
      setActiveKey(optionId(flat[next] as PaletteRow));
    },
    [flat, activeRow],
  );

  const jump = useCallback(
    (to: "first" | "last"): void => {
      if (flat.length === 0) return;
      setActiveKey(optionId((to === "first" ? flat[0] : flat[flat.length - 1]) as PaletteRow));
    },
    [flat],
  );

  /* ---------------------------------------------------------------- the one global handler */

  const goTo = useCallback(
    (shortcutId: string): void => {
      const led = goRow?.(shortcutId) ?? null;
      if (led !== null && isAvailable(led)) {
        choose(led);
        return;
      }
      // A target that leads nowhere says so in place: the palette opens with that row active and
      // its reason showing, rather than a key that silently does nothing (I-138, I-139).
      openPalette();
      if (led !== null) setActiveKey(optionId(led));
    },
    [goRow, choose, openPalette],
  );

  const chord = useRef<{ ids: readonly string[]; at: number } | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const palette = shortcutById("palette");
      if (matchesStep(event, palette.keys[0] as string)) {
        // ⌘K is honoured wherever focus stands, a text field included (AC-1).
        event.preventDefault();
        togglePalette();
        return;
      }
      // Every other binding is text where text is being typed (Decision §1).
      if (isTextField(event.target)) {
        chord.current = null;
        return;
      }

      const held = chord.current;
      chord.current = null;
      if (held !== null && Date.now() - held.at <= CHORD_TIMEOUT_MS) {
        const finished = held.ids.map(shortcutById).find((entry) => matchesStep(event, entry.keys[1] as string));
        if (finished !== undefined) {
          event.preventDefault();
          goTo(finished.id);
          return;
        }
      }

      const sheet = shortcutById("shortcut-sheet");
      if (matchesStep(event, sheet.keys[0] as string)) {
        event.preventDefault();
        openSheet();
        return;
      }

      const starting = SHORTCUTS.filter((entry) => entry.scope === "global" && entry.keys.length > 1 && matchesStep(event, entry.keys[0] as string));
      if (starting.length > 0) chord.current = { ids: starting.map((entry) => entry.id), at: Date.now() };
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePalette, openSheet, goTo]);

  const value = useMemo<CommandPaletteValue>(
    () => ({
      open,
      sheetOpen,
      query,
      status,
      groups,
      activeId,
      refusal,
      fault,
      offline,
      openPalette,
      closePalette,
      togglePalette,
      openSheet,
      closeSheet,
      ask: (next: string) => {
        setQuery(next);
        setActiveKey(null);
      },
      clear: () => {
        setQuery("");
        setActiveKey(null);
      },
      choose,
      hover: (row: PaletteRow) => setActiveKey(optionId(row)),
      move,
      jump,
      activate: () => {
        if (activeRow !== null) choose(activeRow);
      },
    }),
    [
      open,
      sheetOpen,
      query,
      status,
      groups,
      activeId,
      refusal,
      fault,
      offline,
      openPalette,
      closePalette,
      togglePalette,
      openSheet,
      closeSheet,
      choose,
      move,
      jump,
      activeRow,
    ],
  );

  return <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>;
}
