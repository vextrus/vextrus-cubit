// SEAM-TENANT: the seam's barrel. `forTenant(ctx)` and `runAsSystem(reason)` are the only database
// handles the tree has, and this is the one path every importer names for them — while the driver,
// the tables and the queue live in the modules beside it, one concern each (ARCH-02, B-17).
//
// It re-exports and does nothing else: the tables are ./db/schema's, the connections ./db/pools',
// the scoped surface ./db/seam's, the job storage ./db/jobs' and the system-reason recorder
// ./db/reason's. `connection()` is the seam's own, so the barrel hands out no pool.
//
// Every name is spelled rather than starred. This file is the seam's public roster, and a roster is
// only readable — by a person, and by a scan that must tell a moved name from a dropped one — if it
// says what it hands out; a star re-export names nothing at all (ARCH-02).
//
// The query operators a caller needs to say which rows it means are the driver's, so they are handed
// out from the seam rather than imported at a call site: SEAM-TENANT makes this directory the one
// lawful home of the driver, and a module that reached for them itself would be holding half a
// handle (ARCH-02).
export {
  tenants,
  projects,
  participants,
  acts,
  participantRoles,
  participantRoleWithdrawals,
  users,
  sessions,
  authTokens,
  authAttempts,
  WORKSPACE_ROLES,
  memberships,
  invitations,
  rulesetScope,
  rulesetEditions,
  tenantRulesetEditions,
  modelCalls,
  userPrefs,
  modelFixtures,
  DISPOSITIONS,
  sheetUnderstandingDispositions,
  ACCEPTED_FORMATS,
  UPLOAD_STATES,
  SCAN_VERDICTS,
  RASTER_TIERS,
  UPLOAD_MAX_BYTES,
  UPLOAD_CHUNK_BYTES,
  files,
  drawings,
  uploads,
  ingests,
  sheetRasters,
  sheetDisciplines,
  partitionViews,
  viewAssignments,
  viewTypeConfirmations,
  conventionProfiles,
  grids,
  gridDeferrals,
  schedules,
  scheduleCells,
  memberTypes,
  memberTypeVariants,
  rebarZones,
  scheduleDeferrals,
  placements,
  expansionDeferrals,
  proposedLevels,
  typicalRanges,
  drawingSets,
  drawingSetMembers,
  drawingSetRevisions,
  scaleAffirmations,
  calibrations,
  workItems,
  bears,
  registerObjects,
  refusedSightings,
  registerAttributes,
  registerObservations,
  repudiatedObjects,
  levels,
  storeyHeightReadings,
  campaigns,
  quantityLines,
  railObservations,
  queueItems,
  SEAM_SCHEMA,
} from "./db/schema";
export { isAcceptedFormat } from "./db/schema";
export type {
  WorkspaceRole,
  Disposition,
  SheetReadingRecord,
  AcceptedFormat,
  UploadState,
  ScanVerdict,
  RasterTier,
  GridFamily,
  GridAxis,
  GridDeferralReason,
  SectionUnit,
  RebarZone,
  ScheduleDeferralReason,
  ExpansionDeferralReason,
} from "./db/schema";
export { closePools } from "./db/pools";
export {
  forTenant,
  runAsSystem,
  holdStateLock,
  isUuid,
  inCurrentScope,
  isStorableText,
  storableText,
  modelSpendByProject,
} from "./db/seam";
export { scopedClient } from "./db/seam";
export type { Scope, TenantDb, TenantTx, SystemDb, ModelSpend } from "./db/seam";
export { jobsStore } from "./db/jobs";
export type { JobEventDraft, JobEventRow, QueuedJob, QueueShape, LiveClaim, ClaimCursor, QueueState, JobsStore } from "./db/jobs";
export { recordSystemReasonsWith, type SystemReasonRecord, type SystemReasonRecorder } from "./db/reason";
export { and, asc, desc, eq, gt, inArray, isNull, lt } from "drizzle-orm";
