// The workspace an address names, and the three answers a request for it can get (R-UI-030):
// the frame, when the session holds that workspace; the denial surface, when it does not (I-17);
// and `/sign-in`, when the cookie no longer stands for a live session — an ended session is not a
// permission problem, so it gets the remedy that fixes it (ARCH-03).
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { refusalOf } from "../../../../core/errors";
import { presentedSessionToken } from "../../../../server/shell/session";
import { workspacesFor } from "../../../../server/shell/workspace";
import { ShellDenied, shellHref } from "../../../../ui/shell";
import { strings } from "../../../../ui/strings";
import { signOutAction } from "./actions";
import { densityRead, namedWorkspaceRead, viewerRead } from "./reads";
import { ShellFrame } from "./shell-frame";

export default async function WorkspaceLayout({ children, params }: { children: ReactNode; params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const presented = await presentedSessionToken();
  const viewer = await viewerRead(presented);
  if (viewer === null) redirect("/sign-in");

  // The workspace is the one the URL names, admitted by the membership the account genuinely holds
  // — never by comparing the address against the earliest membership. R-SPINE-002 puts the active
  // tenant in the URL, and a person who has accepted an invitation holds two: measuring the address
  // against one of them would deny them the other (see `namedWorkspaceFor`).
  const held = await workspacesFor(presented);
  const workspace = await namedWorkspaceRead(presented, tenant);
  if (workspace === null) {
    // The way onward is a place they can actually go: a workspace they hold when they hold one, and
    // the home page when they hold none at all.
    const first = held[0];
    const evidence =
      first === undefined
        ? { href: "/", label: strings.shell_evidence_home }
        : { href: shellHref(first.tenantId, "projects"), label: strings.shell_denied_evidence };
    return <ShellDenied refusal={refusalOf("PERMISSION_NOT_HELD")} evidence={evidence} />;
  }

  // R-UI-005: the stored mode is read once per request, through the frame's own memoised read, and
  // published by the frame — every screen inside it inherits one source of truth rather than asking
  // the seam for itself.
  const density = await densityRead(viewer.userId);

  return (
    <ShellFrame workspace={workspace} workspaces={held} email={viewer.email} density={density} signOut={signOutAction}>
      {children}
    </ShellFrame>
  );
}
