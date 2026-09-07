"use client";
/**
 * The palette's app-layer half (docs/design/command-palette.md §1's wiring paragraph): the addresses
 * and the transport. `src/ui` owns the surface, the keyboard and the state; it knows no address and
 * no procedure, so this file is where a hit's kind becomes a route, where `spine.search` is called
 * and where a `go` shortcut's target is resolved (ARCH-01).
 *
 * Every address is built by the route-address home that owns it (B-17): nothing here spells `/t/…`.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { REFUSALS } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import {
  CommandPalette,
  CommandPaletteProvider,
  ShortcutSheet,
  useCommandPalette,
  type CommandGroup,
  type CommandItem,
  type PaletteRefusalCode,
} from "@/ui/patterns/command-palette";
import { shellHref } from "@/ui/shell";
import { SHORTCUTS, chordOf, type Shortcut } from "@/ui/shell/shortcuts/roster";
import { strings } from "@/ui/strings";
import { PROJECT_AREAS, projectHomeRoute } from "../p/[project]/home/areas";
import { projectHomeStrings } from "../p/[project]/home/strings";
import { drawingsRoute } from "../p/[project]/drawings/route-address";
import { setRoute } from "../p/[project]/drawings/sets/route-address";
import { viewerSheetRoute } from "../p/[project]/viewer/[drawing]/[layout]/route-address";
import { PALETTE_ACTIONS } from "./actions";
import { searchWorkspace, type SearchAnswer, type SearchHit } from "./search-transport";

/** The `go` target that names the workspace's own home rather than an area of a project. */
const PROJECTS_TARGET = "projects";

/**
 * The codes this surface can be refused with, read from the register rather than spelled beside it
 * (Q-07, I-142): a refused search is one of exactly these two, and anything else is a fault.
 */
const REACHABLE_REFUSALS = [REFUSALS.SIGNED_OUT.code, REFUSALS.WORKSPACE_PERMISSION_NOT_HELD.code] as const;

export interface PaletteHostProps {
  tenantId: string;
  /** The project the reader stands in, or null at a workspace-level address (I-139). */
  projectId?: string | null;
  /** The read the navigate group is made of; the shipped transport unless a caller states one. */
  search?: (input: { tenantId: string; query: string }) => Promise<unknown>;
  /** How the frame travels. Absent, the palette lists everything and takes nothing. */
  navigate?: (href: string) => void;
  children?: ReactNode;
}

/**
 * The frame's palette: the provider over the whole signed-in frame, with the dialog and the `?`
 * sheet mounted beside it. Both portal to the document body, so where they stand in this tree
 * decides nothing about where they paint.
 */
export function PaletteHost({ tenantId, projectId = null, search = searchWorkspace, navigate, children }: PaletteHostProps) {
  // The surfaces are inside the provider and the key handler is the provider's, so the one thing
  // that must cross the boundary — "open the palette showing this row" — travels as a box the
  // surfaces fill in and the handler reads.
  const openShowing = useRef<(query: string) => void>(() => {});

  const go = useCallback(
    (target: string): void => {
      const href = goHref(tenantId, projectId, target);
      if (href !== null) {
        navigate?.(href);
        return;
      }
      // The target resolves to no address here, so the answer is shown rather than swallowed: the
      // palette opens with that area's row active and its reason in place (I-138, I-139).
      openShowing.current(areaLabel(target));
    },
    [tenantId, projectId, navigate],
  );

  return (
    <CommandPaletteProvider tenantId={tenantId} onGo={go}>
      <PaletteSurfaces tenantId={tenantId} projectId={projectId} search={search} navigate={navigate} openShowing={openShowing} />
      {children}
    </CommandPaletteProvider>
  );
}

interface SurfaceProps {
  tenantId: string;
  projectId: string | null;
  search: (input: { tenantId: string; query: string }) => Promise<unknown>;
  navigate?: (href: string) => void;
  openShowing: { current: (query: string) => void };
}

function PaletteSurfaces({ tenantId, projectId, search, navigate, openShowing }: SurfaceProps) {
  const palette = useCommandPalette();
  const open = palette?.open ?? false;
  const query = palette?.query ?? "";
  const asked = query.trim();

  const [hits, setHits] = useState<readonly SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  // `refused` rather than `setRefusal`: the catch below ANSWERS with a refusal, and a name that
  // says so is what makes the answer legible at the site that makes it (ARCH-03, B-21).
  const [refusal, refused] = useState<PaletteRefusalCode | undefined>(undefined);
  const [reportId, setReportId] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  const setOpen = palette?.setOpen;
  const setQuery = palette?.setQuery;
  useEffect(() => {
    openShowing.current = (showing: string): void => {
      setOpen?.(true);
      setQuery?.(showing);
    };
  }, [openShowing, setOpen, setQuery]);

  useEffect(() => {
    if (!open || asked === "") {
      setHits([]);
      setSearching(false);
      refused(undefined);
      setReportId(undefined);
      return;
    }
    let live = true;
    setSearching(true);
    refused(undefined);
    setReportId(undefined);
    void (async () => {
      try {
        const answered = await search({ tenantId, query: asked });
        if (!live) return;
        setHits(hitsOf(answered));
        setSearching(false);
      } catch (thrown) {
        // ARCH-03, B-21: three different answers. A registered refusal renders through the one
        // renderer with its remedy; anything else is a fault carrying the id an operator correlates
        // by. Nothing is swallowed, and no message is improvised.
        if (!live) return;
        setSearching(false);
        setHits([]);
        const code = codeOf(thrown);
        const registered = REACHABLE_REFUSALS.find((each) => each === code);
        if (registered !== undefined) refused(registered);
        else setReportId(faultIdOf(thrown));
      }
    })();
    return () => {
      live = false;
    };
  }, [open, asked, tenantId, search, attempt]);

  const recents = palette?.recents ?? [];
  const offline = palette?.offline ?? false;

  /** What choosing a row does, by the row's own key — built beside the rows so the two agree. */
  const takes = useMemo(() => new Map<string, () => void>(), [tenantId, projectId, navigate, hits, recents, palette]);

  const groups = useMemo<readonly CommandGroup[]>(() => {
    takes.clear();
    const blank = asked === "";
    const matches = (label: string): boolean => blank || label.toLowerCase().includes(asked.toLowerCase());
    const close = (): void => palette?.setOpen(false);

    /* --- Recent (I-141): this browser's own, and only while the query asks for nothing --- */
    const recentItems: CommandItem[] = blank
      ? recents.map((recent) => {
          takes.set(recent.key, () => {
            palette?.remember(recent);
            navigate?.(recent.href);
            close();
          });
          return { key: recent.key, kind: recent.kind, label: recent.label, available: true };
        })
      : [];

    /* --- Go to: what the workspace holds that the query named (AC-2). Offline the group is absent:
           search needs the server, and an empty group would read as "nothing matches" (§2). --- */
    const navigateItems: CommandItem[] = offline
      ? []
      : hits.map((hit) => {
          const key = hitKey(hit);
          const href = hitRoute(tenantId, hit);
          takes.set(key, () => {
            palette?.remember({ key, kind: hit.kind, label: hit.label, href });
            navigate?.(href);
            close();
          });
          return { key, kind: hit.kind, label: hit.label, meta: hit.layoutName, available: true };
        });

    /* --- Project areas (I-139): the group always renders, project or not --- */
    const areaItems: CommandItem[] = PROJECT_AREAS.filter((area) => matches(projectHomeStrings[area.label])).map((area) => {
      const href = projectId === null || area.route === null ? null : area.route(tenantId, projectId);
      if (href !== null) takes.set(area.key, () => {
        navigate?.(href);
        close();
      });
      return {
        key: area.key,
        kind: "area",
        label: projectHomeStrings[area.label],
        available: href !== null,
        reason: href === null ? (projectId === null ? strings.command_palette_reason_no_project : strings.command_palette_reason_area_unbuilt) : undefined,
      };
    });

    /* --- Actions: the two R-SPINE-050 names, shown with their reason until a screen carries them --- */
    const actionItems: CommandItem[] = PALETTE_ACTIONS.filter((action) => matches(strings[action.label])).map((action) => {
      const run = action.run;
      if (run !== null) takes.set(action.key, () => {
        run(tenantId, projectId);
        close();
      });
      return {
        key: action.key,
        kind: "action",
        label: strings[action.label],
        available: run !== null,
        reason: run === null ? strings[action.reason] : undefined,
      };
    });

    /* --- Shortcuts: the roster, in both directions and in its order (AC-3) --- */
    const shortcutItems: CommandItem[] = SHORTCUTS.filter((entry) => matches(strings[entry.label])).map((entry) => {
      const reason = shortcutReason(entry, tenantId, projectId);
      if (reason === null) takes.set(entry.id, () => shortcutTaken(entry, { tenantId, projectId, navigate, palette }));
      return {
        key: entry.id,
        kind: "shortcut",
        shortcutId: entry.id,
        label: strings[entry.label],
        chord: chordOf(entry),
        available: reason === null,
        reason: reason ?? undefined,
      };
    });

    return [
      { id: "recent", label: strings.command_palette_group_recent, items: recentItems },
      { id: "navigate", label: strings.command_palette_group_navigate, items: navigateItems },
      { id: "areas", label: strings.command_palette_group_areas, items: areaItems },
      { id: "actions", label: strings.command_palette_group_actions, items: actionItems },
      { id: "shortcuts", label: strings.command_palette_group_shortcuts, items: shortcutItems },
    ];
  }, [takes, asked, recents, hits, offline, tenantId, projectId, navigate, palette]);

  const rows = groups.reduce((count, group) => count + group.items.length, 0);
  const status = refusal !== undefined ? "refused" : searching ? "loading" : asked !== "" && rows === 0 ? "empty" : "idle";

  if (palette === null) return null;

  return (
    <>
      <CommandPalette
        open={open}
        onOpenChange={palette.setOpen}
        query={query}
        onQueryChange={palette.setQuery}
        groups={groups}
        status={status}
        refusal={refusal}
        offline={offline}
        onSelect={(item) => takes.get(item.key)?.()}
        {...(reportId === undefined ? {} : { fault: { reportId, onRetry: () => setAttempt((at) => at + 1) } })}
        onShortcutSheet={() => {
          palette.setOpen(false);
          palette.setSheetOpen(true);
        }}
      />
      <ShortcutSheet open={palette.sheetOpen} onOpenChange={palette.setSheetOpen} shortcuts={SHORTCUTS} />
    </>
  );
}

/** The hits an answer carries, however the caller shaped it (AC-2: the answer is `{ hits }`). */
function hitsOf(answered: unknown): readonly SearchHit[] {
  const held = (answered as SearchAnswer | undefined)?.hits;
  if (Array.isArray(held)) return held as SearchHit[];
  return Array.isArray(answered) ? (answered as SearchHit[]) : [];
}

/** The refusal code a failure carries — on the marker core writes, or on the envelope's own data. */
function codeOf(thrown: unknown): string | null {
  const marked = refusalCodeOf(thrown);
  if (marked !== null) return marked;
  const data = (thrown as { data?: { refusalCode?: unknown; code?: unknown } } | null)?.data;
  if (typeof data?.refusalCode === "string") return data.refusalCode;
  return typeof data?.code === "string" ? data.code : null;
}

/** The id an operator correlates a fault by; a transport that carried none still says so (I-12). */
function faultIdOf(thrown: unknown): string {
  const data = (thrown as { data?: { faultId?: unknown } } | null)?.data;
  return typeof data?.faultId === "string" ? data.faultId : "";
}

/** One hit's own identity, so a row and what it takes are keyed by the same thing. */
function hitKey(hit: SearchHit): string {
  if (hit.kind === "project") return `project-${hit.projectId}`;
  if (hit.kind === "drawing") return `drawing-${hit.drawingId ?? ""}`;
  if (hit.kind === "set") return `set-${hit.setId ?? ""}`;
  return `sheet-${hit.drawingId ?? ""}-${hit.layoutName ?? ""}`;
}

/** The address a hit's kind builds, from the route-address home that owns it (AC-2, B-17). */
function hitRoute(tenantId: string, hit: SearchHit): string {
  switch (hit.kind) {
    case "project":
      return projectHomeRoute(tenantId, hit.projectId);
    case "drawing":
      return drawingsRoute(tenantId, hit.projectId);
    case "sheet":
      return viewerSheetRoute(tenantId, hit.projectId, hit.drawingId ?? "", hit.layoutName ?? "");
    default:
      return setRoute(tenantId, hit.projectId, hit.setId ?? "");
  }
}

/** Where a `go` target leads from here, or null when this context reaches no address for it. */
function goHref(tenantId: string, projectId: string | null, target: string): string | null {
  if (target === PROJECTS_TARGET) return shellHref(tenantId, PROJECTS_TARGET);
  if (projectId === null) return null;
  const area = PROJECT_AREAS.find((each) => each.key === target);
  return area?.route === undefined || area.route === null ? null : area.route(tenantId, projectId);
}

/** The words a target is named by, for the row the palette opens showing (I-139). */
function areaLabel(target: string): string {
  const area = PROJECT_AREAS.find((each) => each.key === target);
  return area === undefined ? target : projectHomeStrings[area.label];
}

/** Why a shortcut row cannot be taken from here, or null when it can (I-138 — availability is read). */
function shortcutReason(entry: Shortcut, tenantId: string, projectId: string | null): string | null {
  if (entry.scope === "viewer") return strings.command_palette_reason_scope_viewer;
  if (entry.scope === "table") return strings.command_palette_reason_scope_table;
  if (entry.action === "open-palette") return strings.command_palette_reason_already_open;
  if (entry.action === "go" && entry.target !== undefined && goHref(tenantId, projectId, entry.target) === null) {
    return projectId === null ? strings.command_palette_reason_no_project : strings.command_palette_reason_area_unbuilt;
  }
  return null;
}

/** What choosing a shortcut row does — the same thing its key does, from the same roster (I-147). */
function shortcutTaken(
  entry: Shortcut,
  frame: { tenantId: string; projectId: string | null; navigate?: (href: string) => void; palette: ReturnType<typeof useCommandPalette> },
): void {
  if (entry.action === "open-sheet") {
    frame.palette?.setOpen(false);
    frame.palette?.setSheetOpen(true);
    return;
  }
  if (entry.action !== "go" || entry.target === undefined) return;
  const href = goHref(frame.tenantId, frame.projectId, entry.target);
  if (href === null) return;
  frame.navigate?.(href);
  frame.palette?.setOpen(false);
}
