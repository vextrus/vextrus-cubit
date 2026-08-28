// R-UI-030's frame, assembled: the rail, the top bar over the routed screen, and the inspector
// beside it. The frame holds no data of its own — it is handed the workspace it is showing, the
// area the URL is in, and the account it belongs to, and every screen renders inside it.
import type { ReactNode } from "react";
import { ShellInspector } from "./shell-inspector";
import { ShellRail } from "./shell-rail";
import { ShellTopBar } from "./shell-top-bar";
import type { ShellArea, ShellWorkspace } from "./routes";

export interface AppShellProps {
  workspace: ShellWorkspace;
  area: ShellArea;
  email: string;
  signOut: () => void | Promise<void>;
  children: ReactNode;
}

export function AppShell({ workspace, area, email, signOut, children }: AppShellProps) {
  return (
    <div className="cx-shell" data-testid="shell-root">
      <ShellRail workspace={workspace} area={area} />
      <div className="cx-shell-body">
        <ShellTopBar workspace={workspace} area={area} email={email} signOut={signOut} />
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
