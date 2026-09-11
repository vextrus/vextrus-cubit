"use client";
// The 48 px icon rail (Direction §1; R-UI-080): "Rail 48 px, icons only, labels in tooltips (expand
// to 220 on hover-hold or pin; remembered). The quiet mark at 26 px at the top of the rail
// (R-UI-070). Selection = 3 px inset beam bar + beam-100 fill (R-UI-030, unchanged)."
//
// Selection follows the URL and nothing else (R-UI-031) — the area is handed in, and the selected
// row says so twice: `aria-current` for a reader, and the beam bar and fill for an eye.
//
// The label is in the DOM in BOTH states. At 48 px it is clipped out of sight and the tooltip is
// what an eye reads, but the row keeps its accessible name either way: an icon-only link whose name
// lived in a tooltip would answer to nothing a speech-input user could say (WCAG 2.5.3), and the
// former rail's answer to that — emptying itself when narrow — left the product with no navigation
// at all at 48 px.
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { QuietMark } from "../brand-usage";
import { Tooltip } from "../primitives/core";
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

/** Where the pin is remembered. Held in this browser, as the theme is: a rail width is a property
    of the screen a person is sitting at, not of the work their account holds (theme-toggle §1). */
const PINNED = "cx-rail-pinned";

/** The hold before a hover opens the rail (Direction §1, "hover-hold"): long enough that a pointer
    crossing the rail on its way somewhere else never opens it, short enough to feel deliberate. */
export const HOVER_HOLD_MS = 300;

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
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "M7.5 2.5 4 6l3.5 3.5" : "M2.5 4.5 6 8l3.5-3.5"} />
    </svg>
  );
}

/**
 * The three area icons: one stroke set, 16 px box, 1.5 px stroke, `currentColor` (Direction §1's
 * iconography row). Drawn here rather than vendored because no icon package is installed and
 * installing one is a new decision, not an assumption (AM-08); they are geometry, never a glyph
 * stand-in (R-UI-002 keeps the basis glyphs, and these are not them).
 */
const ICON_PATH: Readonly<Record<ShellArea, string>> = {
  // A stack of sheets: what a project holds.
  projects: "M2.5 4.5h11v8h-11zM2.5 4.5 5 2.5h6l2.5 2M6 8.5h4",
  // A ledger standing on its spine.
  books: "M3.5 2.5h9v11h-9zM3.5 5.5h9M6.5 2.5v11",
  // A dial with its detent.
  settings: "M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4",
};

function AreaIcon({ area }: { area: ShellArea }) {
  return (
    <svg
      className="cx-shell-nav-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICON_PATH[area]} />
    </svg>
  );
}

export function ShellRail({ workspace, workspaces, area, atAreaHome }: ShellRailProps) {
  // The workspace the frame is showing always stands among the offered ones, so the menu can never
  // be empty and never omits where the reader currently is.
  const offered = workspaces === undefined || workspaces.length === 0 ? [workspace] : workspaces;
  // The pin is the person's answer and it is remembered (Direction §1). Read after mount, never
  // during render: the server renders the rail closed, and reading this browser's answer during the
  // first render would be a hydration mismatch on every machine that holds one.
  const [pinned, setPinned] = useState(false);
  const [held, setHeld] = useState(false);
  const [focused, setFocused] = useState(false);
  const holding = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyId = useId();

  useEffect(() => {
    try {
      setPinned(window.localStorage.getItem(PINNED) === "true");
    } catch {
      // A browser that refuses storage keeps the closed rail, which is the Direction's own default.
    }
    return () => {
      if (holding.current !== null) clearTimeout(holding.current);
    };
  }, []);

  function pin(next: boolean): void {
    setPinned(next);
    try {
      window.localStorage.setItem(PINNED, String(next));
    } catch {
      // The rail still opens; the answer simply does not outlive the tab.
    }
  }

  function hold(): void {
    if (holding.current !== null) clearTimeout(holding.current);
    holding.current = setTimeout(() => setHeld(true), HOVER_HOLD_MS);
  }

  function release(): void {
    if (holding.current !== null) clearTimeout(holding.current);
    holding.current = null;
    setHeld(false);
  }

  // Focus opens it too: a hover-hold is a pointer gesture, and a keyboard has no pointer to hold.
  const expanded = pinned || held || focused;

  return (
    // A landmark, not a bare box: the pin and the switcher are the rail's own controls, and in a div
    // they hang at the document root, outside every region a reader tours by. The inspector is the
    // frame's other complementary region, and the two carry different names.
    <aside
      className="cx-shell-rail"
      data-testid="shell-rail"
      // The attribute the frame has always published, with the meaning it has always had: `true` is
      // the narrow rail. It is the 48 px one now rather than an emptied 48 px one.
      data-collapsed={expanded ? "false" : "true"}
      aria-label={strings.shell_rail_label}
      onPointerEnter={hold}
      onPointerLeave={release}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="cx-shell-rail-top">
        {/* Decorative (R-UI-070, I-16): the mark names the product, and the document already does. */}
        <span className="cx-shell-rail-mark" data-testid="shell-rail-mark" aria-hidden="true">
          <QuietMark />
        </span>
        {/* The pin. One name in both states — `aria-pressed` is what carries whether it is held, so
            a speech-input user says the same words either way (WCAG 2.5.3). The id is the one the
            frame has always published for this control. */}
        <button
          type="button"
          className="cx-shell-rail-toggle cx-reticle"
          data-testid="shell-rail-collapse"
          aria-label={strings.shell_rail_pin_label}
          aria-pressed={pinned}
          aria-controls={bodyId}
          onClick={() => pin(!pinned)}
        >
          <Chevron direction="left" />
        </button>
      </div>

      {/* The rail's body, mounted in both states: at 48 px it shows icons and clips its labels, and
          it no longer empties itself — a rail with nothing in it is not navigation (Direction §1). */}
      <div className="cx-shell-rail-body" id={bodyId}>
        {/* `modal={false}`: the modal treatment marks the rest of the frame `aria-hidden` while
            leaving its links focusable, which axe reports as a serious `aria-hidden-focus` — and
            Q-11 admits no serious violation at any checkpoint. Nothing here needs the page inert:
            the menu still dismisses on an outside press and on Escape. */}
        <DropdownMenu modal={false}>
          {/* No `aria-label` here: the workspace name is the trigger's only text, so an override
              would leave a speech-input user saying a name the control does not answer to (WCAG
              2.5.3, label-in-name). The purpose is carried by the menu it opens. */}
          <DropdownMenuTrigger className="cx-shell-switcher" data-testid="shell-tenant-switcher">
            {/* The workspace's own initial is what stands at 48 px: an identity, not a decoration. */}
            <span className="cx-shell-switcher-initial" aria-hidden="true">
              {[...workspaceLabel(workspace)][0] ?? ""}
            </span>
            <span className="cx-shell-switcher-name">{workspaceLabel(workspace)}</span>
            <Chevron direction="down" />
          </DropdownMenuTrigger>
          {/* Portalled where the shipped DropdownMenu portals every menu (§ I-22): the open menu at
              the document root is an axe `region` finding of moderate impact, reported by the design
              lane and below the serious/critical threshold Q-11 fixes for a checkpoint. */}
          <DropdownMenuContent align="start" aria-label={strings.shell_tenant_switcher_label}>
            {offered.map((held_) => (
              <DropdownMenuItem asChild key={held_.tenantId}>
                <Link className="cx-shell-menu-item" href={shellHref(held_.tenantId, "projects")}>
                  {workspaceLabel(held_)}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <nav className="cx-shell-nav" aria-label={strings.shell_rail_nav_label}>
          {ENTRIES.map((entry) => (
            <Tooltip content={entry.label} key={entry.area}>
              <Link
                className="cx-shell-nav-row cx-reticle"
                data-testid={entry.testId}
                href={shellHref(workspace.tenantId, entry.area)}
                // The row states what is true of the address: at the area's own home it is the page,
                // and on a screen deeper inside the area it is the current item of the set — an
                // ancestor, not this page. Both wear the selection paint; only one claims to be
                // where the reader is (Q-11).
                aria-current={entry.area === area ? (atAreaHome ? "page" : "true") : undefined}
              >
                <AreaIcon area={entry.area} />
                <span className="cx-shell-nav-label">{entry.label}</span>
              </Link>
            </Tooltip>
          ))}
        </nav>
      </div>
    </aside>
  );
}
