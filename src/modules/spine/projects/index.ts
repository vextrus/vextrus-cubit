/**
 * Projects (R-SPINE-010, R-SPINE-011) — one import for the module every route and journey
 * reads a project through.
 *
 * Everything here operates through SEAM-TENANT handles and the act seam and nothing else: the
 * driver and the schema stay in `src/core/db.ts`, and the act log's three tables stay inside
 * `src/core/acts`, which is its sole writer (L-ACT-01). The founding grant a project is created
 * with is that seam's `foundPrincipal`, called inside this module's own transaction.
 *
 * The screens that render this are `/t/{tenantSlug}` (docs/design/s-home.md) and the two new
 * project-settings panes (docs/design/s-project-settings-project-fields-pane-participants-pane-
 * ruleset-pane-untouched.md).
 */
export { BUILDING_TYPES } from './building-types';
export type { BuildingType } from './building-types';

export { gfaSft } from './gfa';

export {
  archiveProject,
  createProject,
  listProjects,
  participantRoster,
  projectContext,
  readProject,
  roleHistory,
  updateProject,
} from './projects';
export type {
  NewProjectInput,
  ParticipantView,
  ProjectCtx,
  ProjectFields,
  ProjectRef,
  ProjectView,
  RoleGrantView,
} from './projects';
