// The rows the palette lists that are not the seam's answer: where a person can go inside the
// workspace they stand in, and what they can run. Addresses live in this layer (ARCH-01) and every
// one of them is imported from the home that already spells it (B-17) — this file adds no `/t/…`.
//
// Availability is read, never written (I-138): an area's is read off `PROJECT_AREAS.route` and an
// action's off its `run`, so the day a screen or an act lands the row becomes reachable by gaining
// one and nothing else here changes.
import { formatUserFigure } from "@/core/format";
import { selectionAddress } from "@/modules/takeoff/trace/address";
import type { PaletteRow } from "@/ui/patterns/command-palette";
import { humaniseEnum } from "@/ui/primitives/core/enum-label";
import { areaLabel, shellHref, type ShellArea } from "@/ui/shell";
import { fill, strings } from "@/ui/strings";
import { PROJECT_AREAS, projectHomeRoute } from "../p/[project]/home/areas";
import { projectHomeStrings } from "../p/[project]/home/strings";
import { drawingsRoute } from "../p/[project]/drawings/route-address";
import { setRoute } from "../p/[project]/drawings/sets/route-address";
import { registerRoute } from "../p/[project]/takeoff/register/route-address";
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

/**
 * The address a hit leads to, by its kind — each spelled by the home that owns it (B-17). A find
 * opens the viewer at the sheet the server placed it on, with what it names selected and flown to
 * (`selectionAddress`, which states no camera); a find no sheet shows leads where it can be read —
 * a mark to the register it is filed in, a text to the project's drawings (I-475).
 */
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
    case "mark":
    case "text": {
      const selection = hit.selection ?? [];
      if (hit.drawingId === null || hit.drawingId === undefined || hit.layoutName === null || hit.layoutName === undefined || selection.length === 0) {
        return hit.kind === "mark" ? registerRoute(tenantId, hit.projectId) : drawingsRoute(tenantId, hit.projectId);
      }
      return selectionAddress(tenantId, hit.projectId, { drawingId: hit.drawingId, layoutName: hit.layoutName, sourceKeys: selection });
    }
  }
}

/** How a find names the sheet it stands on: its number, else model space in words (I-179). */
function sheetSaid(hit: SearchHit): string {
  return hit.sheetLabel ?? strings.command_palette_model_space;
}

/** A find's second line, composed from what the server placed it by — never a sentence of the server's. */
function metaOfHit(hit: SearchHit): string | null {
  if (hit.kind === "text") {
    return fill(strings.command_palette_meta_text, { sheet: sheetSaid(hit), drawing: hit.drawingName ?? "" });
  }
  if (hit.kind === "mark") {
    const said = { class: humaniseEnum(hit.elementType ?? ""), count: formatUserFigure(String(hit.count ?? 0)) };
    const placed = hit.drawingId !== null && hit.drawingId !== undefined && hit.layoutName !== null && hit.layoutName !== undefined;
    return placed ? fill(strings.command_palette_meta_mark, { ...said, sheet: sheetSaid(hit) }) : fill(strings.command_palette_meta_mark_unplaced, said);
  }
  return hit.meta ?? null;
}

/** A text find's label: what the sheet says, marked where the row shows only part of it. */
function labelOfHit(hit: SearchHit): string {
  if (hit.kind !== "text") return hit.label;
  const elided = strings.command_palette_elision;
  return `${hit.clippedStart === true ? elided : ""}${hit.label}${hit.clippedEnd === true ? elided : ""}`;
}

/**
 * One answered hit, as a row of the navigate group. Its key names where the row leads: a sheet's
 * texts share a drawing and a layout, so a find's own source key keeps it apart (a mark's class too,
 * where two classes share a mark). Two hits keyed alike therefore lead to one place — `rowsOfHits`
 * keeps the first of them.
 */
export function rowOfHit(tenantId: string, hit: SearchHit): PaletteRow {
  const find = hit.kind === "mark" || hit.kind === "text" ? `:${hit.sourceKey ?? ""}:${hit.kind === "mark" ? `${hit.label}:${hit.elementType ?? ""}` : ""}` : "";
  return {
    key: `${hit.kind}:${hit.projectId}:${hit.drawingId ?? ""}:${hit.setId ?? ""}:${hit.layoutName ?? ""}${find}`,
    group: "navigate",
    kind: hit.kind,
    label: labelOfHit(hit),
    meta: metaOfHit(hit),
    href: hrefOfHit(tenantId, hit),
  };
}

/**
 * An answer's hits, as the navigate group's rows — one row per key, the first hit standing for it.
 * The pattern names an option by its key (`optionId`, `aria-activedescendant`), so two rows keyed
 * alike would be one option twice: React would drop one, and the arrows, walking by that id, could
 * never pass the pair. Such rows lead to the same place, so the second adds nothing a person can use
 * (I-475). The door already answers a sheet's text once per key; this holds for any answer.
 */
export function rowsOfHits(tenantId: string, hits: readonly SearchHit[]): PaletteRow[] {
  const rows = new Map<string, PaletteRow>();
  for (const hit of hits) {
    const row = rowOfHit(tenantId, hit);
    if (!rows.has(row.key)) rows.set(row.key, row);
  }
  return [...rows.values()];
}
