// The workspace's Projects home (R-UI-031: the rail's Projects entry lands here). It reads the
// workspace's projects through the module seam and branches: a workspace holding none is shown its
// empty state — the one place that teaches what to do next (R-UI-033) — and one holding projects is
// shown the grid, the quick stats each carries and the documents they have yet to produce.
import { redirect } from "next/navigation";
import { projectsForHome, type Project } from "@/modules/spine/projects";
import { rowShare } from "@/modules/takeoff/coverage/heat";
import { coverageViewOf } from "@/modules/takeoff/coverage/server";
import { presentedSessionToken } from "@/server/shell/session";
import { viewerFor } from "@/server/shell/viewer";
import { strings } from "@/ui/strings";
import { ProjectsHome } from "./home/projects-home";

export const metadata = { title: strings.shell_projects_heading };

export default async function ProjectsHomePage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const viewer = await viewerFor(await presentedSessionToken());
  // The layout above resolved this same session before it painted the frame around this screen;
  // between then and now a session can only have ended, which is the sign-in remedy (ARCH-03).
  if (viewer === null) redirect("/sign-in");

  const projects = await projectsForHome({ tenantId: tenant, userId: viewer.userId, actorKind: "human" });
  return <ProjectsHome tenantId={tenant} projects={projects} coverage={await coverageOf(tenant, projects)} />;
}

/**
 * s-home I-142: coverage is stated where it is known. A project holding a campaign has a residue, and
 * its share is the one S-Coverage paints — the published cells over every cell the campaign bears,
 * read through the coverage door and the grid's own `rowShare` rather than derived a second time
 * here (B-17). A project with no campaign has nothing measured to cover and is left out, so its cell
 * states the absent mark; so is a campaign whose residue holds no cell yet, because a share of
 * nothing is no share.
 */
async function coverageOf(tenantId: string, projects: readonly Project[]): Promise<Readonly<Record<string, number>>> {
  const measured = projects.filter((project) => project.quickStats.campaigns > 0);
  const shares = await Promise.all(
    measured.map(async (project) => {
      const view = await coverageViewOf({ tenantId, projectId: project.projectId });
      const read = rowShare(view.cells);
      return read.total === 0 ? null : ([project.projectId, read.share] as const);
    }),
  );
  return Object.fromEntries(shares.filter((share) => share !== null));
}
