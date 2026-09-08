/**
 * The mechanics L-CAD-08's convention profile is graded on (R-TO-030, V-VERIFY, SEAM-TENANT).
 *
 * Mechanics only — nothing here judges the product. The database, the storage root, the accounts,
 * the recorded drawing and the stand-in for the `cad/` CLI all come from the stage the stored
 * partition already runs on (`./partition-stage`), so this file adds exactly what a convention
 * profile needs beyond a partitioned ingest: an artifact whose MODEL SPACE really carries linework,
 * closed rings, text and dimensions on layers of their own, the doors the criteria drive, and the
 * store read they are graded by.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one the increment's interfaces, its test
 * contract or the Bible publishes.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { expect } from "vitest";
import { TENANT_COLUMN } from "../../../../db/__tests__/support/fixtures";
import { ident, lit } from "../../../../db/__tests__/support/live-sql";
import {
  CAPTION_HEIGHT,
  REPO_ROOT,
  INGEST_JOB_MODULE,
  INGEST_MODULE,
  LABEL_HEIGHT,
  MODEL_SPACE,
  PAPER_SPACE,
  PARTITION_MODULE,
  productModule,
  rebuildDoor,
  sql,
  stepSink,
  storageOf,
  tempDir,
  unique,
  type JsonValue,
  type Person,
  type ProgressLike,
  type StagedDrawing,
  type StepRecord,
} from "./partition-stage";
import { stageDrawing, stubCli, withCadCommand } from "../../support/ingest-stage";

export { MODEL_SPACE, PAPER_SPACE };

/* ------------------------------------------------------------------ the homes the spec names */

/** The pure method and the manifest shard beside it (increment interfaces). */
export const RESOLVE_MODULE = "src/core/rulesets/methods/conventions/resolve.ts";
export const METHOD_SHARD = "src/core/rulesets/methods/conventions/conventions.methods.json";

/** The census the partition module builds, and the door that reads a stored profile back. */
export const CENSUS_MODULE = "src/modules/takeoff/partition/conventions/census.ts";
export const PROFILE_MODULE = PARTITION_MODULE;

/**
 * The runner that loads one product module in a world where nothing outside `src/core/` exists,
 * and the module this acceptance uses as its control — the partition's own composition file, which
 * reaches the ingest module and the object store and therefore cannot load in such a world.
 */
export const CORE_ONLY_RUNNER = "tests/takeoff/partition/conventions/load-under-core-only.mts";
export const IMPURE_CONTROL = "src/modules/takeoff/partition/rebuild.ts";

/** The toolchain surfaces AC-3 drives (test contract). */
export const METHOD_HASH_SCRIPT = "scripts/method-hashes.mjs";
export const METHOD_HASH_LANE = "method-hash";
export const METHOD_HASH_GREEN = "manifest(s) match their recorded digests";

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The method, as an edition enumerates one (test contract: `conventions.resolve@1`). */
export const RULE_ID = "conventions.resolve";
export const RULE_VERSION = "1";
export const METHOD_ID = `${RULE_ID}@${RULE_VERSION}`;
export const METHOD_LAW = "L-CAD-08";

/** The stage this increment adds, and the whole step roster a run records (test contract). */
export const CONVENTIONS_STAGE = "conventions";
export const PARTITION_STEPS: readonly string[] = ["resolve", "views", CONVENTIONS_STAGE, "stored"];

/** The four roles a profile names, in the order `CONVENTION_ROLES` declares them (test contract). */
export const ROLE_LINEWORK = "linework";
export const ROLE_OUTLINES = "outlines";
export const ROLE_TEXT = "text";
export const ROLE_DIMENSIONS = "dimensions";
export const ROLES: readonly string[] = [ROLE_LINEWORK, ROLE_OUTLINES, ROLE_TEXT, ROLE_DIMENSIONS];

/** The deferral a role no layer carries earns (test contract, Q-07's register). */
export const CONVENTION_ROLE_UNRESOLVED = "CONVENTION_ROLE_UNRESOLVED";

/** The table one ingest's profile is stored in (test contract). */
export const CONVENTION_PROFILES = "convention_profiles";

/** The layer names the staged artifacts carry — census data, never environment names. */
export const LAYER_GRID = "GRID";
export const LAYER_WALLS = "WALLS";
export const LAYER_NOTES = "NOTES";
export const LAYER_DIMS = "DIMS";
export const LAYER_AXES = "AXES";
export const LAYER_CAPTIONS = "CAPTIONS";
export const LAYER_LABELS = "LABELS";
export const LAYER_TITLEBLOCK = "TITLEBLOCK";

/** The DXF types the artifact is built from — the entity kinds the census tallies apart. */
export const TYPE_TEXT = "TEXT";
export const TYPE_LINE = "LINE";
export const TYPE_RING = "LWPOLYLINE";
export const TYPE_DIMENSION = "DIMENSION";

/* ------------------------------------------------------------------ the shapes the doors answer in */

/** One layer's tallies (increment interfaces: `LayerCensus`). */
export type LayerCensus = { layer: string; paths: number; rings: number; texts: number; dimensions: number };

/** One grammar's tally (increment interfaces: `GrammarCensus`). */
export type GrammarCensus = { grammar: string; captions: number };

/** What the resolver is given (increment interfaces: `EntityCensus`). */
export type EntityCensus = { layers: LayerCensus[]; grammars: GrammarCensus[] };

/** One deferred role (increment interfaces: `ConventionDeferral`). */
export type ConventionDeferral = { code: string; role: string };

/** What the resolver answers (increment interfaces: `ConventionProfile`). */
export type ConventionProfile = { roles: Record<string, string[]>; captionGrammars: string[]; deferrals: ConventionDeferral[] };

/** The pure method's module, as this acceptance reads it. */
export type ResolveSeam = {
  resolve: (census: EntityCensus, seed?: unknown) => ConventionProfile;
  CONVENTIONS_METHOD: { ruleId: string; version: string };
  CONVENTION_ROLES: readonly string[];
};

/** The census builder the partition module publishes. */
export type CensusSeam = { censusOf: (graph: unknown, views: unknown) => EntityCensus };

/** The views stage's own result, as `rebuild.ts` runs it (`partitionArtifact`). */
export type ViewsResult = { views: readonly { viewKey: string; type: string }[] };

/** What `conventionProfileOf` answers for a drawing whose partition has been rebuilt. */
export type StoredProfile = { ingestId: string; ruleId: string; ruleVersion: string; profile: ConventionProfile; census: EntityCensus };

/** The module door that reads a stored profile back (increment interfaces). */
export type ProfileDoor = { conventionProfileOf: (scope: { tenantId: string; projectId: string; drawingId: string }) => Promise<StoredProfile | null> };

/** One stored `convention_profiles` row, as the acceptance's own audit read returns one. */
export type ProfileRow = { ruleId: string; ruleVersion: string; profile: ConventionProfile; census: EntityCensus; projectId: string; drawingId: string };

/* ------------------------------------------------------------------ loading the doors */

/** One door, with the calls this stage makes through it asserted by name before it is used. */
async function doorOf<T>(home: string, calls: readonly string[]): Promise<T> {
  const door = await productModule<Record<string, unknown>>(home);
  for (const call of calls) expect(typeof door[call], `${home} publishes \`${call}\``).toBe("function");
  return door as T;
}

/** L-CAD-08's pure method, with the constants an edition would cite it by. */
export async function resolveDoor(): Promise<ResolveSeam> {
  return doorOf<ResolveSeam>(RESOLVE_MODULE, ["resolve"]);
}

/** The census the partition module builds from an artifact and the views stage's result. */
export async function censusDoor(): Promise<CensusSeam> {
  return doorOf<CensusSeam>(CENSUS_MODULE, ["censusOf"]);
}

/** The takeoff module's door onto a stored profile. */
export async function profileDoor(): Promise<ProfileDoor> {
  return doorOf<ProfileDoor>(PROFILE_MODULE, ["conventionProfileOf"]);
}

/**
 * The views stage's own result for an artifact — what the census is built beside. The stage list
 * runs `partitionArtifact` as its `views` member, so this is that stage, called directly.
 */
export async function viewsResultOf(graph: unknown): Promise<ViewsResult> {
  const assign = await doorOf<{ partitionArtifact: (graph: unknown) => ViewsResult }>("src/modules/takeoff/partition/views/assign.ts", ["partitionArtifact"]);
  return assign.partitionArtifact(graph);
}

/**
 * The census the product builds for an artifact. The views stage's result is handed over as its
 * views — the list the census reads a caption's class off (increment interfaces: `censusOf`).
 */
export async function censusOfArtifact(graph: unknown): Promise<EntityCensus> {
  const { censusOf } = await censusDoor();
  return censusOf(graph, (await viewsResultOf(graph)).views);
}

/**
 * Load one product module in a world where every specifier it asks for must resolve inside
 * `src/core/` — the purity of a pure method, OBSERVED: the module's own import graph, seen through
 * Node's resolver as it is really loaded (AC-2). A module that reaches out of core cannot load at
 * all, and says which specifier took it out.
 */
export function loadsUnderCoreOnly(relative: string): { ok: boolean; said: string } {
  const ran = spawnSync(join(REPO_ROOT, "node_modules", ".bin", "tsx"), [join(REPO_ROOT, CORE_ONLY_RUNNER), relative], {
    cwd: REPO_ROOT,
    env: { ...process.env },
    encoding: "utf8",
    timeout: 300_000,
  });
  return { ok: ran.status === 0, said: `${ran.stdout ?? ""}${ran.stderr ?? ""}` };
}

/* ------------------------------------------------------------------ a hand-authored artifact */

/** A colour every built entity carries: channels, never a spelled colour (the artifact's own shape). */
const CHANNELS = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" };

/** One drawn record of the built artifact, in the shape the mirror validates (L-CAD-05). */
type Drawn = { key?: string; src?: string; type: string; space: string; layer: string; text?: string; height?: number; points?: number[][]; closed?: boolean };

/** What the built artifact carries, so a criterion derives its expectations from it (B-19). */
export type BuiltConventionArtifact = {
  /** The artifact as bytes, for the stand-in CLI to write. */
  json: string;
  /** The graph, as an object — what `censusOf` is handed. */
  graph: Record<string, JsonValue>;
  /** Every ORIGINAL record, model space and paper alike. */
  originals: readonly Drawn[];
  /** The captions its model space carries, in the order they were drawn. */
  captions: readonly string[];
  /** The per-layer tallies the census rule takes over its model-space originals, by layer. */
  layers: LayerCensus[];
};

/** A source key of the DXF-handle scheme, from an ordinal (L-CAD-02). */
function handle(ordinal: number): string {
  return `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;
}

/** Sorted by the layer they tally, in code-point order (L-REG-05: no locale sorts anything). */
export function byLayer(layers: readonly LayerCensus[]): LayerCensus[] {
  return [...layers].sort((left, right) => (left.layer < right.layer ? -1 : left.layer > right.layer ? 1 : 0));
}

/** Sorted by the grammar they tally, the same way. */
export function byGrammar(grammars: readonly GrammarCensus[]): GrammarCensus[] {
  return [...grammars].sort((left, right) => (left.grammar < right.grammar ? -1 : left.grammar > right.grammar ? 1 : 0));
}

/**
 * The per-layer tallies of a set of ORIGINAL records, taken the way AC-4 states the rule: a record
 * that carries text is a text, else one typed DIMENSION is a dimension, else a closed one is a ring,
 * else one carrying points is a path. Paper-space records take no part, and derived paint is never
 * handed in at all — it is not an atom a source key names (L-CAD-03).
 *
 * This is the acceptance's own reading of the rule over the artifact it built, so an artifact that
 * changes changes the expectation with it.
 */
export function layerCensusOf(originals: readonly Drawn[]): LayerCensus[] {
  const tallies = new Map<string, LayerCensus>();
  for (const record of originals) {
    if (record.space !== MODEL_SPACE) continue;
    const tally = tallies.get(record.layer) ?? { layer: record.layer, paths: 0, rings: 0, texts: 0, dimensions: 0 };
    if (record.text !== undefined) tally.texts += 1;
    else if (record.type === TYPE_DIMENSION) tally.dimensions += 1;
    else if (record.closed === true) tally.rings += 1;
    else if (record.points !== undefined) tally.paths += 1;
    tallies.set(record.layer, tally);
  }
  return byLayer([...tallies.values()]);
}

/** What a built artifact is asked for: which drawing it is, and whether it was ever dimensioned. */
export type ConventionArtifactSpec = {
  /** Mints the source keys, so two artifacts built here are two different drawings. */
  salt: number;
  /** Whether its model space carries DIMENSION entities at all (a drawing nobody dimensioned). */
  dimensioned: boolean;
};

/**
 * An EntityGraph v2 whose model space carries each entity kind on a layer of its own: open lines on
 * `GRID` and `AXES`, closed rings on `WALLS`, dimensions on `DIMS`, view captions on `CAPTIONS`,
 * small labels on `LABELS` and notes on `NOTES`.
 *
 * Two things stand there to be NOT counted: a paper layout carrying a title on `NOTES` and a border
 * on `GRID`, and one record of derived paint that would read as a `WALLS` ring. A census that
 * counted either would tally a layer differently from the one this stage derives.
 */
export function buildConventionArtifact(spec: ConventionArtifactSpec): BuiltConventionArtifact {
  const base = spec.salt * 0x10000;
  let ordinal = 0;
  const next = (): string => handle(base + (ordinal += 1));
  const originals: Drawn[] = [];

  const captions = ["TYPICAL FLOOR PLAN", "COLUMN SCHEDULE"];
  captions.forEach((caption, index) => {
    const x = index * 200;
    originals.push({ key: next(), type: TYPE_TEXT, space: MODEL_SPACE, layer: LAYER_CAPTIONS, text: caption, height: CAPTION_HEIGHT, points: [[x, 0]] });
    originals.push({ key: next(), type: TYPE_TEXT, space: MODEL_SPACE, layer: LAYER_LABELS, text: "C1", height: LABEL_HEIGHT, points: [[x + 1, -2]] });
    originals.push({ key: next(), type: TYPE_TEXT, space: MODEL_SPACE, layer: LAYER_LABELS, text: "300x450", height: LABEL_HEIGHT, points: [[x + 2, -3]] });

    // Linework: open paths, three of them per caption cluster.
    for (let line = 0; line < 3; line += 1) {
      originals.push({ key: next(), type: TYPE_LINE, space: MODEL_SPACE, layer: LAYER_GRID, points: [[x, -5 - line], [x + 8, -5 - line]] });
    }
    // Outlines: closed rings, two per cluster.
    for (let ring = 0; ring < 2; ring += 1) {
      originals.push({
        key: next(),
        type: TYPE_RING,
        space: MODEL_SPACE,
        layer: LAYER_WALLS,
        closed: true,
        points: [[x, -20 - ring], [x + 4, -20 - ring], [x + 4, -24 - ring], [x, -24 - ring]],
      });
    }
    // Notes: text that is not a caption, on a layer of its own.
    originals.push({ key: next(), type: TYPE_TEXT, space: MODEL_SPACE, layer: LAYER_NOTES, text: "NOTE: refer to schedule", height: LABEL_HEIGHT, points: [[x + 3, -30]] });
    if (spec.dimensioned) {
      originals.push({ key: next(), type: TYPE_DIMENSION, space: MODEL_SPACE, layer: LAYER_DIMS, points: [[x, -35], [x + 8, -35]] });
    }
  });

  // Two axes far from every caption: whatever the clustering rule is, this geometry is what an
  // anchorless view is for — and it is linework on a second layer either way.
  originals.push({ key: next(), type: TYPE_LINE, space: MODEL_SPACE, layer: LAYER_AXES, points: [[9000, 9000], [9000, 9400]] });
  originals.push({ key: next(), type: TYPE_LINE, space: MODEL_SPACE, layer: LAYER_AXES, points: [[9000, 9000], [9400, 9000]] });

  // The paper layout: a title on NOTES and a border on GRID, so a census that counted paper space
  // would tally two model-space layers differently.
  originals.push({ key: next(), type: TYPE_TEXT, space: PAPER_SPACE, layer: LAYER_NOTES, text: "S-101 GENERAL ARRANGEMENT", height: 3, points: [[5, 5]] });
  originals.push({ key: next(), type: TYPE_LINE, space: PAPER_SPACE, layer: LAYER_TITLEBLOCK, points: [[0, 0], [297, 210]] });
  originals.push({ key: next(), type: TYPE_LINE, space: PAPER_SPACE, layer: LAYER_GRID, points: [[0, 0], [297, 0]] });

  // Exploded paint that would read as a WALLS ring if it were counted (L-CAD-03: not an atom).
  const painted = originals.find((record) => record.space === MODEL_SPACE && record.type === TYPE_LINE);
  const derived: Drawn[] = [
    {
      src: String(painted?.key ?? handle(base + 1)),
      type: TYPE_RING,
      space: MODEL_SPACE,
      layer: LAYER_WALLS,
      closed: true,
      points: [[0, 0], [1, 0], [1, 1], [0, 1]],
    },
  ];

  const graph: Record<string, JsonValue> = {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      { name: MODEL_SPACE, kind: "model", bbox: { min: [0, -40], max: [9400, 9400] }, strays_rejected: 0 },
      { name: PAPER_SPACE, kind: "paper", bbox: { min: [0, 0], max: [297, 210] }, strays_rejected: 0 },
    ] as unknown as JsonValue,
    dropped_layouts: [],
    entities: originals.map((record) => ({ ...record, colour: CHANNELS })) as unknown as JsonValue,
    derived: derived.map((record) => ({ ...record, colour: CHANNELS })) as unknown as JsonValue,
    block_attributes: [],
    counters: [],
  };

  return { json: JSON.stringify(graph), graph, originals, captions, layers: layerCensusOf(originals) };
}

/* ------------------------------------------------------------------ staging a drawing to profile */

/** A drawing of a built artifact, recorded by the shipped ingest pipeline. */
export type StagedConventionIngest = { drawing: StagedDrawing; ingestId: string; artifact: BuiltConventionArtifact };

/**
 * A recorded drawing whose ingest artifact is the built one: the bytes are seeded into the store,
 * and the shipped ingest job is run over a stand-in CLI that hands back the artifact. What lands is
 * a real `ingests` row, written by the product's own pipeline (the same staging the stored
 * partition's own suites do — B-17).
 */
export async function stageConventionIngest(person: Person, projectId: string, spec: ConventionArtifactSpec, label: string): Promise<StagedConventionIngest> {
  const job = await productModule<{ runIngestJob: (payload: unknown, progress: ProgressLike, deps: { storage: unknown }) => Promise<void> }>(INGEST_JOB_MODULE);
  const records = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> }>(INGEST_MODULE);

  const artifact = buildConventionArtifact(spec);
  const bytes = new TextEncoder().encode(`0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n; ${label}\n`);
  const drawing = await stageDrawing(person, projectId, bytes, { name: unique(`${label}.dxf`), format: "dxf" });
  const stub = stubCli({ artifact: artifact.json, stderr: "", exitCode: 0 });

  await withCadCommand(stub.command, async () => {
    await job.runIngestJob(
      { tenantId: person.tenantId, drawingId: drawing.drawingId, requestedBy: person.userId, declared: null },
      { jobId: unique(`ingest-${label}`), tempDir: tempDir("ingest"), step: async () => undefined },
      { storage: await storageOf() },
    );
  });

  const record = await records.ingestRecordOf({ tenantId: person.tenantId, drawingId: drawing.drawingId });
  expect(record, `staging ${label} left no ingest record — a partition is a reading of a record`).not.toBeNull();
  return { drawing, ingestId: (record as { ingestId: string }).ingestId, artifact };
}

/** One run of the shipped partition job over a staged ingest, with the steps it recorded. */
export async function runConventionPartition(person: Person, staged: StagedConventionIngest, label = "conventions"): Promise<StepRecord[]> {
  const rebuild = await rebuildDoor();
  const sink = stepSink(label);
  await rebuild.runPartitionJob(
    { tenantId: person.tenantId, drawingId: staged.drawing.drawingId, ingestId: staged.ingestId, requestedBy: person.userId },
    sink.progress,
    { storage: await storageOf() },
  );
  return sink.steps;
}

/* ------------------------------------------------------------------ reading the store */

/** Every `convention_profiles` row of one ingest, as the acceptance's own audit read. */
export function conventionProfileRows(tenantId: string, ingestId: string): ProfileRow[] {
  return sql(
    `select rule_id, rule_version, profile::text, census::text, project_id::text, drawing_id::text
       from ${ident(CONVENTION_PROFILES)}
      where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid
      order by rule_id, rule_version;`,
  ).map((row) => ({
    ruleId: row[0] ?? "",
    ruleVersion: row[1] ?? "",
    profile: JSON.parse(row[2] ?? "null") as ConventionProfile,
    census: JSON.parse(row[3] ?? "null") as EntityCensus,
    projectId: row[4] ?? "",
    drawingId: row[5] ?? "",
  }));
}
