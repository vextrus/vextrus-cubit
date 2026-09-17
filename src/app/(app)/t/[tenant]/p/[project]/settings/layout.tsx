"use client";
// The project's settings FRAME (sub-navigation I-258): one layout over `PROJECT_SETTINGS_AREAS`,
// wrapping every area's own screen. Three screens used to render the same nav by each calling
// `SettingsPane` with a roster of its own — the second spelling B-17 forbids, and the reason the nav
// could disagree with itself between two areas.
//
// I-260: the current row is decided by the segment. A layout cannot read the address on the server,
// so the frame is a client component and asks `useSelectedLayoutSegment()`; `children` are still
// server-rendered and pass straight through.
// The template's own chrome — the 160 px nav, the content pane and the seam between them — has one
// home, and this frame renders inside it rather than restating its rules (s-settings I-198, B-17).
import "../../../settings/settings.css";

import { useSelectedLayoutSegment } from "next/navigation";
import Link from "next/link";
import { use, type ReactNode } from "react";
import { Tooltip } from "@/ui/primitives/core";
import { TESTIDS } from "@/ui/testids";
import { PROJECT_SETTINGS_AREAS } from "./areas";
import { projectSettingsStrings } from "./strings";

/**
 * The section nav: one row per roster entry, in the roster's order, built or not. An area with an
 * address is a link; one with none is a disabled span with its reason a hover or a focus away
 * (I-259). Exactly one row says where the reader is — the one whose area IS the segment — and no row
 * says so when the segment names no area of the roster: `aria-current` is a claim, not a position.
 */
export function ProjectSettingsNav({ tenantId, projectId, segment }: { tenantId: string; projectId: string; segment: string | null }) {
  return (
    <nav className="cx-settings-nav" aria-label={projectSettingsStrings.project_settings_nav_label}>
      <ul className="cx-settings-nav-list">
        {PROJECT_SETTINGS_AREAS.map((entry) => (
          <li className="cx-settings-nav-row" key={entry.area}>
            {entry.route === null ? (
              // A promise, not a control — and it keeps its tab stop, so the reason it does nothing
              // is reachable by keyboard as well as by pointer (Q-11).
              <Tooltip content={projectSettingsStrings.project_settings_unbuilt}>
                <span
                  className="cx-settings-nav-item cx-reticle"
                  data-testid={TESTIDS.settings.area}
                  data-area={entry.area}
                  data-unbuilt="true"
                  aria-disabled="true"
                  tabIndex={0}
                >
                  {entry.label}
                </span>
              </Tooltip>
            ) : (
              <Link
                className="cx-settings-nav-item cx-reticle"
                data-testid={TESTIDS.settings.area}
                data-area={entry.area}
                href={entry.route(tenantId, projectId)}
                aria-current={entry.area === segment ? "page" : undefined}
              >
                {entry.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function ProjectSettingsLayout({ children, params }: { children: ReactNode; params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = use(params);
  const segment = useSelectedLayoutSegment();
  return (
    <div className="cx-settings">
      <ProjectSettingsNav tenantId={tenant} projectId={project} segment={segment} />
      <div className="cx-settings-content">{children}</div>
    </div>
  );
}
