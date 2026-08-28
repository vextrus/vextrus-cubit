// Settings, and the setting a workspace has: what it is called (R-UI-033 — the name is
// entered at sign-up, and this is where it is changed afterwards).
import { redirect } from "next/navigation";
import { presentedSessionToken } from "../../../../../server/shell/session";
import { workspaceFor } from "../../../../../server/shell/workspace";
import { strings } from "../../../../../ui/strings";
import { RenameForm } from "./rename-form";

export const metadata = { title: strings.shell_settings_heading };

export default async function WorkspaceSettings() {
  const workspace = await workspaceFor(await presentedSessionToken());
  // The layout above resolved this same workspace before it painted the frame around this screen;
  // between then and now a session can only have ended, which is the sign-in remedy (ARCH-03).
  if (workspace === null) redirect("/sign-in");

  return (
    <>
      <h1 className="cx-shell-heading">{strings.shell_settings_heading}</h1>
      <RenameForm tenantId={workspace.tenantId} name={workspace.name} />
    </>
  );
}
