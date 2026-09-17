"use client";
// The project settings FRAME, drawn once for every screen under `settings/` (I-RSA-3). It was four
// screens each rendering `SettingsPane` over a roster respelled beside it; the frame is the layout's
// now, so the nav has one home and a screen below it is the component a suite mounts on its own
// (B-17).
//
// It is a client component for exactly one reason: the row a reader is STANDING in is a fact about
// the address, and a server layout is not re-rendered per child segment — so it cannot read it. The
// router's own `useSelectedLayoutSegment` is that reading, and it is the whole of what this
// component does with it (R-UI-031: the route says where the reader is, and nothing else does).
import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";
import { SettingsPane, type SettingsNavItem } from "@/app/(app)/t/[tenant]/settings/settings-pane";
import { TESTIDS } from "@/ui/testids";
import { PROJECT_SETTINGS_AREAS } from "./areas";
import { projectSettingsStrings } from "./strings";

export interface ProjectSettingsFrameProps {
  tenantId: string;
  projectId: string;
  children: ReactNode;
}

/** The roster as the pane takes it: availability read off each area's `route` and nowhere else. */
function navItems(tenantId: string, projectId: string): readonly SettingsNavItem[] {
  return PROJECT_SETTINGS_AREAS.map((area) => ({
    key: area.key,
    label: area.label,
    href: area.route === null ? null : area.route(tenantId, projectId),
    testId: TESTIDS.settings.area,
  }));
}

export function ProjectSettingsFrame({ tenantId, projectId, children }: ProjectSettingsFrameProps) {
  // The child segment IS the area key: every screen under `settings/` answers at a directory whose
  // name is the key its row carries, so the two cannot drift. An address with no child segment
  // matches no row, and the nav then claims nothing rather than guessing a default.
  const segment = useSelectedLayoutSegment();
  return (
    <SettingsPane items={navItems(tenantId, projectId)} active={segment ?? ""} label={projectSettingsStrings.project_settings_nav_label}>
      {children}
    </SettingsPane>
  );
}
