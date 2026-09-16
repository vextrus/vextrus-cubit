// The takeoff lane's frame (docs/design/s-takeoff.md § 1, Design Direction 00 §3.2): the 40 px tabs
// row above whatever surface of the lane a reader is standing on. The row is the lane's one home for
// where its surfaces are, and every entry's address is asked of the route builder that owns it
// (B-17). The surface standing inside it mounts the right-hand half — the pinned revision and the one
// primary — through the row's own slot (`useTakeoffTabsAside`), so the lane draws ONE row and no
// screen draws a second one above the grid.
import "./takeoff.css";

import { coverageRoute } from "./coverage/route-address";
import { COVERAGE_COPY } from "@/modules/takeoff/coverage/copy";
import { levelsRoute } from "./levels/route-address";
import { registerRoute } from "./register/route-address";
import { schedulesRoute } from "./schedules/route-address";
import { strings } from "@/ui/strings";
import { TakeoffTabs } from "./nav";
import { TESTIDS } from "@/ui/testids";

export default async function TakeoffLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string; project: string }>;
}) {
  const { tenant, project } = await params;
  return (
    <>
      {/* The coverage entry's label is the coverage module's own (I-197); the register's is the
          lane's shared table, where it already stood; the levels entry's is S-Levels' own table,
          which is where that screen's copy lives (s-levels.md §3). Each address is asked of the
          builder that owns it (B-17). */}
      <TakeoffTabs
        entries={[
          { testId: "takeoff-nav-register", label: strings.takeoff_nav_register, href: registerRoute(tenant, project) },
          { testId: "takeoff-nav-coverage", label: COVERAGE_COPY.takeoff_nav_coverage, href: coverageRoute(tenant, project) },
          { testId: "takeoff-nav-levels", label: strings.takeoff_nav_levels, href: levelsRoute(tenant, project) },
          // The fourth entry's label is S-Schedules' own table, which is where that screen's copy
          // lives (s-schedules.md §3), and its id is read from the one registry that spells ids.
          { testId: TESTIDS.takeoff.navSchedules, label: strings.takeoff_nav_schedules, href: schedulesRoute(tenant, project) },
        ]}
      >
        {children}
      </TakeoffTabs>
    </>
  );
}
