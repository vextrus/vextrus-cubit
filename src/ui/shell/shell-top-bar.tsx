"use client";
// R-UI-030's top bar: where you are (the breadcrumb, reading the URL's own truth) and who you are
// (the user menu, holding the two doors a signed-in person always owes — the device list and the
// way out). The occupants whose features are not built yet are absent rather than dead (I-15).
import Link from "next/link";
import { useState, useTransition } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../primitives/overlay";
import { strings } from "../strings";
import { shellHref, workspaceLabel, type ShellArea, type ShellWorkspace } from "./routes";

export interface ShellTopBarProps {
  workspace: ShellWorkspace;
  area: ShellArea;
  /** The address the session belongs to, shown as the menu's own name; null when there is none. */
  email: string | null;
  /** Ending the session is the server's to do; the menu only asks for it. */
  signOut: () => void | Promise<void>;
}

/** The crumb an area is named by — the same words the rail entry carries. */
const AREA_LABEL: Readonly<Record<ShellArea, string>> = {
  projects: strings.shell_nav_projects,
  books: strings.shell_nav_books,
  settings: strings.shell_nav_settings,
};

export function ShellTopBar({ workspace, area, email, signOut }: ShellTopBarProps) {
  const [signingOut, startSignOut] = useTransition();
  // A failed sign-out is a failure, not a silence: the menu used to close over a discarded promise
  // and say nothing (ARCH-03, B-21). The rejection is held and re-thrown while rendering, which is
  // how a client component hands a failure to the error boundary the shell's state matrix names as
  // its `error` home (src/app/error.tsx) — a report id and a retry, rather than nothing at all.
  const [failure, setFailure] = useState<unknown>(null);
  if (failure !== null) throw failure;

  const askToSignOut = (): void => {
    if (signingOut) return;
    startSignOut(async () => {
      try {
        await signOut();
      } catch (cause) {
        setFailure(cause);
      }
    });
  };

  return (
    <header className="cx-shell-topbar" data-testid="shell-topbar">
      <nav data-testid="shell-breadcrumb" aria-label={strings.shell_breadcrumb_label}>
        <ol className="cx-shell-crumbs">
          <li>
            {/* A frame-internal move, so it travels through the router: the crumb lands inside the
                same layout, which is what keeps the rail's own state (its collapse) across it. */}
            <Link className="cx-shell-crumb-link cx-reticle" href={shellHref(workspace.tenantId, "projects")}>
              {workspaceLabel(workspace)}
            </Link>
          </li>
          <li className="cx-shell-crumb-separator" aria-hidden="true">
            ›
          </li>
          <li className="cx-shell-crumb-current" aria-current="page">
            {AREA_LABEL[area]}
          </li>
        </ol>
      </nav>

      {/* `modal={false}` for the same reason the rail's switcher carries it: the modal treatment's
          `aria-hidden` over the rest of the frame leaves focusable links inside it, which axe
          reports as a serious `aria-hidden-focus` — and Q-11 admits none at a checkpoint. */}
      <DropdownMenu modal={false}>
        {/* The visible address is the accessible name: a person reads the account they are in. */}
        <DropdownMenuTrigger className="cx-shell-user-trigger" data-testid="shell-user">
          {email ?? strings.shell_user_account}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Both items are peers of one menu, so both wear the menu's idiom: an item that happens
              to be a link may not arrive underlined beside one that is not. */}
          <DropdownMenuItem asChild data-testid="shell-user-sessions">
            <a className="cx-shell-menu-item" href="/sessions">
              {strings.shell_user_sessions}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="shell-user-signout" data-pending={signingOut ? "true" : undefined} onSelect={askToSignOut}>
            {strings.shell_user_signout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
