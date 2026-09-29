/*
 * /projects (docs/design/m0-screens.md §4.3), in the frame: the projects the member may open.
 */
import { createFileRoute } from '@tanstack/react-router'
import { ProjectsLoading, ProjectsPage } from '@/projects'

export const Route = createFileRoute('/_app/projects/')({
  pendingComponent: ProjectsLoading,
  component: ProjectsPage,
})
