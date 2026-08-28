"use client";
// R-UI-030's left rail: the quiet mark, the workspace switcher, the three areas, and the collapse.
// Selection follows the URL and nothing else (R-UI-031) — the area is handed in, and the selected
// row says so twice: `aria-current="page"` for a reader, and the beam bar and fill for an eye.
import { useId, useState } from "react";
import { QuietMark } from "../brand-usage";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../primitives/overlay";
import { strings } from "../strings";
import { shellHref, workspaceLabel, type ShellArea, type ShellWorkspace } from "./routes";

export interface ShellRailProps {
  workspace: ShellWorkspace;
  area: ShellArea;
}

interface RailEntry {
  area: ShellArea;
  testId: string;
  label: string;
}

/** The areas the rail carries, in the order R-UI-030 names them. */
const ENTRIES: readonly RailEntry[] = [
  { area: "projects", testId: "shell-nav-projects", label: strings.shell_nav_projects },
  { area: "books", testId: "shell-nav-books", label: strings.shell_nav_books },
  { area: "settings", testId: "shell-nav-settings", label: strings.shell_nav_settings },
];

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

export function ShellRail({ workspace, area }: ShellRailProps) {
  // Not persisted: nothing in the product writes a per-person preference, and a remembered
  // width nothing can write would be a promise it does not keep.
  const [expanded, setExpanded] = useState(true);
  const railId = useId();

  return (
    // A landmark, not a bare box: the collapse and the switcher are the rail's own controls, and in
    // a div they hang at the document root, outside every region a reader tours by. The inspector
    // is the frame's other complementary region, and the two carry different names.
    <aside
      className="cx-shell-rail"
      data-testid="shell-rail"
      id={railId}
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
          aria-controls={railId}
          onClick={() => setExpanded((open) => !open)}
        >
          <Chevron direction="left" />
        </button>
      </div>

      {/* Collapsed, the rail keeps only what stays legible at 48 px: the labels have no icon
          stand-ins, and a column of truncated letters would be guesswork, not navigation. */}
      {expanded ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="cx-shell-switcher"
              data-testid="shell-tenant-switcher"
              aria-label={strings.shell_tenant_switcher_label}
            >
              <span className="cx-shell-switcher-name">{workspaceLabel(workspace)}</span>
              <Chevron direction="down" />
            </DropdownMenuTrigger>
            {/* The memberships the seam answers with — one, today. */}
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <a className="cx-shell-menu-item" href={shellHref(workspace.tenantId, "projects")}>
                  {workspaceLabel(workspace)}
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <nav className="cx-shell-nav" aria-label={strings.shell_rail_nav_label}>
            {ENTRIES.map((entry) => (
              <a
                key={entry.area}
                className="cx-shell-nav-row cx-reticle"
                data-testid={entry.testId}
                href={shellHref(workspace.tenantId, entry.area)}
                aria-current={entry.area === area ? "page" : undefined}
              >
                {entry.label}
              </a>
            ))}
          </nav>
        </>
      ) : null}
    </aside>
  );
}
