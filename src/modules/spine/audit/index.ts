/**
 * The audit surfaces' read model (R-SPINE-081, S-Audit) — one import for the act log.
 *
 * Read-only by construction: the module holds no act-table binding and writes nothing (L-ACT-01
 * keeps both inside `src/core/acts`). The model-call ledger and the job history have no store at
 * M0, so they have nothing to read here yet; when they do, their readers join this barrel.
 */
export { actLog } from './act-log';
export type { ActLogEntry, ActLogFilter, ActLogInput } from './act-log';
