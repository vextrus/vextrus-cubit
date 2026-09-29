/*
 * Projects (ticket 20a; docs/design/m0-screens.md §4.3): the list and the New project dialog. The
 * discard guard is shared with the Members page's invite dialog.
 */
export { ProjectsPage, ProjectsTable, ProjectsEmpty, ProjectsLoading } from './ProjectsPage'
export { NewProjectDialog } from './NewProjectDialog'
export { DiscardBar, useDiscardGuard, type DiscardGuard } from './discard'
