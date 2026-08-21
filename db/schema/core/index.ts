/**
 * The `core` module's tables — the founding module dir (SEAM-TENANT).
 *
 * A module dir states its own tables and nothing else; db/schema/index.ts is the only
 * composition root, and a later module founds its own dir beside this one.
 */
export { tenants } from './tenants';
export { seamSmoke } from './seam-smoke';
