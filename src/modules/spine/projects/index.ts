// The projects module (R-SPINE-010, L-ACT-03, L-REG-07): creation with its pin and its PRINCIPAL
// bootstrap, the lifecycle doors behind one guard, and what the workspace's home reads. Every caller
// — a server action, a transport, a suite — comes through this barrel, so the doors a project has
// are enumerable in one place (ARCH-02).
export { createProject, type CreatedProject } from "./create";
export { archiveProject, restoreProject, updateProject, type ProjectEdit, type ProjectRef } from "./lifecycle";
export { projectsForHome, type Project, type ProjectQuickStats, type ProjectStatus } from "./read";
export { pinRulesetForProject, type PinnedEdition } from "./ruleset-pin";
export { BUILDING_TYPES, isBuildingType, type BuildingType, type ProjectChanges, type ProjectDraft, type ProjectFields } from "./draft";
export { type ProjectsCtx } from "./scope";
