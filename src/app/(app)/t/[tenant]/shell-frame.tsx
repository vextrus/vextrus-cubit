"use client";
// The frame, told where it is. R-UI-031 makes the URL the source of truth for selection, and the
// address is a fact about the browser rather than about the layout that renders once above every
// area — so the pathname is read here, and the frame is handed the area it names.
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { Density } from "../../../../core/prefs";
import { AppShell, areaOf, isAreaHome, type ShellWorkspace } from "../../../../ui/shell";

export interface ShellFrameProps {
  workspace: ShellWorkspace;
  email: string | null;
  /** The stored mode the layout read for this account (R-UI-005); the frame publishes it. */
  density: Density;
  signOut: () => Promise<void>;
  children: ReactNode;
}

export function ShellFrame({ workspace, email, density, signOut, children }: ShellFrameProps) {
  const pathname = usePathname();
  return (
    <AppShell
      workspace={workspace}
      area={areaOf(pathname)}
      atAreaHome={isAreaHome(pathname, workspace.tenantId)}
      email={email}
      density={density}
      signOut={signOut}
    >
      {children}
    </AppShell>
  );
}
