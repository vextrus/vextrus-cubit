"use client";
/**
 * The palette's app-layer half (docs/design/command-palette.md § 1's wiring): the addresses and the
 * transport, which `src/ui` may hold neither of (ARCH-01).
 *
 * Everything a row leads to is built here, by the route-address home that owns that address — a
 * project's home, a project's drawings, a sheet in the viewer, a set — so no path is spelled twice
 * and none is spelled in the pattern (B-17). What the pattern is handed is rows that already carry
 * where they go.
 *
 * The unhappy paths stay three different answers (ARCH-03, B-21): a refused read renders the one
 * RefusalState inside the dialog, a faulted one renders the error cell with its report id and a
 * retry, and neither is ever a silent empty list.
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import type { RefusalCode } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import {
  CommandPaletteProvider,
  matchesQuery,
  type CommandGroup,
  type CommandItem,
  type PaletteDestination,
  type PaletteFault,
  type PaletteStatus,
} from "@/ui/patterns/command-palette";
import { shellHref } from "@/ui/shell/routes";
import { strings } from "@/ui/strings";
import { drawingsRoute } from "../p/[project]/drawings/route-address";
import { setRoute } from "../p/[project]/drawings/sets/route-address";
import { PROJECT_AREAS, projectHomeRoute } from "../p/[project]/home/areas";
import { projectHomeStrings } from "../p/[project]/home/strings";
import { viewerSheetRoute } from "../p/[project]/viewer/[drawing]/[layout]/route-address";
import { PALETTE_ACTIONS } from "./palette-actions";

/** The `go` target that names the workspace's own home rather than an area of a project. */
const PROJECTS_TARGET = "projects";

/** The group ids § 1 fixes for the three this layer builds. */
const NAVIGATE = "navigate";
const AREAS = "areas";
const ACTIONS = "actions";

/** One answered subject, in the shape `src/server/spine/search.ts` publishes it. */
export interface PaletteHit {
  readonly kind: string;
  readonly label?: string;
  readonly name?: string;
  readonly id?: string;
  readonly projectId?: string;
  readonly drawingId?: string;
  readonly setId?: string;
  readonly sheetId?: string;
  readonly layoutName?: string;
  readonly meta?: string;
}

/** What a search answers with, however the caller's transport shapes it. */
export type PaletteSearchAnswer = unknown;

export interface PaletteHostProps {
  tenantId: string;
  /** The project the reader stands in, or null for a workspace-level address. */
  projectId?: string | null;
  /** The read behind the navigate group; the browser's is the server action beside this file. */
  search: (input: { tenantId: string; query: string }) => Promise<PaletteSearchAnswer>;
  /** Following an address is the router's; the frame hands its own way of doing it down. */
  navigate: (href: string) => void;
  children?: ReactNode;
}

export function PaletteHost({ tenantId, projectId = null, search, navigate, children }: PaletteHostProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<readonly PaletteHit[]>([]);
  const [status, setStatus] = useState<PaletteStatus>("idle");
  const [refusal, setRefusal] = useState<RefusalCode | undefined>(undefined);
  const [fault, setFault] = useState<PaletteFault | undefined>(undefined);
  // Which read the screen is showing. An answer that arrives after a newer question was asked is
  // dropped rather than painted: a slower reply overwriting a faster one would show a person rows
  // for words they have already deleted.
  const asked = useRef(0);

  const run = useCallback(
    async (typed: string): Promise<void> => {
      const turn = (asked.current += 1);
      const stale = (): boolean => asked.current !== turn;

      if (typed.trim() === "") {
        setHits([]);
        setStatus("idle");
        setRefusal(undefined);
        setFault(undefined);
        return;
      }

      setStatus("loading");
      setRefusal(undefined);
      setFault(undefined);
      // A rejected read is folded into the same three-shaped answer the seam already gives, so this
      // screen has ONE reading of "what came back" rather than two that could drift (ARCH-03, B-21):
      // rows, a registered refusal, or a fault with the id the tier recorded it under.
      const answer = await search({ tenantId, query: typed }).then(
        (value): unknown => value,
        (failure: unknown): unknown => failureAnswer(failure),
      );
      if (stale()) return;

      const refused = refusalIn(answer);
      if (refused !== null) {
        setHits([]);
        setRefusal(refused);
        setStatus("refused");
        return;
      }
      const faulted = faultIn(answer);
      if (faulted !== null) {
        setHits([]);
        setStatus("idle");
        setFault({ reportId: faulted, onRetry: () => void run(typed) });
        return;
      }
      const found = hitsIn(answer);
      setHits(found);
      setStatus(found.length === 0 ? "empty" : "idle");
    },
    [search, tenantId],
  );

  const onQueryChange = useCallback(
    (typed: string): void => {
      setQuery(typed);
      void run(typed);
    },
    [run],
  );

  /** Where a `go` chord's target leads from here, or the reason it leads nowhere (I-138, I-139). */
  const resolveGo = useCallback(
    (target: string): PaletteDestination => {
      if (target === PROJECTS_TARGET) return { href: shellHref(tenantId, PROJECTS_TARGET) };
      const area = PROJECT_AREAS.find((entry) => entry.key === target);
      // The words the row is named by travel with the reason: a chord for a place this workspace
      // cannot open asks the palette for that place by name, and the row it names is what stands
      // there (§1's wiring, I-138).
      if (area === undefined) return { reason: strings.command_palette_reason_area_unbuilt, label: target };
      const label = projectHomeStrings[area.label];
      if (projectId === null) return { reason: strings.command_palette_reason_no_project, label };
      // Read off `PROJECT_AREAS.route`, never written beside the row: an area with no screen in this
      // workspace says so, and becomes reachable the day it gains an address and nothing else (I-126,
      // I-138). The sentence has one home and two registered names (src/ui/strings/command-palette.ts).
      if (area.route === null) return { reason: strings.command_palette_reason_area_unbuilt, label };
      return { href: area.route(tenantId, projectId) };
    },
    [projectId, tenantId],
  );

  const groups = useMemo<readonly CommandGroup[]>(() => {
    // Every group is read by the same rule, the answered subjects included: "the list shows what
    // matches what you typed" is one sentence a person learns once, and one function the whole
    // surface asks (B-17). The server has already matched on the same names, so this narrows
    // nothing a reader was owed — it only keeps a stale answer from outliving the words it answered.
    const navigateRows = hits.map((hit) => hitRow(hit, tenantId)).filter((item) => matchesQuery(item.label, query));
    // The areas group always renders, project or not: a group that vanished with context would
    // teach a person their workspace has fewer parts than it has (I-139).
    const areaRows = PROJECT_AREAS.map((area): CommandItem => {
      const label = projectHomeStrings[area.label];
      const where = resolveGo(area.key);
      return { key: area.key, kind: "area", area: area.key, label, ...("href" in where ? { href: where.href } : { reason: where.reason }) };
    }).filter((item) => matchesQuery(item.label, query));
    const actionRows = PALETTE_ACTIONS.map((action): CommandItem => {
      const label = strings[action.label];
      const act = action.run;
      return {
        key: action.key,
        kind: "action",
        action: action.key,
        label,
        ...(act === null ? { reason: strings[action.reason] } : { run: () => act(tenantId, projectId) }),
      };
    }).filter((item) => matchesQuery(item.label, query));

    return [
      ...(navigateRows.length === 0 ? [] : [{ id: NAVIGATE, label: strings.command_palette_group_navigate, items: navigateRows }]),
      ...(areaRows.length === 0 ? [] : [{ id: AREAS, label: strings.command_palette_group_areas, items: areaRows }]),
      ...(actionRows.length === 0 ? [] : [{ id: ACTIONS, label: strings.command_palette_group_actions, items: actionRows }]),
    ];
  }, [hits, projectId, query, resolveGo, tenantId]);

  return (
    <CommandPaletteProvider
      tenantId={tenantId}
      groups={groups}
      status={status}
      refusal={refusal}
      fault={fault}
      onQueryChange={onQueryChange}
      navigate={navigate}
      resolveGo={resolveGo}
    >
      {children}
    </CommandPaletteProvider>
  );
}

/**
 * One answered subject as a row, at the address its kind builds. Each address comes from the module
 * that owns that screen, so the palette leads where the screen itself says it lives (AC-2, B-17).
 */
function hitRow(hit: PaletteHit, tenantId: string): CommandItem {
  const label = hit.label ?? hit.name ?? "";
  const projectId = hit.projectId ?? "";
  const id = hit.id ?? hit.sheetId ?? hit.drawingId ?? hit.setId ?? projectId;
  const href =
    hit.kind === "project"
      ? projectHomeRoute(tenantId, projectId)
      : hit.kind === "drawing"
        ? drawingsRoute(tenantId, projectId)
        : hit.kind === "sheet"
          ? viewerSheetRoute(tenantId, projectId, hit.drawingId ?? "", hit.layoutName ?? "")
          : setRoute(tenantId, projectId, hit.setId ?? "");
  return { key: `${hit.kind}:${id}`, kind: hit.kind, label, href, ...(hit.meta === undefined ? {} : { meta: hit.meta }) };
}

/**
 * A read that rejected, in the shape a read that answered uses. A failure carrying a registered code
 * is that refusal — an ended session gets the sentence and the remedy the register holds for it, and
 * never a retry button. Anything else is a fault: it is shown as one, with an id a person can quote,
 * because a search that broke is not a search that found nothing (ARCH-03, B-21, R-UI-020).
 */
function failureAnswer(failure: unknown): unknown {
  const code = refusalCodeOf(failure);
  return code === null ? { fault: { reportId: reportIdOf(failure) } } : { refusal: code };
}

/** The hits an answer carries, whether it is the array itself or a bag holding one. */
function hitsIn(answer: unknown): readonly PaletteHit[] {
  if (Array.isArray(answer)) return answer as readonly PaletteHit[];
  const bag = answer as { hits?: unknown } | null;
  return bag !== null && Array.isArray(bag.hits) ? (bag.hits as readonly PaletteHit[]) : [];
}

/** The registered code an answer refused with, or null when it answered. */
function refusalIn(answer: unknown): RefusalCode | null {
  if (typeof answer !== "object" || answer === null) return null;
  const said = (answer as { refusal?: unknown }).refusal;
  return typeof said === "string" ? (said as RefusalCode) : null;
}

/** The report id an answer faulted with, or null when it did not fault. */
function faultIn(answer: unknown): string | null {
  if (typeof answer !== "object" || answer === null) return null;
  const said = (answer as { fault?: { reportId?: unknown } }).fault;
  return typeof said?.reportId === "string" ? said.reportId : null;
}

/**
 * The thread a failure the browser saw is quoted by. A transport that already carried an id keeps
 * it, so the record the tier wrote and the line on the screen name the same fault; a failure that
 * carried none is given one here rather than shown to a person with nothing they can quote.
 */
function reportIdOf(failure: unknown): string {
  if (typeof failure === "object" && failure !== null) {
    const said = (failure as { reportId?: unknown; faultId?: unknown; requestId?: unknown });
    for (const value of [said.reportId, said.faultId, said.requestId]) if (typeof value === "string") return value;
  }
  return globalThis.crypto.randomUUID();
}
