// The SLABS area's own job kinds — empty until M3 writes it (AM-11).
//
// M3's slabs rail declares its kinds HERE. The barrel `src/core/jobs/kinds.ts` already enumerates this
// file, so a kind added to the group below joins the roster the runtime declares queues for and
// consumes — with no shared table to edit and no other area's file to touch (B-19).

import type { JobKindGroup } from "./law";

/** This area's kinds, each with the queue policy R-SPINE-030 asks for. */
export const SLABS_JOB_KINDS = Object.freeze({}) satisfies JobKindGroup;

/** What this area's kinds are enqueued with (SEAM-JOBS: "typed payloads"). */
export type SlabsJobPayloads = Record<never, never>;
