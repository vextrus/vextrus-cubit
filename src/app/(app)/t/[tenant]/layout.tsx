// The workspace an address names, and the three answers a request for it can get (R-UI-030):
// the frame, when the session holds that workspace; the denial surface, when it does not (I-17);
// and `/sign-in`, when the cookie no longer stands for a live session — an ended session is not a
// permission problem, so it gets the remedy that fixes it (ARCH-03).
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { refusalOf } from "../../../../core/errors";
import { presentedSessionToken } from "../../../../server/shell/session";
import { viewerFor } from "../../../../server/shell/viewer";
import { workspaceFor } from "../../../../server/shell/workspace";
import { ShellDenied, shellHref } from "../../../../ui/shell";
import { strings } from "../../../../ui/strings";
import { signOutAction } from "./actions";
import { ShellFrame } from "./shell-frame";

export default async function WorkspaceLayout({ children, params }: { children: ReactNode; params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const presented = await presentedSessionToken();
  const viewer = await viewerFor(presented);
  if (viewer === null) redirect("/sign-in");

  const workspace = await workspaceFor(presented);
  if (workspace === null || workspace.tenantId !== tenant) {
    // The way onward is a place they can actually go: their own workspace when they hold one, and
    // the home page when they hold none at all.
    const evidence =
      workspace === null
        ? { href: "/", label: strings.shell_evidence_home }
        : { href: shellHref(workspace.tenantId, "projects"), label: strings.shell_denied_evidence };
    return <ShellDenied refusal={refusalOf("PERMISSION_NOT_HELD")} evidence={evidence} />;
  }

  return (
    <ShellFrame workspace={workspace} email={viewer.email} signOut={signOutAction}>
      {children}
    </ShellFrame>
  );
}
