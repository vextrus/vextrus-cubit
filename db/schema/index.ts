/**
 * The schema composition root (SEAM-TENANT).
 *
 * One module dir per module, composed here and nowhere else: drizzle-kit reads this tree to
 * generate migrations, and `src/core/db.ts` — the one importer the lint rule allows — binds
 * the same object to every handle it hands out. A module-founding increment adds its dir
 * and one line here.
 */
export * from './core/index';
export * from './spine/index';
