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
import "@/app/(app)/t/[tenant]/settings/settings.css";

import { useSelectedLayoutSegment } from "next/navigation";
import { use, type ReactNode } from "react";
import { TESTIDS } from "@/ui/testids";
import { SettingsPane, type SettingsNavItem } from "@/app/(app)/t/[tenant]/settings/settings-pane";
import { PROJECT_SETTINGS_AREAS } from "./areas";
import { projectSettingsStrings } from "./strings";

/**
 * The roster as the template's nav reads it: one item per area, in the roster's order, built or not.
 * An area with an address is a place and one with none is a promise — availability is READ off
 * `route` and never written beside a row (I-259). The rows themselves are drawn by `SettingsPane`,
 * which is the one home of the settings frame's chrome (s-settings I-198, B-17): a second spelling
 * of that markup here is what let two navs of one product disagree.
 */
export function projectSettingsNavItems(tenantId: string, projectId: string): readonly SettingsNavItem[] {
  return PROJECT_SETTINGS_AREAS.map((entry) => ({
    key: entry.area,
    label: entry.label,
    href: entry.route === null ? null : entry.route(tenantId, projectId),
    testId: TESTIDS.settings.area,
  }));
}

export default function ProjectSettingsLayout({ children, params }: { children: ReactNode; params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = use(params);
  // I-260: the current row is decided by the segment, which only a client component can read; no row
  // says where the reader is when the segment names no area of the roster — `aria-current` is a
  // claim, not a position.
  const segment = useSelectedLayoutSegment();
  return (
    <SettingsPane
      items={projectSettingsNavItems(tenant, project)}
      active={segment ?? ""}
      navLabel={projectSettingsStrings.project_settings_nav_label}
      unbuiltHint={projectSettingsStrings.project_settings_unbuilt}
    >
      {children}
    </SettingsPane>
  );
}
