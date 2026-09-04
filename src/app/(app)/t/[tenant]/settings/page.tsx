// Settings: what this workspace is called (R-UI-033 — the name is entered at sign-up, and this is
// where it is changed afterwards), and then what this person chose for themselves — the density
// their tables are drawn at (R-UI-005). Identity first, preference second.
import { redirect } from "next/navigation";
import { saveDensity } from "../../../../../server/shell/density";
import { presentedSessionToken } from "../../../../../server/shell/session";
import { DensityToggle } from "../../../../../ui/shell";
import { strings } from "../../../../../ui/strings";
import { densityRead, namedWorkspaceRead, viewerRead } from "../reads";
import { SettingsMembersLink } from "./members/members-link";
import { RenameForm } from "./rename-form";

export const metadata = { title: strings.shell_settings_heading };

export default async function WorkspaceSettings({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const presented = await presentedSessionToken();
  // The layout above resolved this same viewer, this same workspace and this same density before it
  // painted the frame around this screen, and it resolved them through these same reads — so asking
  // again here costs nothing and the workspace this screen renames is the one the frame is drawn
  // for. Reading the earliest membership instead would show one workspace in the frame and rename
  // another (R-SPINE-002 puts the active tenant in the address).
  const workspace = await namedWorkspaceRead(presented, tenant);
  const viewer = await viewerRead(presented);
  // Between the layout's answer and this one a session can only have ended, which is the sign-in
  // remedy (ARCH-03).
  if (workspace === null || viewer === null) redirect("/sign-in");

  // The stored mode, read before paint: the toggle first renders already holding it, so no default
  // is shown and then corrected (docs/design/density-and-prefs.md I-33).
  const density = await densityRead(viewer.userId);

  return (
    <>
      <h1 className="cx-shell-heading">{strings.shell_settings_heading}</h1>
      <RenameForm tenantId={workspace.tenantId} name={workspace.name} />
      <SettingsMembersLink tenantId={workspace.tenantId} />
      <DensityToggle density={density} action={saveDensity} />
    </>
  );
}
