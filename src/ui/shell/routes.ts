// The frame's areas and the addresses they live at (R-UI-031): the URL is the source of truth, so
// the mapping between an address and the entry that is selected has one home — the rail, the
// breadcrumb and the routes themselves all read it from here rather than each spelling `/t/…`.
import { strings } from "../strings";

/** The workspace the frame is showing: the uuid its address names it by, and the name it wears. */
export interface ShellWorkspace {
  tenantId: string;
  name: string;
}

/**
 * What "something visible in it" means, in the one place that decides it (I-22, B-17): the door
 * that refuses a blank name and the label that falls back both read this answer, so they can never
 * disagree about the same string.
 *
 * `trim()` is not the standard: it strips only the ECMAScript whitespace set, so a name of a single
 * U+200B ZERO WIDTH SPACE survives it and paints a link with no glyph in it — exactly the Q-11
 * failure the fallback exists to prevent. What is removed here is everything a font draws nothing
 * for: whitespace, the Unicode format characters (`Cf`, which covers ZWSP, ZWNJ, ZWJ and the BOM),
 * controls and lone surrogates, plus the blank-by-design glyphs that are letters or symbols by
 * category — the Hangul fillers, the Khmer invisible vowels and the empty Braille cell.
 */
const NOTHING_VISIBLE = /[\p{White_Space}\p{Cf}\p{Cc}\p{Cs}]|\u115F|\u1160|\u17B4|\u17B5|\u2800|\u3164/gu;

/** Whether a string a person typed shows anything at all — the perceptual standard I-22 states. */
export function hasVisibleText(value: string): boolean {
  return value.replace(NOTHING_VISIBLE, "") !== "";
}

/**
 * The name a workspace is shown by, in one home for every place the frame paints it. A stored name
 * is taken as the person presented it (s-auth I-13), so it can hold nothing visible; painting that
 * raw would leave the breadcrumb link with no discernible name — a serious Q-11 violation written
 * from data. Nothing is invented: a name that says something is shown as it stands.
 */
export function workspaceLabel(workspace: ShellWorkspace): string {
  return hasVisibleText(workspace.name) ? workspace.name : strings.shell_workspace_unnamed;
}

/**
 * The areas the shell ships, in the order R-UI-030 names them. Each is one rail entry, one address
 * and one breadcrumb crumb — and this is their one home (B-17): the rail's entries, the state
 * matrix's rows and the suite that reflects over it all read the roster from here, so adding a
 * fourth area is one edit rather than four lists that can drift apart.
 */
export const SHELL_AREAS = ["projects", "books", "settings"] as const;

/** The area type, derived from the roster so the two can never name different sets. */
export type ShellArea = (typeof SHELL_AREAS)[number];

/**
 * What each area is called, in the one home every surface that names an area reads (B-17): the rail
 * entry and the breadcrumb crumb wear the same words because they ask the same function for them,
 * and the words themselves stay the string table's (R-UI-030, Q-11).
 */
const AREA_LABEL: Readonly<Record<ShellArea, string>> = {
  projects: strings.shell_nav_projects,
  books: strings.shell_nav_books,
  settings: strings.shell_nav_settings,
};

/** The name an area is shown by, wherever the frame names it. */
export function areaLabel(area: ShellArea): string {
  return AREA_LABEL[area];
}

/** The address of an area within a workspace — Projects is the workspace's own home. */
export function shellHref(tenantId: string, area: ShellArea): string {
  const home = `/t/${tenantId}`;
  return area === "projects" ? home : `${home}/${area}`;
}

/**
 * The workspace an address is inside: the segment `/t/<segment>` names, and null for an address that
 * names no workspace at all. One home for reading the URL's own truth about which workspace a
 * reader is in (R-UI-031, B-17).
 */
export function workspaceOf(pathname: string | null): string | null {
  if (pathname === null) return null;
  const match = /^\/t\/([^/]+)(?:\/|$)/.exec(pathname);
  return match === null ? null : (match[1] ?? null);
}

/** Which area an address is in. Anything under a workspace that names no area is its Projects home. */
export function areaOf(pathname: string | null): ShellArea {
  if (pathname === null) return "projects";
  const trailing = pathname.replace(/\/+$/, "");
  if (trailing.endsWith("/books")) return "books";
  if (trailing.endsWith("/settings")) return "settings";
  return "projects";
}

/**
 * Whether an address IS the area's own home, or a screen that merely lives inside it — the other
 * half of the selection reading, in the same home as the mapping it refines (B-17).
 *
 * `aria-current="page"` is a claim about THIS page, and the rail entry points at the area's home:
 * on a screen deeper in the area (a project's settings, say) that claim names an address the
 * reader is not at, and the frame would state it twice — once in the rail and once in the crumb.
 * What is true there is `aria-current="true"`: the current item of the set, an ancestor rather
 * than the page (Q-11, R-UI-031).
 */
export function isAreaHome(pathname: string | null, tenantId: string): boolean {
  // The address must be inside the workspace the caller names before any claim is made about it:
  // the frame reads the pathname and the tenant from two sources (the router and the loaded
  // workspace), and during a move between workspaces they disagree for a render. A foreign address
  // is answered false rather than thrown at — a transient mismatch may not tear the layout down.
  if (pathname === null || workspaceOf(pathname) !== tenantId) return false;
  return pathname.replace(/\/+$/, "") === shellHref(tenantId, areaOf(pathname));
}
