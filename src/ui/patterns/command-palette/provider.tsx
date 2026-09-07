"use client";
/**
 * The palette's interaction state, and the one global key handler R-UI-032 promises (command-palette
 * §1's wiring paragraph). Open state, the query, the chord buffer and this browser's recents live
 * here; addresses and transport do not — the provider tells the app layer that a `go` shortcut was
 * asked for and the app layer decides where it leads (ARCH-01, shortcut-sheet §1).
 *
 * Provider-gated like the jobs register (shell I-116): outside a provider `useCommandPalette()`
 * answers null and the trigger renders nothing, which is what keeps every bare mount of the top bar
 * standing (I-135).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CHORD_TIMEOUT_MS, SHORTCUTS, matchStep, type Shortcut } from "../../shell/shortcuts/roster";

/** One thing this browser went to from the palette (I-141). Kept per workspace, newest first. */
export interface PaletteRecent {
  readonly key: string;
  readonly kind: string;
  readonly label: string;
  /** The address it leads to — recents are deduplicated by it, so one destination appears once. */
  readonly href: string;
}

/** How many selections a workspace's recents hold before the oldest falls off (I-141). */
export const RECENTS_LIMIT = 8;

/** Where this browser's recents are kept, keyed by workspace so two workspaces never mix (I-141). */
export function recentsStorageKey(tenantId: string): string {
  return `cubit.palette.recents.${tenantId}`;
}

/** What a surface inside the provider may read and ask for. */
export interface CommandPaletteState {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly query: string;
  readonly setQuery: (query: string) => void;
  readonly sheetOpen: boolean;
  readonly setSheetOpen: (open: boolean) => void;
  /** This browser's recent destinations for the workspace, newest first (I-141). */
  readonly recents: readonly PaletteRecent[];
  readonly remember: (recent: PaletteRecent) => void;
  /** Whether the browser says it is offline — the navigate group needs the server (§2). */
  readonly offline: boolean;
  /** The trigger names itself so closing can return focus to it (AC-1). */
  readonly registerTrigger: (node: HTMLElement | null) => void;
}

const PaletteContext = createContext<CommandPaletteState | null>(null);

/** The palette's state, or null outside a provider — the gate the trigger reads (I-135). */
export function useCommandPalette(): CommandPaletteState | null {
  return useContext(PaletteContext);
}

export interface CommandPaletteProviderProps {
  children: ReactNode;
  /** The workspace recents are kept per; none means this browser remembers nothing (I-141). */
  tenantId?: string;
  /** A `go` shortcut's destination is the app layer's to resolve and to take (shortcut-sheet §1). */
  onGo?: (target: string) => void;
}

/** The entries the frame binds. Viewer and table keys are documented here and bound by their own
 * screens (I-148), so the handler never answers for a scope it does not own. */
const GLOBAL_SHORTCUTS: readonly Shortcut[] = SHORTCUTS.filter((entry) => entry.scope === "global");

/** The chord step that stands for the platform's command key — the one entry a text field honours. */
const MOD_STEP = "Mod+";

/** Whether the event happened inside something a person is typing into (I-147). */
function insideTextField(target: EventTarget | null): boolean {
  if (target === null || !(target instanceof Element)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return target.closest("[contenteditable]:not([contenteditable='false'])") !== null;
}

/** The recents this browser holds for a workspace. Storage that throws simply yields none (I-141). */
function readRecents(tenantId: string | undefined): readonly PaletteRecent[] {
  if (tenantId === undefined || tenantId === "") return [];
  try {
    const stored = globalThis.localStorage?.getItem(recentsStorageKey(tenantId));
    if (typeof stored !== "string") return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecent).slice(0, RECENTS_LIMIT);
  } catch {
    // Not a fault and not a refusal: a browser that will not lend us storage has simply remembered
    // nothing, and a person is shown the other four groups exactly as they always are (I-141).
    return [];
  }
}

/** One stored recent, judged rather than trusted — storage is written by an older build too. */
function isRecent(value: unknown): value is PaletteRecent {
  if (typeof value !== "object" || value === null) return false;
  const held = value as Record<string, unknown>;
  return typeof held["key"] === "string" && typeof held["kind"] === "string" && typeof held["label"] === "string" && typeof held["href"] === "string";
}

export function CommandPaletteProvider({ children, tenantId, onGo }: CommandPaletteProviderProps) {
  const [open, setOpenState] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<readonly PaletteRecent[]>([]);
  const [offline, setOffline] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  const registerTrigger = useCallback((node: HTMLElement | null): void => {
    trigger.current = node;
  }, []);

  // A palette opened fresh asks its question fresh: a query left over from the last time would list
  // an answer to something the person is no longer asking (§1's keyboard).
  const setOpen = useCallback((next: boolean): void => {
    setOpenState(next);
    if (next) setQuery("");
  }, []);

  useEffect(() => {
    setRecents(readRecents(tenantId));
  }, [tenantId]);

  // §2's offline cell: the browser's own reading, watched rather than sampled once.
  useEffect(() => {
    const read = (): void => setOffline(globalThis.navigator?.onLine === false);
    read();
    globalThis.addEventListener?.("online", read);
    globalThis.addEventListener?.("offline", read);
    return () => {
      globalThis.removeEventListener?.("online", read);
      globalThis.removeEventListener?.("offline", read);
    };
  }, []);

  // Closing returns focus to the trigger it came from (AC-1). Radix restores focus to whatever held
  // it before the dialog opened, which for a palette opened by a chord is the document body — so the
  // frame states where focus belongs rather than leaving a reader at the top of the page.
  useEffect(() => {
    if (wasOpen.current && !open) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const remember = useCallback(
    (recent: PaletteRecent): void => {
      setRecents((held) => [recent, ...held.filter((each) => each.href !== recent.href)].slice(0, RECENTS_LIMIT));
      if (tenantId === undefined || tenantId === "") return;
      try {
        const kept = [recent, ...readRecents(tenantId).filter((each) => each.href !== recent.href)].slice(0, RECENTS_LIMIT);
        globalThis.localStorage?.setItem(recentsStorageKey(tenantId), JSON.stringify(kept));
      } catch {
        // Storage the browser refuses is remembered in this tab only; nothing about the move failed.
      }
    },
    [tenantId],
  );

  const act = useCallback(
    (entry: Shortcut): void => {
      if (entry.action === "open-palette") {
        setSheetOpen(false);
        setOpen(true);
        return;
      }
      if (entry.action === "open-sheet") {
        setOpen(false);
        setSheetOpen(true);
        return;
      }
      // A `go` step opens its address when the roster's target resolves; the viewer and table keys
      // are documented here and bound by the screens that own them (I-148).
      if (entry.action === "go" && entry.target !== undefined) onGo?.(entry.target);
    },
    [onGo, setOpen],
  );

  // The one handler R-UI-032 names, reading `SHORTCUTS` and only `SHORTCUTS` (I-147).
  const pending = useRef<{ entries: readonly Shortcut[]; depth: number; at: number }>({ entries: [], depth: 0, at: 0 });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const inField = insideTextField(event.target);
      const now = Date.now();
      const expired = now - pending.current.at > CHORD_TIMEOUT_MS;
      const buffered = expired ? [] : pending.current.entries;
      const depth = buffered.length === 0 ? 0 : pending.current.depth;
      const reachable = (buffered.length === 0 ? GLOBAL_SHORTCUTS : buffered).filter(
        (entry) => !inField || entry.keys[0]?.startsWith(MOD_STEP) === true,
      );

      const matched = reachable.filter((entry) => {
        const step = entry.keys[depth];
        return step !== undefined && matchStep(event, step);
      });
      if (matched.length === 0) {
        pending.current = { entries: [], depth: 0, at: 0 };
        return;
      }

      const complete = matched.find((entry) => entry.keys.length === depth + 1);
      event.preventDefault();
      if (complete !== undefined) {
        pending.current = { entries: [], depth: 0, at: 0 };
        act(complete);
        return;
      }
      pending.current = { entries: matched, depth: depth + 1, at: now };
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [act]);

  const state = useMemo<CommandPaletteState>(
    () => ({ open, setOpen, query, setQuery, sheetOpen, setSheetOpen, recents, remember, offline, registerTrigger }),
    [open, setOpen, query, sheetOpen, recents, remember, offline, registerTrigger],
  );

  return <PaletteContext.Provider value={state}>{children}</PaletteContext.Provider>;
}
