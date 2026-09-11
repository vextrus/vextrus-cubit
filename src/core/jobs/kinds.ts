// SEAM-JOBS: the roster of job kinds, each with the queue policy R-SPINE-030 asks for — a
// concurrency limit and a retry rule with backoff — and the payload type its enqueuers must
// satisfy. The three are one roster, not three: a kind exists here or it does not exist, and a
// kind without a payload type or without a policy cannot be written down.
//
// The policy table is exported rather than hidden because it is the answer to "how often does this
// kind retry": a caller, an operator's screen and a test all read the number from here instead of
// each keeping a copy of it (ARCH-02).
//
// "Here" is this DIRECTORY, not this file (AM-11). Each area declares its own kinds and its own
// payload types in `./kinds/<area>.ts`, and this file is the roster: it ENUMERATES those groups and
// merges them, so `JOB_KINDS`, `JobKind` and `JobPayloads` are still one closed vocabulary and every
// importer still reads it from `@/core/jobs/kinds`. An area adds a kind by editing its own file and
// nothing else — two areas written at once never touch one table (B-19).

import { BOQ_JOB_KINDS, type BoqJobPayloads } from "./kinds/boq";
import { DOCS_JOB_KINDS, type DocsJobPayloads } from "./kinds/docs";
import { FOUNDATIONS_JOB_KINDS, type FoundationsJobPayloads } from "./kinds/foundations";
import { FRAME_JOB_KINDS, type FrameJobPayloads } from "./kinds/frame";
import { GATE_JOB_KINDS, type GateJobPayloads } from "./kinds/gate";
import { MASONRY_JOB_KINDS, type MasonryJobPayloads } from "./kinds/masonry";
import { REBAR_JOB_KINDS, type RebarJobPayloads } from "./kinds/rebar";
import { SLABS_JOB_KINDS, type SlabsJobPayloads } from "./kinds/slabs";
import { SPINE_JOB_KINDS, type SpineJobPayloads } from "./kinds/spine";
import { TAKEOFF_INGEST_JOB_KINDS, type TakeoffIngestJobPayloads } from "./kinds/takeoff-ingest";
import { TAKEOFF_PARTITION_JOB_KINDS, type TakeoffPartitionJobPayloads } from "./kinds/takeoff-partition";
import { TAKEOFF_RASTERS_JOB_KINDS, type TakeoffRastersJobPayloads } from "./kinds/takeoff-rasters";

// The shape a policy is declared in lives beside the areas that declare theirs against it, and is
// published from here because this is the door every reader opens (B-17).
export type { JobKindPolicy } from "./kinds/law";

/**
 * Every kind the seam runs, with its policy — the areas' groups, merged. The order is the order the
 * areas are enumerated in below, and `KIND_NAMES` is read off it rather than written down again.
 */
export const JOB_KINDS = Object.freeze({
  ...SPINE_JOB_KINDS,
  ...TAKEOFF_INGEST_JOB_KINDS,
  ...TAKEOFF_RASTERS_JOB_KINDS,
  ...TAKEOFF_PARTITION_JOB_KINDS,
  ...GATE_JOB_KINDS,
  ...FOUNDATIONS_JOB_KINDS,
  ...FRAME_JOB_KINDS,
  ...SLABS_JOB_KINDS,
  ...MASONRY_JOB_KINDS,
  ...REBAR_JOB_KINDS,
  ...DOCS_JOB_KINDS,
  ...BOQ_JOB_KINDS,
});

/** The kind vocabulary: the keys of the policy table and nothing else. */
export type JobKind = keyof typeof JOB_KINDS;

/** Every payload type the areas declare, merged — the other half of the one roster. */
type DeclaredPayloads = SpineJobPayloads &
  TakeoffIngestJobPayloads &
  TakeoffRastersJobPayloads &
  TakeoffPartitionJobPayloads &
  GateJobPayloads &
  FoundationsJobPayloads &
  FrameJobPayloads &
  SlabsJobPayloads &
  MasonryJobPayloads &
  RebarJobPayloads &
  DocsJobPayloads &
  BoqJobPayloads;

/**
 * What each kind is enqueued with (SEAM-JOBS: "typed payloads"), read off the areas' own declarations
 * and keyed by the kind vocabulary itself. That indexing is the coupling the seam's first paragraph
 * states: a kind whose area declared a policy and no payload has nothing to answer `DeclaredPayloads`
 * with, and tsc says so here rather than at some enqueuer far away.
 */
export type JobPayloads = { [K in JobKind]: DeclaredPayloads[K] };

/** The kinds as a list, in the order the table declares them. */
export const KIND_NAMES: readonly JobKind[] = Object.freeze(Object.keys(JOB_KINDS) as JobKind[]);
