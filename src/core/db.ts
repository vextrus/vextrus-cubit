// SEAM-TENANT: the seam's barrel. `forTenant(ctx)` and `runAsSystem(reason)` are the only database
// handles the tree has, and this is the one path every importer names for them — while the driver,
// the tables and the queue live in the modules beside it, one concern each (ARCH-02, B-17).
//
// It re-exports and does nothing else: the tables are ./db/schema's, the connections ./db/pools',
// the scoped surface ./db/seam's, the job storage ./db/jobs' and the system-reason recorder
// ./db/reason's. `connection()` is the seam's own, so the barrel hands out no pool.
//
// The query operators a caller needs to say which rows it means are the driver's, so they are handed
// out from the seam rather than imported at a call site: SEAM-TENANT makes this directory the one
// lawful home of the driver, and a module that reached for them itself would be holding half a
// handle (ARCH-02).
export * from "./db/schema";
export { closePools } from "./db/pools";
export * from "./db/seam";
export * from "./db/jobs";
export { recordSystemReasonsWith, type SystemReasonRecord, type SystemReasonRecorder } from "./db/reason";
export { and, asc, desc, eq, gt, inArray, isNull, lt } from "drizzle-orm";
