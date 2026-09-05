"use client";
// R-UI-030's top bar: where you are (the breadcrumb, reading the URL's own truth) and who you are
// (the user menu, holding the two doors a signed-in person always owes — the device list and the
// way out). The bar carries only occupants that lead somewhere: a control with no destination is
// absent rather than shown dead (I-15).
import Link from "next/link";
import { useTransition } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../primitives/overlay";
import { strings } from "../strings";
import { useFailureHandOff } from "./failure-hand-off";
import { JobsTray } from "./jobs-tray";
import { areaLabel, hasVisibleText, shellHref, workspaceLabel, type ShellArea, type ShellWorkspace } from "./routes";

export interface ShellTopBarProps {
  workspace: ShellWorkspace;
  area: ShellArea;
  /** Whether the address is the area's own home; deeper, the area crumb is a step, not the page. */
  atAreaHome: boolean;
  /**
   * The screen inside the area, named as its own crumb. Optional because a screen that is the
   * area's own home names nothing beneath it, and the words are the caller's — the page's own
   * name, never a key this module invents (R-UI-031).
   */
  page?: string;
  /** The address the session belongs to, shown as the menu's own name; null when there is none. */
  email: string | null;
  /** Ending the session is the server's to do; the menu only asks for it. */
  signOut: () => void | Promise<void>;
}

export function ShellTopBar({ workspace, area, atAreaHome, page, email, signOut }: ShellTopBarProps) {
  const [signingOut, startSignOut] = useTransition();
  // A failed sign-out is a failure, not a silence: a discarded promise would leave the control idle
  // and the screen claiming nothing happened (ARCH-03, B-21). The hand-off holds the rejection and
  // re-throws it while rendering, which is how a client component reaches the error boundary.
  const handing = useFailureHandOff();

  const askToSignOut = (): void => {
    if (signingOut) return;
    startSignOut(() =>
      handing(async () => {
        await signOut();
      }),
    );
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
          {/* The area crumb is the current page only at the area's own home. On a screen deeper
              inside the area it is a step on the way — a link the reader can take back — and
              saying `aria-current="page"` there would name an address they are not at. */}
          {atAreaHome ? (
            <li className="cx-shell-crumb-current" aria-current="page">
              {areaLabel(area)}
            </li>
          ) : (
            <li>
              <Link className="cx-shell-crumb-link cx-reticle" href={shellHref(workspace.tenantId, area)}>
                {areaLabel(area)}
              </Link>
            </li>
          )}
          {/* The page's own crumb, and only inside the area: at the area's own home the area crumb
              already is the page, and a second `aria-current="page"` would make the trail claim two
              addresses at once (Q-11). A screen that names no page ends the trail at the area — and
              a name with nothing visible in it names no page, judged by the one answer the frame has
              for that question (I-22, B-17): a crumb carrying the page claim with no glyph in it is
              the same undiscernible-name failure `workspaceLabel` exists to prevent. */}
          {!atAreaHome && page !== undefined && hasVisibleText(page) ? (
            <>
              <li className="cx-shell-crumb-separator" aria-hidden="true">
                ›
              </li>
              <li className="cx-shell-crumb-current" aria-current="page" data-testid="shell-crumb-page">
                {page}
              </li>
            </>
          ) : null}
        </ol>
      </nav>

      {/* The bar's right-hand cluster: the jobs tray R-UI-030 names among the frame's parts, then
          the user menu. The tray renders nothing outside a JobsProvider, so a bar mounted without
          the tenant frame above it stands exactly as it always has (shell-top-bar I-115, I-116). */}
      <div className="cx-shell-topbar-end">
        <JobsTray />

        {/* `modal={false}` for the same reason the rail's switcher carries it: the modal treatment's
            `aria-hidden` over the rest of the frame leaves focusable links inside it, which axe
            reports as a serious `aria-hidden-focus` — and Q-11 admits none at a checkpoint. */}
        <DropdownMenu modal={false}>
          {/* The visible address is the accessible name: a person reads the account they are in. */}
          <DropdownMenuTrigger className="cx-shell-user-trigger" data-testid="shell-user">
            {email ?? strings.shell_user_account}
          </DropdownMenuTrigger>
          {/* Portalled where the shipped DropdownMenu portals every menu in the tree, and styled by
              its own classes rather than by this bar's: an open menu at the document root is an axe
              `region` finding of moderate impact, which the design lane reports and which is below
              the serious/critical threshold Q-11 fixes for a checkpoint (§ I-22). */}
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
      </div>
    </header>
  );
}
