"use client";
// The 40 px top bar (Direction §1, §3.1; was `var(--space-12)` = 48): where you are — the FULL
// breadcrumb `workspace › project ▾ › area › page`, every crumb a real location (R-UI-084) — and
// the end cluster: ⌘K, the jobs tray, and who you are (the user menu, holding the two doors a
// signed-in person always owes: the device list and the way out).
//
// The trail's shape is derived in `routes.ts`, the one home R-UI-084 names for it, and painted by
// the shipped `Breadcrumb` primitive (B-17). This bar owns neither: it says where it is and hands
// the answer over. A control with no destination is absent rather than shown dead (I-15).
import { useTransition } from "react";
import { Breadcrumb } from "../primitives/core";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../primitives/overlay";
import { strings } from "../strings";
import { CommandPaletteTrigger } from "./command-palette-trigger";
import { useFailureHandOff } from "./failure-hand-off";
import { JobsTray } from "./jobs-tray";
import { shellCrumbs, type ShellArea, type ShellProject, type ShellWorkspace } from "./routes";
import { TESTIDS } from "@/ui/testids";

export interface ShellTopBarProps {
  workspace: ShellWorkspace;
  /** The project the address is inside, when it is inside one — the trail's second crumb. */
  project?: ShellProject | null;
  /** The sibling projects the project crumb's ▾ menu offers; none means no menu, never an empty one. */
  projects?: readonly ShellProject[];
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
  /**
   * The account the session belongs to, stated on the menu as data rather than as words: who is
   * signed in is a fact about the frame, and an actor performing an act is entitled to see the
   * identity it will be recorded under (L-ACT-01). Optional because a bar mounted without a session
   * above it states nothing.
   */
  userId?: string | null;
  /** Ending the session is the server's to do; the menu only asks for it. */
  signOut: () => void | Promise<void>;
}

export function ShellTopBar({ workspace, project, projects, area, atAreaHome, page, email, userId, signOut }: ShellTopBarProps) {
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
    <header className="cx-shell-topbar" data-testid={TESTIDS.shell.topbar}>
      {/* The id the frame has always published for the trail, kept byte-identical; the `<nav>`, its
          label and the crumbs' own markup are the primitive's, which is where they belong (B-17). */}
      <div className="cx-shell-breadcrumb" data-testid={TESTIDS.shell.breadcrumb}>
        <Breadcrumb crumbs={shellCrumbs({ workspace, project, projects, area, atAreaHome, page })} className="cx-shell-crumbs" />
      </div>

      {/* The bar's right-hand cluster, in R-UI-030's own order: the ⌘K trigger, the jobs tray, then
          the user menu. Both the trigger and the tray render nothing outside their provider, so a
          bar mounted without the tenant frame above it stands exactly as it always has (I-115,
          I-116, I-135). */}
      <div className="cx-shell-topbar-end">
        <CommandPaletteTrigger />

        <JobsTray />

        {/* `modal={false}` for the same reason the rail's switcher carries it: the modal treatment's
            `aria-hidden` over the rest of the frame leaves focusable links inside it, which axe
            reports as a serious `aria-hidden-focus` — and Q-11 admits none at a checkpoint. */}
        <DropdownMenu modal={false}>
          {/* The visible address is the accessible name: a person reads the account they are in. */}
          <DropdownMenuTrigger className="cx-shell-user-trigger" data-testid={TESTIDS.shell.user} data-user-id={userId ?? undefined}>
            {email ?? strings.shell_user_account}
          </DropdownMenuTrigger>
          {/* Portalled where the shipped DropdownMenu portals every menu in the tree, and styled by
              its own classes rather than by this bar's: an open menu at the document root is an axe
              `region` finding of moderate impact, which the design lane reports and which is below
              the serious/critical threshold Q-11 fixes for a checkpoint (§ I-22). */}
          <DropdownMenuContent align="end">
            {/* Both items are peers of one menu, so both wear the menu's idiom: an item that happens
                to be a link may not arrive underlined beside one that is not. */}
            <DropdownMenuItem asChild data-testid={TESTIDS.shell.userSessions}>
              <a className="cx-shell-menu-item" href="/sessions">
                {strings.shell_user_sessions}
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem data-testid={TESTIDS.shell.userSignout} data-pending={signingOut ? "true" : undefined} onSelect={askToSignOut}>
              {strings.shell_user_signout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
