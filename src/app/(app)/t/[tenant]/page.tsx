// The workspace's Projects home (R-UI-031: the rail's Projects entry lands here). It reads the
// workspace's projects through the module seam and branches: a workspace holding none is shown its
// empty state — the one place that teaches what to do next (R-UI-033) — and one holding projects is
// shown the grid, the quick stats each carries and the documents they have yet to produce.
import { redirect } from "next/navigation";
import { projectsForHome } from "../../../../modules/spine/projects";
import { presentedSessionToken } from "../../../../server/shell/session";
import { viewerFor } from "../../../../server/shell/viewer";
import { strings } from "../../../../ui/strings";
import { ProjectsHome } from "./home/projects-home";

export const metadata = { title: strings.shell_projects_heading };

export default async function ProjectsHomePage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const viewer = await viewerFor(await presentedSessionToken());
  // The layout above resolved this same session before it painted the frame around this screen;
  // between then and now a session can only have ended, which is the sign-in remedy (ARCH-03).
  if (viewer === null) redirect("/sign-in");

  const projects = await projectsForHome({ tenantId: tenant, userId: viewer.userId, actorKind: "human" });
  return <ProjectsHome tenantId={tenant} projects={projects} />;
}
