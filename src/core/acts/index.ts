/**
 * The act seam's only import surface (SEAM-ACT, L-ACT-01).
 *
 * L-ACT-01: the seam "is the sole writer of the log and unimportable elsewhere". Nothing outside
 * this directory reaches past this file — the tables themselves, the statements that write them
 * and the operators that build those statements stay inside, and what leaves is the vocabulary,
 * the two total maps, the pair of act functions and the refusal they throw.
 *
 * "Unimportable elsewhere" binds the write path, not the seam: `previewAct` and `commitAct` are
 * meant to be called from the server layer — that is what makes the seam usable rather than
 * merely present — while the drizzle table objects for `acts`, `participants` and
 * `participant_roles` leave `src/core/acts` for nothing under `src/` at all.
 */
export {
  ACT_PERMISSIONS,
  ACT_TYPE,
  ACT_TYPES,
  PERMISSION,
  PERMISSIONS,
  ROLE,
  ROLE_BUNDLES,
  isActType,
  isRole,
  roleHolds,
} from './vocabulary';
export type { ActType, Permission, PermissionBundle, Role } from './vocabulary';

export { ActSeamRefusal, refusalCodeOf } from './refusal';
export type { ActRefusalCode, RefusalDetail } from './refusal';

export { commitAct, foundPrincipal, listParticipantHistory, previewAct } from './seam';
export type { ConsequenceOf, Previewed } from './seam';

export type { ActCtx, ParticipantGrant } from './participation';
export type {
  AssignParticipantRoleConsequence,
  AssignParticipantRoleInput,
} from './assign-participant-role';
