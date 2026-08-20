import { router } from '../../server/trpc';

/**
 * The assure module's declared surface. Empty until its lane lands: composition is
 * pre-wired now (AS-A1) so no later increment touches src/server/router.ts, and
 * cubit/module-boundaries makes this the only door into the module.
 */
export const assureRouter = router({});
