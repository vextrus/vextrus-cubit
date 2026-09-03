"use client";
// R-UI-030's left rail: the quiet mark, the workspace switcher, the three areas, and the collapse.
// Selection follows the URL and nothing else (R-UI-031) — the area is handed in, and the selected
// row says so twice: `aria-current` for a reader, and the beam bar and fill for an eye.
import Link from "next/link";
import { useId, useState } from "react";
import { QuietMark } from "../brand-usage";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../primitives/overlay";
import { strings } from "../strings";
import { SHELL_AREAS, areaLabel, shellHref, workspaceLabel, type ShellArea, type ShellWorkspace } from "./routes";

export interface ShellRailProps {
  workspace: ShellWorkspace;
  /**
   * Every workspace the account holds, which is what the switcher offers (R-SPINE-003: one user,
   * many tenants). Optional because the frame holds no membership of its own: a caller that names
   * none is showing the one workspace it was handed, which is what a single membership answers.
   */
  workspaces?: readonly ShellWorkspace[];
  area: ShellArea;
  /** Whether the address is the area's own home; a deeper screen makes the row an ancestor. */
  atAreaHome: boolean;
}

interface RailEntry {
  area: ShellArea;
  testId: string;
  label: string;
}

/** The hook each area's row is found by. Total over the roster, so a new area cannot be forgotten. */
const TEST_ID: Readonly<Record<ShellArea, string>> = {
  projects: "shell-nav-projects",
  books: "shell-nav-books",
  settings: "shell-nav-settings",
};

/**
 * The areas the rail carries, in the order the roster (R-UI-030's order) names them. The words come
 * from `areaLabel`, the one home the breadcrumb reads them from too, so a row and its crumb can
 * never call the same area two different things (B-17).
 */
const ENTRIES: readonly RailEntry[] = SHELL_AREAS.map((area) => ({ area, testId: TEST_ID[area], label: areaLabel(area) }));

/** The rail's one glyph, in the two directions it points. Decorative: the control carries the name. */
function Chevron({ direction }: { direction: "left" | "down" }) {
  return (
    <svg
      className="cx-shell-rail-chevron"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="var(--graphite-600)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "M7.5 2.5 4 6l3.5 3.5" : "M2.5 4.5 6 8l3.5-3.5"} />
    </svg>
  );
}

export function ShellRail({ workspace, workspaces, area, atAreaHome }: ShellRailProps) {
  // The workspace the frame is showing always stands among the offered ones, so the menu can never
  // be empty and never omits where the reader currently is.
  const offered = workspaces === undefined || workspaces.length === 0 ? [workspace] : workspaces;
  // Not persisted across sessions: nothing in the product writes a per-person preference, and a
  // remembered width nothing can write would be a promise it does not keep. It does have to hold
  // for the very next click, though — the rail navigates with `next/link`, so the frame's layout
  // (and this state with it) survives every move between the areas rather than being re-mounted
  // expanded by a fresh document load.
  const [expanded, setExpanded] = useState(true);
  // What the toggle discloses is the rail's body — the switcher and the areas — not the rail
  // itself: `aria-controls` naming the ancestor the control sits inside points a reader at the
  // region it is already in. The body element is mounted whether or not it holds anything, so the
  // reference resolves in both states.
  const bodyId = useId();

  return (
    // A landmark, not a bare box: the collapse and the switcher are the rail's own controls, and in
    // a div they hang at the document root, outside every region a reader tours by. The inspector
    // is the frame's other complementary region, and the two carry different names.
    <aside
      className="cx-shell-rail"
      data-testid="shell-rail"
      data-collapsed={expanded ? "false" : "true"}
      aria-label={strings.shell_rail_label}
    >
      <div className="cx-shell-rail-top">
        {/* Decorative (R-UI-070, I-16): the mark names the product, and the document already does. */}
        <span className="cx-shell-rail-mark" data-testid="shell-rail-mark" aria-hidden="true">
          <QuietMark />
        </span>
        <button
          type="button"
          className="cx-shell-rail-toggle cx-reticle"
          data-testid="shell-rail-collapse"
          aria-label={strings.shell_rail_collapse_label}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((open) => !open)}
        >
          <Chevron direction="left" />
        </button>
      </div>

      {/* The disclosed region itself, and the toggle's `aria-controls` target. Collapsed, the rail
          keeps only what stays legible at 48 px: the labels have no icon stand-ins, and a column of
          truncated letters would be guesswork, not navigation — so the body empties rather than
          unmounting, which is also what keeps the reference resolvable in both states. */}
      <div className="cx-shell-rail-body" id={bodyId}>
        {expanded ? (
          <>
            {/* `modal={false}`: the modal treatment marks the rest of the frame `aria-hidden` while
                leaving its links focusable, which axe reports as a serious `aria-hidden-focus` — and
                Q-11 admits no serious violation at any checkpoint. Nothing here needs the page
                inert: the menu still dismisses on an outside press and on Escape. */}
            <DropdownMenu modal={false}>
              {/* No `aria-label` here: the workspace name is the trigger's only visible text, so an
                  override would leave a speech-input user saying a name the control does not answer
                  to (WCAG 2.5.3, label-in-name). The purpose is carried by the menu it opens. */}
              <DropdownMenuTrigger className="cx-shell-switcher" data-testid="shell-tenant-switcher">
                <span className="cx-shell-switcher-name">{workspaceLabel(workspace)}</span>
                <Chevron direction="down" />
              </DropdownMenuTrigger>
              {/* The memberships the seam answers with. Portalled where the shipped DropdownMenu
                  portals every menu (§ I-22): the open menu at the document root is an axe `region`
                  finding of moderate impact, reported by the design lane and below the
                  serious/critical threshold Q-11 fixes for a checkpoint. */}
              <DropdownMenuContent align="start" aria-label={strings.shell_tenant_switcher_label}>
                {offered.map((held) => (
                  <DropdownMenuItem asChild key={held.tenantId}>
                    <Link className="cx-shell-menu-item" href={shellHref(held.tenantId, "projects")}>
                      {workspaceLabel(held)}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <nav className="cx-shell-nav" aria-label={strings.shell_rail_nav_label}>
              {ENTRIES.map((entry) => (
                <Link
                  key={entry.area}
                  className="cx-shell-nav-row cx-reticle"
                  data-testid={entry.testId}
                  href={shellHref(workspace.tenantId, entry.area)}
                  // The row states what is true of the address: at the area's own home it is the
                  // page, and on a screen deeper inside the area it is the current item of the set
                  // — an ancestor, not this page. Both wear the selection paint; only one claims to
                  // be where the reader is (Q-11).
                  aria-current={entry.area === area ? (atAreaHome ? "page" : "true") : undefined}
                >
                  {entry.label}
                </Link>
              ))}
            </nav>
          </>
        ) : null}
      </div>
    </aside>
  );
}
