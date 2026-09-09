// The rows the palette lists that are not the seam's answer: where a person can go inside the
// workspace they stand in, and what they can run. Addresses live in this layer (ARCH-01) and every
// one of them is imported from the home that already spells it (B-17) — this file adds no `/t/…`.
//
// Availability is read, never written (I-138): an area's is read off `PROJECT_AREAS.route` and an
// action's off its `run`, so the day a screen or an act lands the row becomes reachable by gaining
// one and nothing else here changes.
import type { PaletteRow } from "@/ui/patterns/command-palette";
import { areaLabel, shellHref, type ShellArea } from "@/ui/shell";
import { strings } from "@/ui/strings";
import { PROJECT_AREAS, projectHomeRoute } from "../p/[project]/home/areas";
import { projectHomeStrings } from "../p/[project]/home/strings";
import { drawingsRoute } from "../p/[project]/drawings/route-address";
import { setRoute } from "../p/[project]/drawings/sets/route-address";
import { viewerSheetRoute } from "../p/[project]/viewer/[drawing]/[layout]/route-address";
import type { SearchHit } from "./search-action";

/**
 * Which area each go-to binding of the roster aims at: the workspace's own Projects area for
 * `go-projects`, and a `PROJECT_AREAS` key for the four that stand inside a project. The roster of
 * bindings is `SHORTCUTS`' (R-UI-032); this is the one place that says where each one leads.
 */
export const GO_TARGETS = Object.freeze([
  { id: "go-projects", area: "projects", within: "workspace" },
  { id: "go-drawings", area: "drawings", within: "project" },
  { id: "go-takeoff", area: "takeoff", within: "project" },
  { id: "go-estimate", area: "estimate", within: "project" },
  { id: "go-bid", area: "bid", within: "project" },
] as const);

/**
 * R-SPINE-050's actions. Both are listed and neither runs yet: the screens that would carry them
 * out have not landed, so each says where the thing lives instead of pretending to do it (I-138).
 * They gain `run` when inc-407 and inc-605 own them.
 */
export const PALETTE_ACTIONS = Object.freeze([
  { key: "affirm-scale", label: strings.command_palette_action_affirm_scale, reason: strings.command_palette_reason_affirm_scale, run: null },
  { key: "export-boq", label: strings.command_palette_action_export_boq, reason: strings.command_palette_reason_export_boq, run: null },
] as const);

/** The project the address stands inside, or null for a workspace-level one (R-UI-031). */
export function projectOf(pathname: string | null): string | null {
  if (pathname === null) return null;
  const match = /^\/t\/[^/]+\/p\/([^/]+)(?:\/|$)/.exec(pathname);
  return match === null ? null : (match[1] ?? null);
}

/**
 * The static groups: the project's seven areas and the actions roster. The areas group stands
 * whether a project is open or not — a group that vanished with context would teach a person their
 * workspace has fewer parts than it has (I-139).
 */
export function paletteRows(tenantId: string, projectId: string | null): readonly PaletteRow[] {
  const areas = PROJECT_AREAS.map((area): PaletteRow => {
    const reachable = projectId !== null && area.route !== null;
    return {
      key: area.key,
      group: "areas",
      kind: "area",
      label: projectHomeStrings[area.label],
      href: reachable && area.route !== null ? area.route(tenantId, projectId as string) : null,
      reason: projectId === null ? strings.command_palette_reason_no_project : area.route === null ? strings.command_palette_reason_area_unbuilt : null,
    };
  });

  const actions = PALETTE_ACTIONS.map(
    (action): PaletteRow => ({ key: action.key, group: "actions", kind: "action", label: action.label, run: action.run, reason: action.reason }),
  );

  return [...areas, ...actions];
}

/** Where a go-to binding leads today: a reachable row, or the area row carrying the reason it is not. */
export function goRowOf(tenantId: string, rows: readonly PaletteRow[], shortcutId: string): PaletteRow | null {
  const target = GO_TARGETS.find((entry) => entry.id === shortcutId);
  if (target === undefined) return null;
  if (target.within === "workspace") {
    const area = target.area as ShellArea;
    return { key: `shell-${area}`, group: "navigate", kind: "area", label: areaLabel(area), href: shellHref(tenantId, area) };
  }
  return rows.find((row) => row.group === "areas" && row.key === target.area) ?? null;
}

/** The address a hit leads to, by its kind — each spelled by the home that owns it (B-17). */
export function hrefOfHit(tenantId: string, hit: SearchHit): string {
  switch (hit.kind) {
    case "project":
      return projectHomeRoute(tenantId, hit.projectId);
    case "drawing":
      return drawingsRoute(tenantId, hit.projectId);
    case "sheet":
      return viewerSheetRoute(tenantId, hit.projectId, hit.drawingId ?? "", hit.layoutName ?? "");
    case "set":
      return setRoute(tenantId, hit.projectId, hit.setId ?? "");
  }
}

/** One answered hit, as a row of the navigate group. */
export function rowOfHit(tenantId: string, hit: SearchHit): PaletteRow {
  return {
    key: `${hit.kind}:${hit.projectId}:${hit.drawingId ?? ""}:${hit.setId ?? ""}:${hit.layoutName ?? ""}`,
    group: "navigate",
    kind: hit.kind,
    label: hit.label,
    meta: hit.meta ?? null,
    href: hrefOfHit(tenantId, hit),
  };
}
