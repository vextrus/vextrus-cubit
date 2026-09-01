// R-UI-030's frame, assembled: the rail, the top bar over the routed screen, and the inspector
// beside it. The frame holds no data of its own — it is handed the workspace it is showing, the
// area the URL is in, and the account it belongs to, and every screen renders inside it.
import type { ReactNode } from "react";
import type { Density } from "../../core/prefs";
import { ShellInspector } from "./shell-inspector";
import { ShellRail } from "./shell-rail";
import { ShellTopBar } from "./shell-top-bar";
import type { ShellArea, ShellWorkspace } from "./routes";

export interface AppShellProps {
  workspace: ShellWorkspace;
  /** Every workspace the account holds, which is what the rail's switcher offers (R-SPINE-003). */
  workspaces?: readonly ShellWorkspace[];
  area: ShellArea;
  /** Whether the address is the area's own home, or a screen inside it — see `isAreaHome`. */
  atAreaHome: boolean;
  email: string | null;
  /**
   * The mode this account's tables are drawn at (R-UI-005), read from SEAM-PREFS above the frame.
   * Optional because the frame holds no preference of its own: a caller that names none gets the
   * same answer the seam gives an account that never chose.
   */
  density?: Density;
  signOut: () => void | Promise<void>;
  children: ReactNode;
}

export function AppShell({ workspace, workspaces, area, atAreaHome, email, density = "comfortable", signOut, children }: AppShellProps) {
  return (
    // The stored mode is published once, here, so every table-bearing screen inside the frame reads
    // one source of truth rather than each asking the seam for itself (R-UI-005).
    <div className="cx-shell" data-testid="shell-root" data-density={density}>
      <ShellRail workspace={workspace} workspaces={workspaces} area={area} atAreaHome={atAreaHome} />
      <div className="cx-shell-body">
        <ShellTopBar workspace={workspace} area={area} atAreaHome={atAreaHome} email={email} signOut={signOut} />
        <div className="cx-shell-content">
          <main className="cx-shell-main" data-testid="shell-main">
            {children}
          </main>
          <ShellInspector />
        </div>
      </div>
    </div>
  );
}
