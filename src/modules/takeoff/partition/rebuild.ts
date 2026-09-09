// R-TO-030's job half: one ingest record's partition, rebuilt. The stage list is typed and ordered —
// view classification (L-CAD-06) is the first of it — and a rebuild runs the stages over the artifact
// the record points at and rewrites the record's rows in one transaction.
//
// The door that accepts the request and the scope question it asks live in ./request; this file is
// what the worker's composition root runs.
//
// L-AI-03's order is kept: the deterministic grammar answers first and no model is asked at all where
// it read anything. Only a caption the grammar was silent on is put to a model, through core's own
// question (`@/core/view-captions`) and the model seam behind it — and what comes back stands BESIDE
// the view as a proposal, never in it (L-AI-02). A model that refuses is not a partition that failed:
// the view stands untyped, the refusal is recorded on the job, and the run ends succeeded.
import { REFUSALS } from "@/core/errors";
import { entityGraphSchema, type EntityGraph } from "@/core/entitygraph/schema";
import { refusal, refusalCodeOf } from "@/core/faults/refusal-marker";
import type { JobPayloads, JobProgress } from "@/core/jobs";
import { sourceKeyResolver, type ModelCallContext } from "@/core/model";
import { resolve as resolveConventions } from "@/core/rulesets/methods/conventions/resolve";
import type { Storage } from "@/core/storage";
import { proposeViewType } from "@/core/view-captions";
import type { ViewRecord } from "@/core/views";
import { ingestRecords, type IngestRecord } from "@/modules/takeoff/ingest";
import { censusOf } from "./conventions/census";
import { resolveExpansion, type ResolvedExpansion } from "./expansion/resolve";
import { authoredRangesOf, liveStackOf, registerExpansion, revisionsNaming } from "./expansion/store";
import { detectGrid, type DetectedGrid } from "./grid/detect";
import { proposeLevelStack, type ProposedLevelStack } from "./levels-proposal/propose";
import { detectPlacements, type DetectedPlacements } from "./placement/detect";
import { placementSharesOf } from "./placement/shares";
import { reconstructSchedules } from "./schedules/reconstruct";
import { registerMemberTypes } from "./schedules/registry";
import type { DetectedSchedules } from "./schedules/store";
import { drawingProjectOf, rewritePartition, storedViewsOf, type ResolvedConventions, type ViewProposal } from "./store";
import { partitionArtifact, type PartitionedView } from "./views/assign";
import { VIEW_TYPE, VIEW_TYPES, type ViewType } from "./views/law";

/**
 * The stages a stored partition is rebuilt from, in the order they run (R-TO-030: "view
 * classification, grid backbone, convention profile run as a stored partition rebuilt per ingest").
 * A stage is a member of this list or it does not run at all — the list is the roster, and the map
 * below is keyed by it, so neither can hold a stage the other does not.
 */
export const PARTITION_STAGES = ["views", "conventions", "grid", "schedules", "placement", "expansion", "levels-proposal"] as const;

/** One stage of the partition, drawn from the closed list above. */
export type PartitionStage = (typeof PARTITION_STAGES)[number];

/** The steps a run records around its stages: what it read, and that it wrote what it derived. */
const STEP_RESOLVE = "resolve";
const STEP_STORED = "stored";

/** The step a run records where a model would not classify a caption the grammar could not read. */
const STEP_PROPOSAL_REFUSED = "caption-proposal-refused";

/**
 * How a silent caption is classified, as a seam a caller may hand in (B-23). The default is the
 * question's own home in core; the worker's composition root hands in R-AI's published door, which
 * is the same function reached through the module that publishes it (ARCH-01 keeps the two modules
 * from naming each other, so the root is where they meet).
 */
export type ViewCaptionSeam = { proposeViewType: typeof proposeViewType };

/** What a rebuild is run over: the object store the artifact lives in, and the way to a model. */
export type PartitionDeps = { storage: Storage; captions?: ViewCaptionSeam };

/** The seam every rebuild uses unless its caller names another. */
const PRODUCTION_CAPTIONS: ViewCaptionSeam = { proposeViewType };

/**
 * What the stages have derived so far: the views of the record, which view each entity landed in,
 * and the conventions read off both. Each stage is handed what the ones before it derived and hands
 * on the whole of it, so the list is a pipeline over one growing derivation rather than a set of
 * unrelated passes.
 */
type StagedPartition = {
  readonly views: readonly PartitionedView[];
  readonly assignments: ReadonlyMap<string, string>;
  readonly conventions: ResolvedConventions | null;
  readonly grid: DetectedGrid | null;
  readonly schedules: DetectedSchedules | null;
  readonly placements: DetectedPlacements | null;
  readonly expansion: ResolvedExpansion | null;
  readonly proposal: ProposedLevelStack | null;
};

/**
 * What a stage is given: the record it is rebuilding, the artifact that record points at, and the
 * scope it stands in. The last three stages read the project — its pinned rule-set edition, its level
 * stack, the revisions that name this drawing — so the scope is part of what a stage is handed.
 */
type StageContext = {
  readonly record: IngestRecord;
  readonly graph: EntityGraph;
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
};

/** What one stage leaves behind: the derivation it grew, and what it says about its own work. */
type StageOutcome = { readonly derived: StagedPartition; readonly detail: Record<string, unknown> };

/**
 * What the placement stage derived where it could not measure at all — an examined nothing, which is
 * not the same value as the `null` a stage that never ran leaves (R-UI-050). The rewrite clears the
 * record's placements either way, so a project whose pin was withdrawn keeps none of what it placed.
 */
const NOTHING_PLACED: DetectedPlacements = Object.freeze({ views: 0, placements: Object.freeze([]), ungridded: Object.freeze([]) });

/**
 * The stage list as functions, keyed by the list itself — a stage named in `PARTITION_STAGES` with
 * no implementation here does not compile, which is what keeps the two from drifting apart. Each
 * reports what it read, because R-TO-030 asks for a partition whose every stage's result is visible.
 */
const STAGES: Readonly<Record<PartitionStage, (context: StageContext, held: StagedPartition) => StageOutcome | Promise<StageOutcome>>> = Object.freeze({
  views: (context, held) => {
    const partitioned = partitionArtifact(context.graph);
    const derived = { ...held, views: partitioned.views, assignments: partitioned.assignments };
    return { derived, detail: { views: derived.views.length, assigned: derived.assignments.size } };
  },
  conventions: (context, held) => {
    const census = censusOf(context.graph, held.views);
    const conventions = { census, profile: resolveConventions(census) };
    return { derived: { ...held, conventions }, detail: { layers: census.layers.length, deferrals: conventions.profile.deferrals.length } };
  },
  // The grid runs after the conventions because its candidates are the entities standing on a layer
  // that profile gave a role to — filtered before detection, as L-CAD-07 asks (riskNotes (a)).
  grid: (context, held) => {
    const grid = detectGrid({
      graph: context.graph,
      views: held.views,
      assignments: held.assignments,
      profile: held.conventions?.profile ?? null,
    });
    return { derived: { ...held, grid }, detail: { views: grid.views, axes: grid.axes.length, deferred: grid.deferrals.length } };
  },
  // The schedules run after the grid because they are the fourth stage of the same partition: the
  // tables are reconstructed off the views the first stage cut, and the member types are folded out
  // of those tables in the same pass, so what the store writes is one derivation (R-TO-031).
  schedules: (context, held) => {
    const reconstructed = reconstructSchedules({ graph: context.graph, views: held.views, assignments: held.assignments });
    const registered = registerMemberTypes(reconstructed.tables);
    const schedules: DetectedSchedules = {
      views: reconstructed.views,
      tables: reconstructed.tables,
      registry: registered.families,
      // A view that yielded no table and a table that named no member are both deferrals of this
      // stage, and they stand in one list because they stand in one table (riskNotes (2)).
      deferrals: [...reconstructed.deferrals, ...registered.deferrals],
    };
    return { derived: { ...held, schedules }, detail: { views: schedules.views, tables: schedules.tables.length, deferred: schedules.deferrals.length } };
  },
  // The fifth stage: what the layout plans PLACE (L-CAD-07). It runs after the schedules because a
  // placement's member family is a join onto the registry the fourth stage folded out of them, and
  // after the grid because every constant that decides a placement is a share of the spacing the grid
  // stage read. The shares themselves are the project's pinned edition's and nothing else (L-MEA-01).
  placement: async (context, held) => {
    const shares = await placementSharesOf({ tenantId: context.tenantId, projectId: context.projectId });
    // A project pinned to no edition states no shares, and a stage with nothing to scale by places
    // nothing and says so: the detail carries no shares at all, which is the honest reading of a
    // plan nobody has stated the bands for (L-MEA-01). The stages after it run on regardless.
    if (shares === null) return { derived: { ...held, placements: NOTHING_PLACED }, detail: { views: 0, placements: 0, ungridded: 0, shares: {} } };
    const placements = detectPlacements({
      graph: context.graph,
      views: held.views,
      assignments: held.assignments,
      grid: held.grid,
      shares,
      families: held.schedules?.registry ?? [],
    });
    return {
      derived: { ...held, placements },
      detail: {
        views: placements.views,
        placements: placements.placements.length,
        ungridded: placements.ungridded.length,
        // What the stage measured UNDER, so a reader can see which edition decided what it read
        // (L-MEA-01: rules are data, and a surface shows the edition it measured by).
        shares: { ...shares },
      },
    };
  },
  // The sixth: which levels each placed member stands on, and the register rows that follows. The
  // resolution is pure (`./expansion/resolve`); what this stage adds is the state it is resolved over
  // — the live stack, the ranges a person authored — and the revisions the rows are registered under.
  expansion: async (context, held) => {
    const scope = { tenantId: context.tenantId, projectId: context.projectId };
    const expansion = resolveExpansion({
      placements: held.placements?.placements ?? [],
      views: held.views.flatMap((view) => (view.anchorKey === null ? [] : [{ caption: view.caption, view: { viewClass: view.type, captionAnchorSourceKey: view.anchorKey } }])),
      levels: await liveStackOf(scope.tenantId, scope.projectId),
      ranges: await authoredRangesOf(scope.tenantId, scope.projectId),
    });

    // A sighting is scoped to a pinned set revision (L-REG-03). A drawing no pinned revision names is
    // a drawing nothing has been measured under yet: it is placed and resolved all the same, and the
    // register stands empty until somebody pins a set that carries it (L-REG-06).
    const revisions = await revisionsNaming({ ...scope, drawingId: context.drawingId, sha256: context.record.sha256 });
    let registered = 0;
    let standing = 0;
    for (const setRevisionId of revisions) {
      const pass = await registerExpansion({ ...scope, setRevisionId }, expansion.rows);
      registered += pass.registered;
      standing += pass.standing;
    }

    return { derived: { ...held, expansion }, detail: { revisions: revisions.length, registered, standing, deferred: expansion.deferrals.length } };
  },
  // The seventh: the level stack the sections STATE, read into a proposal a person confirms whole.
  // Nothing here authors a level — "the machine proposes a stack, never a level" (L-ACT-03).
  "levels-proposal": (context, held) => {
    const proposal = proposeLevelStack({ graph: context.graph, views: held.views, assignments: held.assignments });
    return { derived: { ...held, proposal }, detail: { views: proposal.views, proposed: proposal.levels.length } };
  },
});

/**
 * The classes a silent caption may be proposed as: the vocabulary less the two that stand for "not
 * read at all". A model proposing UNTYPED would be proposing the answer the grammar already gave,
 * and UNASSIGNED is what a view with no caption is — neither is a reading of a caption (L-CAD-06).
 */
const CLASSIFIABLE: readonly ViewType[] = VIEW_TYPES.filter((type) => type !== VIEW_TYPE.UNTYPED && type !== VIEW_TYPE.UNASSIGNED);

/**
 * One record's partition, rebuilt (R-TO-030). Idempotent on the record it names: the rewrite deletes
 * and re-inserts that record's rows, and every key is derived from the artifact rather than minted,
 * so a second run over the same artifact leaves the same rows (L-REG-04, SEAM-JOBS).
 */
export async function runPartitionJob(payload: JobPayloads["partition"], progress: JobProgress, deps: PartitionDeps): Promise<void> {
  const { tenantId, drawingId, ingestId } = payload;

  const projectId = await drawingProjectOf(tenantId, drawingId);
  // The door judged both of these before it enqueued anything; a job that reaches here with either
  // of them untrue was enqueued past the door, and it is answered rather than retried.
  if (projectId === null) throw refusal(REFUSALS.WORKSPACE_PERMISSION_NOT_HELD.code, `drawing ${drawingId} is not a drawing this workspace holds`);
  const record = (await ingestRecords({ tenantId, drawingId })).find((candidate) => candidate.ingestId === ingestId);
  if (record === undefined) throw refusal(REFUSALS.PARTITION_NOT_AVAILABLE.code, `no ingest record ${ingestId} stands for drawing ${drawingId}, so there is no artifact to partition`);

  const graph = await artifactOf(tenantId, record, deps.storage);
  await progress.step(STEP_RESOLVE, { ingest_id: ingestId, artifact_sha256: record.artifactSha256 });

  let derived: StagedPartition = { views: [], assignments: new Map(), conventions: null, grid: null, schedules: null, placements: null, expansion: null, proposal: null };
  for (const stage of PARTITION_STAGES) {
    const outcome = await STAGES[stage]({ record, graph, tenantId, projectId, drawingId }, derived);
    derived = outcome.derived;
    await progress.step(stage, outcome.detail);
  }

  const proposals = await proposalsFor(derived.views, {
    ctx: { tenantId, projectId, actor: payload.requestedBy, requestId: progress.jobId },
    graph,
    record,
    progress,
    captions: deps.captions ?? PRODUCTION_CAPTIONS,
    held: await storedViewsOf(tenantId, ingestId),
  });

  await rewritePartition({
    tenantId,
    projectId,
    drawingId,
    ingestId,
    views: derived.views,
    assignments: derived.assignments,
    proposals,
    conventions: derived.conventions,
    grid: derived.grid,
    schedules: derived.schedules,
    placements: derived.placements,
    expansion: derived.expansion,
    proposal: derived.proposal,
  });
  await progress.step(STEP_STORED, { views: derived.views.length, assigned: derived.assignments.size, proposed: proposals.size });
}

/** What the proposal pass is run with: whom the call is attributed to, and what it may cite. */
type ProposalPass = {
  readonly ctx: ModelCallContext;
  readonly graph: EntityGraph;
  readonly record: IngestRecord;
  readonly progress: JobProgress;
  readonly captions: ViewCaptionSeam;
  /** The partition that stands for this record now, so a question already answered is not re-asked. */
  readonly held: readonly ViewRecord[];
};

/**
 * What a model proposes for the views the grammar could not read — and nothing for the views it
 * could: a caption that was classified asks no model, because L-AI-03 puts the grammar first and a
 * call made anyway would spend a tenant's money on an answer nobody would use (L-AI-01).
 */
async function proposalsFor(views: readonly PartitionedView[], pass: ProposalPass): Promise<Map<string, ViewProposal>> {
  const proposals = new Map<string, ViewProposal>();
  const citable = pass.graph.entities.map((entity) => entity.key);
  const held = new Map(pass.held.filter((view) => view.proposed !== null).map((view) => [view.viewKey, view.proposed]));

  for (const view of views) {
    if (!asksAModel(view)) continue;
    // A proposal already standing for this very view is carried, not asked for again: the view key
    // is the class and the caption's own entity, so the question a second run would put to a model
    // is the question the ledger already holds the answer to — and asking it again would spend a
    // tenant's money to learn the same thing (L-AI-01, L-REG-04).
    const standing = held.get(view.viewKey);
    if (standing !== undefined && standing !== null) {
      proposals.set(view.viewKey, { viewKey: view.viewKey, type: standing.type, callId: standing.callId });
      continue;
    }
    const anchorKey = view.anchorKey ?? "";
    let proposed: ViewProposal | null = null;
    try {
      const proposal = await pass.captions.proposeViewType(pass.ctx, {
        caption: view.caption,
        anchorKey,
        classifiable: CLASSIFIABLE,
        artifact: sourceKeyResolver(pass.record.artifactSha256, citable),
      });
      // The question offered the classifiable set and the seam answers out of it, so what comes
      // back is a member of the vocabulary already: an answer outside it never decodes, and this
      // path never sees one to re-judge (L-AI-02).
      proposed = { viewKey: view.viewKey, type: proposal.payload.type, callId: proposal.callId };
    } catch (failure) {
      const code = refusalCodeOf(failure);
      // A model that would not answer is an answer about the model, not about the drawing: anything
      // that is not a refusal is a fault and travels on untouched (ARCH-03, B-21).
      if (code === null) throw failure;
      await pass.progress.step(STEP_PROPOSAL_REFUSED, { refusal: code, view_key: view.viewKey });
    }
    if (proposed !== null) proposals.set(view.viewKey, proposed);
  }
  return proposals;
}

/** Is this a view a model is asked about? Only one the grammar was silent on, and that has a caption. */
function asksAModel(view: PartitionedView): boolean {
  return (view.type as ViewType) === VIEW_TYPE.UNTYPED && view.anchorKey !== null;
}

/** The artifact a record was written from, read back and validated against the one mirror (L-CAD-05). */
async function artifactOf(tenantId: string, record: IngestRecord, storage: Storage): Promise<EntityGraph> {
  const bytes = await storage.get(tenantId, record.artifactSha256);
  // An artifact a record points at that the store does not hold is an outage of ours, not the
  // drawing's fault: the record and the object were written together (ARCH-03).
  if (bytes === null) throw new Error(`the store holds no artifact at ${record.artifactSha256} for ingest ${record.ingestId} (SEAM-STORAGE)`);
  const parsed = entityGraphSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
  if (!parsed.success) throw new Error(`the artifact at ${record.artifactSha256} is not an EntityGraph this tree reads: ${parsed.error.message}`);
  return parsed.data;
}
