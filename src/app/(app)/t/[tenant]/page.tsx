// The workspace's Projects home (R-UI-031: the rail's Projects entry lands here). A workspace
// holding no projects is shown its empty state — the one place that teaches what to do next
// (R-UI-033).
import { strings } from "../../../../ui/strings";
import { ProjectsOnboarding } from "./projects-onboarding";

export const metadata = { title: strings.shell_projects_heading };

export default function ProjectsHome() {
  return (
    <>
      <h1 className="cx-shell-heading">{strings.shell_projects_heading}</h1>
      <ProjectsOnboarding />
    </>
  );
}
