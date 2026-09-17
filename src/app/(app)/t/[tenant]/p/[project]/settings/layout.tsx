"use client";
// The project settings FRAME. Every screen under `/t/{tenant}/p/{project}/settings` is drawn in the
// one settings template (`SettingsPane`, Design Direction 00 §3.6), and this layout is where that
// happens — once, over `PROJECT_SETTINGS_AREAS`, rather than in each page (B-17). A page below it
// renders its own content and nothing of the frame; `projectSettingsNav`, the second spelling of
// this roster, is gone with it.
//
// The nav's rows are derived from the roster: an area with a `route` becomes a link at that address,
// and an area with none is shown disabled with its reason. Nothing about availability is written
// beside a row (the `home/areas.ts` law).
//
// This is a CLIENT layout, and that is the whole of why: which row a reader is standing in is a
// fact about the address, and a server layout is rendered for every child alike — it is handed no
// pathname and may not read one. `useSelectedLayoutSegment()` is the router's own answer to
// "which child is rendered", which is exactly the question `aria-current="page"` asks (R-UI-031).
// The layout holds no other state, and `children` are server-rendered and pass through untouched.
import { use, type ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { TESTIDS } from "@/ui/testids";
import { SettingsPane, type SettingsNavItem } from "@/app/(app)/t/[tenant]/settings/settings-pane";
import { PROJECT_SETTINGS_AREAS } from "./areas";

export default function ProjectSettingsLayout({ children, params }: { children: ReactNode; params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = use(params);
  const segment = useSelectedLayoutSegment();
  const items: readonly SettingsNavItem[] = PROJECT_SETTINGS_AREAS.map((area) => ({
    key: area.key,
    label: area.label,
    href: area.route === null ? null : area.route(tenant, project),
    testId: TESTIDS.settings.area,
  }));
  // A segment naming no area of the roster leaves no row current — an address inside this frame the
  // roster does not know about is not somewhere the nav may claim the reader is (Q-11).
  return (
    <SettingsPane items={items} active={segment ?? ""}>
      {children}
    </SettingsPane>
  );
}
