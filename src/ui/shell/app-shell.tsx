"use client";
// R-UI-030's frame, assembled at the Direction's geometry (§1, §3.1): the 48 px icon rail, the
// 40 px top bar over the routed screen, the 24 px status readout under it, and ONE shell-owned
// inspector slot to the right that is absent — width 0 — until something is selected (R-UI-080).
//
// The frame holds no data of its own — it is handed the workspace it is showing, the area the URL
// is in, and the account it belongs to, and every screen renders inside it.
import type { ReactNode } from "react";
import type { Density } from "../../core/prefs";
import { InspectorProvider, ShellInspectorSlot } from "./inspector";
import { ScreenStateProvider, useScreenState } from "./screen-state";
import { ShellRail } from "./shell-rail";
import { ShellTopBar } from "./shell-top-bar";
import { StatusBar, type StatusBarProps } from "./status-bar";
import type { ShellArea, ShellProject, ShellWorkspace } from "./routes";
import { TESTIDS } from "@/ui/testids";

export interface AppShellProps {
  workspace: ShellWorkspace;
  /** Every workspace the account holds, which is what the rail's switcher offers (R-SPINE-003). */
  workspaces?: readonly ShellWorkspace[];
  /** The project the address is inside — the breadcrumb's second crumb (R-UI-084). */
  project?: ShellProject | null;
  /** The siblings the project crumb's ▾ menu offers. */
  projects?: readonly ShellProject[];
  area: ShellArea;
  /** Whether the address is the area's own home, or a screen inside it — see `isAreaHome`. */
  atAreaHome: boolean;
  /** The name of the screen inside the area, when there is one — the breadcrumb's last crumb. */
  page?: string;
  email: string | null;
  /** The account the session belongs to, stated on the top bar — see `ShellTopBarProps.userId`. */
  userId?: string | null;
  /**
   * The mode this account's tables are drawn at (R-UI-005), read from SEAM-PREFS above the frame.
   * Optional because the frame holds no preference of its own: a caller that names none gets the
   * same answer the seam gives an account that never chose.
   */
  density?: Density;
  /** What the readout says. The cells are the screen's own facts; the line is the frame's (§3.1). */
  status?: StatusBarProps;
  /**
   * The screen's own 32 px tool row, mounted in the frame's toolbar track (§1). A screen with no
   * tools hands none, and the track collapses to zero rather than standing as an empty strip — the
   * same law the inspector slot keeps: a region with nothing in it is absent, not a placeholder.
   */
  toolbar?: ReactNode;
  signOut: () => void | Promise<void>;
  children: ReactNode;
}

/**
 * The routed screen's own box, and the attribute the whole journey suite settles on: the root
 * publishes which of R-UI-050's states it is in, so `settled()` waits for a frame that has stopped
 * moving instead of for a timeout (AM-09 §4). It is read inside the provider, which is why it is a
 * component of its own rather than three lines of `AppShell`.
 */
function ShellMain({ children }: { children: ReactNode }) {
  return (
    <main className="cx-shell-main" data-testid={TESTIDS.shell.main} data-state={useScreenState()}>
      {children}
    </main>
  );
}

export function AppShell({
  workspace,
  workspaces,
  project,
  projects,
  area,
  atAreaHome,
  page,
  email,
  userId,
  density = "comfortable",
  status,
  toolbar,
  signOut,
  children,
}: AppShellProps) {
  return (
    // The stored mode is published once, here, so every table-bearing screen inside the frame reads
    // one source of truth rather than each asking the seam for itself (R-UI-005). Density switches
    // the root tokens and nothing per-screen (R-UI-086).
    <ScreenStateProvider>
      <InspectorProvider>
        <div className="cx-shell" data-testid={TESTIDS.shell.root} data-density={density}>
          <ShellRail workspace={workspace} workspaces={workspaces} area={area} atAreaHome={atAreaHome} />
          <div className="cx-shell-body" data-toolbar={toolbar === undefined ? "false" : "true"}>
            <ShellTopBar
              workspace={workspace}
              project={project}
              projects={projects}
              area={area}
              atAreaHome={atAreaHome}
              page={page}
              email={email}
              userId={userId}
              signOut={signOut}
            />
            {/* The track is always the same four rows, so `shell-main` never slides up into the
                toolbar's place on a screen that has no tools; with none, the track is zero high and
                this box holds nothing (`[data-toolbar="false"]`). */}
            <div className="cx-shell-toolbar-slot">{toolbar}</div>
            <ShellMain>{children}</ShellMain>
            <StatusBar {...status} />
          </div>
          {/* The one right slot. It renders nothing at all with nothing selected, so the grid's
              inspector track is zero and the main field takes the width (R-UI-080). */}
          <ShellInspectorSlot />
        </div>
      </InspectorProvider>
    </ScreenStateProvider>
  );
}
