// SEAM-TENANT: the barrel over the seam's modules. `forTenant(ctx)` and `runAsSystem(reason)` are
// the only database handles the tree has, and this is the one path every importer names for them —
// so the driver, the tables and the queue moved into src/core/db/ without a single call site moving
// with them (ARCH-02, B-17).
//
// It re-exports and does nothing else: the tables live in ./db/schema, the connections in
// ./db/pools, the scoped surface in ./db/seam, the job storage in ./db/jobs, and the system-reason
// recorder in ./db/reason. `connection()` is the seam's own and is deliberately not handed out here.
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
