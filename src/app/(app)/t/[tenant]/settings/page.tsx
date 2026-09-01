// Settings: what this workspace is called (R-UI-033 — the name is entered at sign-up, and this is
// where it is changed afterwards), and then what this person chose for themselves — the density
// their tables are drawn at (R-UI-005). Identity first, preference second.
import { redirect } from "next/navigation";
import { densityFor } from "../../../../../core/prefs";
import { saveDensity } from "../../../../../server/shell/density";
import { presentedSessionToken } from "../../../../../server/shell/session";
import { viewerFor } from "../../../../../server/shell/viewer";
import { workspaceFor } from "../../../../../server/shell/workspace";
import { DensityToggle } from "../../../../../ui/shell";
import { strings } from "../../../../../ui/strings";
import { SettingsMembersLink } from "./members/members-link";
import { RenameForm } from "./rename-form";

export const metadata = { title: strings.shell_settings_heading };

export default async function WorkspaceSettings() {
  const presented = await presentedSessionToken();
  const workspace = await workspaceFor(presented);
  const viewer = await viewerFor(presented);
  // The layout above resolved this same workspace before it painted the frame around this screen;
  // between then and now a session can only have ended, which is the sign-in remedy (ARCH-03).
  if (workspace === null || viewer === null) redirect("/sign-in");

  // The stored mode, read before paint: the toggle first renders already holding it, so no default
  // is shown and then corrected (docs/design/density-and-prefs.md I-33).
  const density = await densityFor(viewer.userId);

  return (
    <>
      <h1 className="cx-shell-heading">{strings.shell_settings_heading}</h1>
      <RenameForm tenantId={workspace.tenantId} name={workspace.name} />
      <SettingsMembersLink tenantId={workspace.tenantId} />
      <DensityToggle density={density} action={saveDensity} />
    </>
  );
}
