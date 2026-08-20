import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

/**
 * The tRPC root. One instance, created here, so every module's router is built
 * from the same `router` and `publicProcedure` and composition stays mechanical
 * (AS-A1).
 */
const t = initTRPC.create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
