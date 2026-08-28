"use client";
// R-UI-030's top bar: where you are (the breadcrumb, reading the URL's own truth) and who you are
// (the user menu, holding the two doors a signed-in person always owes — the device list and the
// way out). The occupants whose features are not built yet are absent rather than dead (I-15).
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../primitives/overlay";
import { strings } from "../strings";
import { shellHref, type ShellArea, type ShellWorkspace } from "./routes";

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
  return (
    <header className="cx-shell-topbar" data-testid="shell-topbar">
      <nav data-testid="shell-breadcrumb" aria-label={strings.shell_breadcrumb_label}>
        <ol className="cx-shell-crumbs">
          <li>
            <a className="cx-shell-crumb-link cx-reticle" href={shellHref(workspace.tenantId, "projects")}>
              {workspace.name}
            </a>
          </li>
          <li className="cx-shell-crumb-separator" aria-hidden="true">
            ›
          </li>
          <li className="cx-shell-crumb-current" aria-current="page">
            {AREA_LABEL[area]}
          </li>
        </ol>
      </nav>

      <DropdownMenu>
        {/* The visible address is the accessible name: a person reads the account they are in. */}
        <DropdownMenuTrigger className="cx-shell-user-trigger" data-testid="shell-user">
          {email ?? strings.shell_user_account}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild data-testid="shell-user-sessions">
            <a href="/sessions">{strings.shell_user_sessions}</a>
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="shell-user-signout"
            onSelect={() => {
              void signOut();
            }}
          >
            {strings.shell_user_signout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
