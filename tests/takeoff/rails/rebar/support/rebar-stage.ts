/**
 * The live ground the rebar rail's two campaign criteria stand on (AC-7, AC-8).
 *
 * Everything is driven through the shipped doors: the workspace is enrolled, the project is created
 * through `createProject` (forking the tenant template that cites this shard's five pairs), the
 * general-notes sheet is ingested by the shipped ingest job, the set is pinned by the pin act — which
 * opens the campaign — the level stack and its storey heights are authored by acts, the register
 * records one object per member through `registerSighting`, a note is read by
 * TRANSCRIBE_SHEET_NOTES, and the campaign is measured by `runMeasureJob` with the shipped `RAILS`
 * roster and the real gate.
 *
 * ONE SEAM IS STOOD IN FOR, and it is named here rather than hidden: no reader of a column schedule
 * ships at this leaf (scope), so nothing has stored the PLACEMENTS and the MEMBER-TYPE VARIANTS the
 * partition would have stored for these members. This stage builds those two maps from the members a
 * case states and folds them into the setup the job itself loaded — every other seam of that setup,
 * the detailing values and the edition digest included, is the product's own `railSetupOf` answer.
 * What is graded is what the rail makes of a setup, and this is the setup a partitioned drawing
 * would have given it.
 *
 * Nothing here judges the product: the assertions are mechanical (a door exists, an act committed, a
 * row landed), and every criterion is beside it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, vi } from "vitest";
import { ROLE_APP } from "../../../../../db/__tests__/support/fixtures";
import { lit } from "../../../../../db/__tests__/support/live-sql";
import { BNBC_SHEET_TEXTS, type SheetText } from "../../../notes/support/bnbc-notes";
import { notesDoor, performAct as performNoteAct, stageNotesSheet, stageRevisionHolding, transcription, reading as noteReading } from "../../../notes/support/notes-stage";
import {
  COLUMN_C1,
  OFFER_NOT_TO_CONTRACT,
  QUANTITY_LINES_TABLE,
  RAIL_OBSERVATIONS_TABLE,
  actorOf,
  campaignsSeam,
  closeStage,
  createProjectThroughDoor,
  enrol,
  field,
  gateSeam,
  insertion,
  openSheetsStage,
  performAct,
  productModule,
  registerSeam,
  rowsOfCampaign,
  sql,
  stageTenantTemplate,
  storeRows,
  unique,
  type Person,
  type RegisterScope,
  type Sighting,
  type StoreRow,
} from "../../../gate/support/gate-stage";
import { heightReading } from "../../../levels/support/levels-stage";
import {
  BNBC_MODEL,
  COLUMN_CLASS,
  MEASURE_JOB_MODULE,
  MEASURE_SETUP_MODULE,
  NOTES_MODULE,
  RCC_REBAR,
  REBAR_PAIRS,
  REPO_ROOT,
  detailingUnread,
  railsRoster,
  rebarRailDoor,
  variant,
  zone,
  type BarRowShape,
  type BbsDocumentShape,
  type DetailingSetupShape,
  type PlacementSetupShape,
  type RailInputShape,
  type RailSetupShape,
  type RebarZoneSetupShape,
  type VariantSetupShape,
} from "./rebar-contract";

export * from "./rebar-contract";
export { closeStage, field, storeRows, rowsOfCampaign, OFFER_NOT_TO_CONTRACT, QUANTITY_LINES_TABLE, RAIL_OBSERVATIONS_TABLE, ROLE_APP };
export type { StoreRow };

/**
 * The privileges the app role holds on a store, as the catalogue reports them.
 *
 * What a campaign can do to a line that already stands is a fact about the STORE, not about the
 * rail: a re-offer can only re-present a standing row where the role that writes it may move one.
 */
export function privilegesOf(table: string): string[] {
  return sql(
    `select distinct privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name = ${lit(table)} and grantee = ${lit(ROLE_APP)}
      order by privilege_type;`,
  )
    .map((row) => String(row[0] ?? ""))
    .sort();
}

/** The calibration every staged view stands affirmed at — a rail cites what the setup holds. */
const CALIBRATION_KEY = "CAL:S-01:grid-A";

/** The two zones a column schedule states for a mark (interfaces: `RebarZoneSetup.zone`). */
const MAIN_ZONE = "main";
const TIES_ZONE = "ties";

/** The slot a member that stands on no level of the stack stands in (L-REG-02). */
export const FOUNDATION_SLOT = "FOUNDATION";

/** One member a campaign is staged over, as a case states it (interfaces). */
export type StagedRebarMember = {
  /** This acceptance's own name for the row — never part of any key. */
  id: string;
  class: string;
  mark: string;
  /** The level the member stands on, or the foundation slot where it stands on none. */
  level: string;
  section: { b: number; d: number };
  mains: { n: number; diameterMm: number };
  ties?: { diameterMm: number; spacingMm: number };
};

/** One level of the stack a case states, with the storey height authored for it. */
export type StagedLevel = { label: string; heightMm: string };

/** What a case asks the stage for. */
export type RebarStageOptions = {
  levels: readonly StagedLevel[];
  /** The detailing the campaign applies: a stated setup, or "door" to read whatever the notes say. */
  detailing: DetailingSetupShape | "door";
  /** The texts the staged sheet carries — the fixture's own general notes unless a case says otherwise. */
  notes?: readonly SheetText[];
};

/** Everything a criterion driven over a real campaign is handed. */
export type RebarStage = {
  person: Person;
  actor: { tenantId: string; userId: string; actorKind: string };
  tenantId: string;
  projectId: string;
  setRevisionId: string;
  campaignId: string;
  editionId: string;
  scope: { tenantId: string; projectId: string };
  gateScope: { tenantId: string; projectId: string; campaignId: string };
  registerScope: RegisterScope;
  sheet: { drawingId: string; ingestId: string; layoutName: string };
  levels: { levelId: string; label: string; ordinal: number }[];
  members: StagedRebarMember[];
  /** The register rows the campaign holds, in the order the members were staged. */
  objects: Record<string, unknown>[];
  /** The two seams this stage stands in for, folded into whatever setup the job loads. */
  placements: Record<string, PlacementSetupShape>;
  memberTypes: Record<string, readonly VariantSetupShape[]>;
  calibrations: Record<string, string>;
  /** The detailing a case stated, or null where it asked for the notes door's own answer. */
  stated: DetailingSetupShape | null;
};

/** What the measure job reported, and what the gate made of the batch it was handed. */
export type MeasuredCampaign = {
  steps: { step: string; detail?: Record<string, unknown> }[];
  verdict: { published: number; refused: number; queued: number; refusals: readonly { objectKey: string; code: string }[] };
  /** The rail input the job built and the rail was run over — the setup included (L-MEA-08). */
  input: RailInputShape;
  offers: readonly Record<string, unknown>[];
  observations: readonly Record<string, unknown>[];
};

/* ------------------------------------------------------------------ the model the members come from */

/** One member of the fixture's own model, as it records one. */
type ModelMember = { id: string; class: string; mark: string; level: string; b?: string; d?: string; h?: string; nbar?: number; dbar?: number };

/** One bar of the fixture's own model — where a mark's tie diameter and spacing are read from. */
type ModelBar = { member: string; class: string; role: string; dia: number; zones?: { zone: string; length_mm: string; spacing_mm: string }[] | null };

/** The fixture's model, read as the data it is. */
function model(relative: string = BNBC_MODEL): { storeys: Record<string, string>; members: ModelMember[]; bars: ModelBar[] } {
  return JSON.parse(readFileSync(join(REPO_ROOT, relative), "utf8")) as { storeys: Record<string, string>; members: ModelMember[]; bars: ModelBar[] };
}

/** The storey height the fixture states for each level, in millimetres (test contract: `storeys`). */
export function modelStoreys(relative: string = BNBC_MODEL): StagedLevel[] {
  return Object.entries(model(relative).storeys).map(([label, heightMm]) => ({ label, heightMm: String(heightMm) }));
}

/**
 * Every COLUMN of the fixture's model, as this leaf stages one: its section, the main-bar group its
 * schedule states (n × dbar) and the tie the model's own bars carry for it. A column of the
 * foundation level stands in the FOUNDATION slot, on no level of the stack (L-REG-02).
 */
export function columnMembersOf(relative: string = BNBC_MODEL): StagedRebarMember[] {
  const held = model(relative);
  const ties = new Map<string, { diameterMm: number; spacingMm: number }>();
  for (const bar of held.bars) {
    if (bar.class !== "COLUMN" || (bar.role !== "TIE" && bar.role !== "STIRRUP")) continue;
    const spacing = (bar.zones ?? []).find((one) => Number(one.spacing_mm) > 0);
    if (spacing === undefined || ties.has(bar.member)) continue;
    ties.set(bar.member, { diameterMm: bar.dia, spacingMm: Number(spacing.spacing_mm) });
  }
  return held.members
    .filter((member) => member.class === "COLUMN")
    .map((member) => ({
      id: member.id,
      class: COLUMN_CLASS,
      mark: member.mark,
      level: member.level === "FDN" ? FOUNDATION_SLOT : member.level,
      section: { b: Number(member.b), d: Number(member.d) },
      mains: { n: Number(member.nbar), diameterMm: Number(member.dbar) },
      ties: ties.get(member.id),
    }));
}

/* ------------------------------------------------------------------ staging the campaign */

/** The levels of the project's live stack, as the levels module answers them. */
async function levelsOf(scope: { tenantId: string; projectId: string }): Promise<{ levelId: string; label: string; ordinal: number }[]> {
  const door = await productModule<{ levelStackOf: (s: { tenantId: string; projectId: string }) => Promise<{ levelId: string; label: string; ordinal: number }[]> }>("src/modules/takeoff/levels/index.ts");
  return door.levelStackOf(scope);
}

/**
 * A campaign over `members`: a workspace, a project pinned to a template citing the five rebar
 * pairs, one ingested general-notes sheet in the pinned revision, the level stack and its storey
 * heights authored by acts, and one register object per member.
 *
 * The rail door is asked for FIRST, so a tree where the rebar engine has not been written yet fails
 * by naming the missing module rather than spending minutes staging a campaign for nothing.
 */
export async function stageRebarCampaign(label: string, members: readonly StagedRebarMember[], options: RebarStageOptions): Promise<RebarStage> {
  await rebarRailDoor();
  await openSheetsStage();

  const person = await enrol(`rebar-${label}`);
  const tenantId = person.tenantId;
  await stageTenantTemplate(tenantId, REBAR_PAIRS);
  const projectId = await createProjectThroughDoor(person, unique(`Rebar ${label}`));
  const actor = actorOf(person) as { tenantId: string; userId: string; actorKind: string };
  // No role is granted here: L-ACT-03 has project creation install its creator as PRINCIPAL in the
  // same transaction, so the shipped door has already done it and a second grant would collide.
  const scope = { tenantId, projectId };

  // The stack, and the storey height the fixture states for each of its levels, authored by the act
  // L-MEA-07 gives that statement. Both stand BEFORE the pin, so the campaign's snapshot has a stack.
  for (const [ordinal, level] of options.levels.entries()) await performAct(actor, insertion(projectId, level.label, ordinal));
  const stack = (await levelsOf(scope)).filter((level) => options.levels.some((one) => one.label === level.label));
  expect(stack.length, `the project's live stack is the one the case states: ${JSON.stringify(stack.map((level) => level.label))}`).toBe(options.levels.length);
  for (const level of stack) {
    const stated = options.levels.find((one) => one.label === level.label) as StagedLevel;
    await performAct(
      actor,
      heightReading({ projectId, levelId: level.levelId, valueAsWritten: stated.heightMm, unitAsWritten: "mm", basis: "TRANSCRIBED", sourceKey: `${BNBC_MODEL}#storeys:${level.label}` }) as unknown as Record<string, unknown>,
    );
  }

  // The sheet the notes are read off, ingested by the shipped pipeline, and the revision that holds
  // it — pinning opens the campaign this stage measures.
  const sheet = await stageNotesSheet(person, projectId, `rebar-${label}`, options.notes ?? BNBC_SHEET_TEXTS);
  const setRevisionId = await stageRevisionHolding({ scope, person, tenantId, projectId } as never, `rebar-${label}`, [sheet.drawingId]);

  const campaigns = await campaignsSeam();
  const opened = (await campaigns.campaignsOf(scope)).filter((row) => String(field(row, "setRevisionId", "set_revision_id")) === setRevisionId);
  expect(opened.length, `pinning the revision opened exactly one campaign: ${JSON.stringify(opened)}`).toBe(1);
  const campaignId = String(field(opened[0], "campaignId", "campaign_id"));
  const editionId = String(field(opened[0], "editionId", "edition_id"));

  // One register object per member, through the register's own door (L-REG-01).
  const registerScope: RegisterScope = { tenantId, projectId, setRevisionId };
  const register = await registerSeam();
  const byLabel = new Map(stack.map((level) => [level.label, level.levelId]));
  let at = 0;
  for (const member of members) {
    at += 1;
    const levelId = byLabel.get(member.level);
    const sighting = {
      ...(COLUMN_C1 as unknown as Record<string, unknown>),
      label: `${label}-${member.id}`,
      elementType: member.class,
      mark: member.mark,
      x: 1000 + at * 37,
      y: 250 + at * 11,
      level: levelId === undefined ? { slot: FOUNDATION_SLOT } : { levelId },
    } as unknown as Sighting;
    const answer = await register.registerSighting(registerScope, sighting);
    expect(field(answer, "registered", "registered"), `the sighting ${label}-${member.id} registered: ${JSON.stringify(answer)}`).toBe(true);
  }
  const rows = (await register.registerObjectsOf(registerScope)) as unknown as Record<string, unknown>[];
  expect(rows.length, `the staged campaign ${label} carries one register row per member`).toBe(members.length);

  // The two seams this stage stands in for: one placement per row, and the variant its schedule
  // states — the section, the main-bar group, and a tie zone stating a spacing and NO zone length,
  // which is the reading a typical detail would have given and nobody has read (scope).
  const objects: Record<string, unknown>[] = [];
  const placements: Record<string, PlacementSetupShape> = {};
  const memberTypes: Record<string, readonly VariantSetupShape[]> = {};
  const calibrations: Record<string, string> = {};
  const byMark = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) byMark.set(String(row["mark"]), [...(byMark.get(String(row["mark"])) ?? []), row]);
  const taken = new Map<string, number>();
  for (const member of members) {
    const held = byMark.get(member.mark) ?? [];
    const index = taken.get(member.mark) ?? 0;
    taken.set(member.mark, index + 1);
    const row = held[index];
    expect(row, `the register holds a row for ${member.id} (mark ${member.mark})`).toBeTruthy();
    const known = row as Record<string, unknown>;
    const placementKey = String(known["placementKey"]);
    const viewKey = String(known["viewKey"]);
    const family = `${member.mark}:${member.id}`;
    placements[placementKey] = {
      drawingId: sheet.drawingId,
      ingestId: sheet.ingestId,
      viewKey,
      memberFamily: family,
      engine: "VECTOR",
      sourceEntity: placementKey,
      outline: null,
    };
    calibrations[viewKey] = CALIBRATION_KEY;
    const zones: RebarZoneSetupShape[] = [zone({ zone: MAIN_ZONE, bars: [{ n: member.mains.n, diameterMm: member.mains.diameterMm }], sourceKeys: [`${BNBC_MODEL}#${member.id}.main`] })];
    if (member.ties !== undefined) {
      // A spacing and no zone length: BNBC's confinement zone is a typical detail nobody has read,
      // and the rail is owed the absence rather than a length this stage invented (scope).
      zones.push(zone({ zone: TIES_ZONE, spacing: member.ties.spacingMm, spacingUnit: "mm", spacingBar: member.ties.diameterMm, sourceKeys: [`${BNBC_MODEL}#${member.id}.ties`] }));
    }
    memberTypes[family] = [
      variant({ variantKey: family, width: member.section.b, depth: member.section.d, sourceKeys: [`${BNBC_MODEL}#${member.id}.section`], rebar: zones }),
    ];
    objects.push(known);
  }

  return {
    person,
    actor,
    tenantId,
    projectId,
    setRevisionId,
    campaignId,
    editionId,
    scope,
    gateScope: { tenantId, projectId, campaignId },
    registerScope,
    sheet,
    levels: stack,
    members: [...members],
    objects,
    placements,
    memberTypes,
    calibrations,
    stated: options.detailing === "door" ? null : options.detailing,
  };
}

/* ------------------------------------------------------------------ the notes door */

/** One reading a case transcribes: the kind, and the figure it is read at (inc-303's act). */
export type StagedReading = { kind: string; valueAsWritten: string; unitAsWritten: string };

/**
 * Read `readings` off the staged sheet through TRANSCRIBE_SHEET_NOTES — the shipped act, over the
 * source keys the product's own grammar proposed for that sheet, so every key is a key of it.
 */
export async function transcribeNotes(stage: RebarStage, readings: readonly StagedReading[]): Promise<void> {
  const door = await notesDoor();
  const texts = await door.sheetTextsOf({ tenantId: stage.tenantId, projectId: stage.projectId, drawingId: stage.sheet.drawingId }, stage.sheet.layoutName);
  const proposed = new Map((door.proposeNotes(texts) as Record<string, unknown>[]).map((proposal) => [String(proposal["kind"]), String(proposal["sourceKey"])]));
  const stated = readings.map((one) => {
    const sourceKey = proposed.get(one.kind);
    expect(sourceKey, `the staged sheet carries a sentence the grammar reads a ${one.kind} out of — a reading cites a key of its own sheet (L-REG-01)`).toBeTruthy();
    return noteReading(one.kind, String(sourceKey), one.valueAsWritten, one.unitAsWritten);
  });
  await performNoteAct(stage.actor as never, transcription({ projectId: stage.projectId, sheet: { drawingId: stage.sheet.drawingId, layoutName: stage.sheet.layoutName } }, stated));
}

/** What the ONE door answers for this campaign's revision (inc-303, goal). */
export async function appliedDetailingOf(stage: RebarStage): Promise<Record<string, unknown>> {
  const door = await productModule<{ appliedDetailingValuesOf: (scope: { tenantId: string; projectId: string; setRevisionId: string }) => Promise<Record<string, unknown>> }>(NOTES_MODULE);
  expect(typeof door.appliedDetailingValuesOf, `${NOTES_MODULE} publishes \`appliedDetailingValuesOf\` — the ONE door a campaign's applied values are read at (goal)`).toBe("function");
  return door.appliedDetailingValuesOf({ tenantId: stage.tenantId, projectId: stage.projectId, setRevisionId: stage.setRevisionId });
}

/** The setup the product's own loader builds for this campaign — detailing, edition and all. */
export async function railSetupOf(stage: RebarStage): Promise<RailSetupShape> {
  const door = await productModule<{ railSetupOf: (scope: { tenantId: string; projectId: string; setRevisionId: string; editionId: string }) => Promise<RailSetupShape> }>(MEASURE_SETUP_MODULE);
  expect(typeof door.railSetupOf, `${MEASURE_SETUP_MODULE} publishes \`railSetupOf\` (interfaces)`).toBe("function");
  return door.railSetupOf({ tenantId: stage.tenantId, projectId: stage.projectId, setRevisionId: stage.setRevisionId, editionId: stage.editionId });
}

/** One reading of the notes door: the scope it was asked for, and what it answered (interfaces). */
export type DoorCall = { scope: Record<string, unknown>; answered: Record<string, unknown> };

/**
 * The two homes `appliedDetailingValuesOf` can be reached at: the notes barrel every consumer is
 * meant to read (the ONE door of the goal), and the store the barrel re-exports it from. Both are
 * watched, so a setup that reaches past the barrel is seen rather than mistaken for silence.
 */
const NOTES_DOOR_HOMES: readonly string[] = [NOTES_MODULE, "src/modules/takeoff/notes/store.ts"];

/**
 * `railSetupOf`, with the notes door WATCHED.
 *
 * The spy stands on the module namespace the product imports through, so the call the loader makes
 * at its own import site is the call counted here; it delegates to the real door, so the setup is
 * the one the campaign would really have been measured with. Nothing else answers: a loader that
 * queries the note readings itself, or folds them out of a lower reader, records no call at all.
 *
 * The barrel is spied BEFORE the store, so the barrel's captured original is the store's real
 * function and one call is one entry however the loader reached it.
 */
export async function railSetupWatchingTheDoor(stage: RebarStage): Promise<{ setup: RailSetupShape; calls: DoorCall[] }> {
  const calls: DoorCall[] = [];
  const spies: { mockRestore: () => void }[] = [];
  for (const home of NOTES_DOOR_HOMES) {
    if (!existsSync(join(REPO_ROOT, home))) continue;
    const namespace = await productModule<Record<string, unknown>>(home);
    const held = namespace["appliedDetailingValuesOf"];
    if (typeof held !== "function") continue;
    const answerer = held as (scope: Record<string, unknown>) => Promise<Record<string, unknown>>;
    spies.push(
      vi.spyOn(namespace as unknown as { appliedDetailingValuesOf: typeof answerer }, "appliedDetailingValuesOf").mockImplementation(async (scope: Record<string, unknown>) => {
        const answered = await answerer(scope);
        calls.push({ scope: { ...scope }, answered });
        return answered;
      }),
    );
  }
  expect(spies.length, `${NOTES_MODULE} publishes \`appliedDetailingValuesOf\` — the ONE door a campaign's applied values are read at (goal)`).toBeGreaterThan(0);
  try {
    return { setup: await railSetupOf(stage), calls };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

/* ------------------------------------------------------------------ measuring it */

/**
 * The campaign, measured through the shipped job with the shipped roster and the real gate.
 *
 * The rebar rail is wrapped, and the wrapper does ONE thing: it folds this stage's placements,
 * member-type variants and calibrations into the setup the JOB loaded, before the rail is run over
 * it. Everything else of that setup — the levels, the storey heights, the edition digest and the
 * detailing values the notes door answered — is the product's own. Where a case states its own
 * detailing, that is folded in too, standing in for the notes nobody transcribed.
 */
export async function measure(stage: RebarStage): Promise<MeasuredCampaign> {
  const job = await productModule<{
    runMeasureJob: (payload: Record<string, unknown>, progress: { step: (name: string, detail?: Record<string, unknown>) => Promise<void> }, deps: { rails: unknown; gate: unknown }) => Promise<void>;
  }>(MEASURE_JOB_MODULE);
  const gate = await gateSeam();
  const rails = await railsRoster();
  const rail = rails[RCC_REBAR];
  expect(typeof rail, `RAILS["${RCC_REBAR}"] is the rail the measure job runs for this kind (L-MEA-08)`).toBe("function");

  const seen: { input?: RailInputShape; offers: Record<string, unknown>[]; observations: Record<string, unknown>[] } = { offers: [], observations: [] };
  const wrapped = (input: RailInputShape): unknown => {
    Object.assign(input.setup.placements, stage.placements);
    Object.assign(input.setup.memberTypes, { [stage.sheet.ingestId]: { ...(input.setup.memberTypes[stage.sheet.ingestId] ?? {}), ...stage.memberTypes } });
    Object.assign(input.setup.calibrations, { [stage.sheet.ingestId]: { ...(input.setup.calibrations[stage.sheet.ingestId] ?? {}), ...stage.calibrations } });
    if (stage.stated !== null) Object.assign(input.setup, { detailing: stage.stated });
    seen.input = input;
    const batch = (rail as unknown as (one: RailInputShape) => { offers: Record<string, unknown>[]; observations: Record<string, unknown>[] })(input);
    seen.offers = [...batch.offers];
    seen.observations = [...batch.observations];
    return batch;
  };

  const steps: { step: string; detail?: Record<string, unknown> }[] = [];
  const verdicts: MeasuredCampaign["verdict"][] = [];
  await job.runMeasureJob(
    { tenantId: stage.tenantId, projectId: stage.projectId, campaignId: stage.campaignId, requestedBy: stage.person.userId },
    { step: async (name, detail) => void steps.push({ step: name, detail }) },
    {
      rails: { ...rails, [RCC_REBAR]: wrapped },
      gate: async (gateScope: unknown, batch: unknown) => {
        const answer = (await gate.evaluateOffers(gateScope as never, batch as never)) as MeasuredCampaign["verdict"];
        verdicts.push(answer);
        return answer;
      },
    },
  );
  expect(verdicts.length, "the measure job handed its batch to the gate exactly once (SEAM-GATE)").toBe(1);
  expect(seen.input, `the job ran the ${RCC_REBAR} rail over the campaign's register objects (L-MEA-08)`).toBeTruthy();
  return { steps, verdict: verdicts[0] as MeasuredCampaign["verdict"], input: seen.input as RailInputShape, offers: seen.offers, observations: seen.observations };
}

/* ------------------------------------------------------------------ reading what it left behind */

/** Every quantity line this campaign published under the rebar kind (L-QTY-03). */
export function linesOf(stage: RebarStage): StoreRow[] {
  return rowsOfCampaign(QUANTITY_LINES_TABLE, stage.tenantId, stage.campaignId).filter((row) => String(field(row, "kind", "kind")) === RCC_REBAR);
}

/** Every rail observation this campaign recorded (L-MEA-08). */
export function observationsOf(stage: RebarStage): StoreRow[] {
  return rowsOfCampaign(RAIL_OBSERVATIONS_TABLE, stage.tenantId, stage.campaignId);
}

/** The campaign's bill of bars, read back through the ONE door inc-310 will consume (goal). */
export async function bbsThroughDoor(stage: RebarStage): Promise<BbsDocumentShape> {
  const door = await rebarRailDoor();
  const bbsOf = door["bbsOf"] as (scope: { tenantId: string; projectId: string; campaignId: string }) => Promise<BbsDocumentShape>;
  return bbsOf({ tenantId: stage.tenantId, projectId: stage.projectId, campaignId: stage.campaignId });
}

/** The bar rows one rail input answers, pure — the same synthesis the rail offers from (interfaces). */
export async function barRowsOf(input: RailInputShape): Promise<BarRowShape[]> {
  const door = await rebarRailDoor();
  return (door["barRowsOf"] as (one: RailInputShape) => BarRowShape[])(input);
}

/** One line's column under either spelling, as text. */
export function said(row: StoreRow, camel: string, snake: string): string {
  return String(field(row, camel, snake));
}

/** The bindings one published line carries, by variable name (L-QTY-03). */
export function bindingsOf(row: StoreRow): Record<string, { value?: string; unit?: string; basis?: string; source?: string }> {
  const held = (row as Record<string, unknown>)["bindings"];
  return (held ?? {}) as Record<string, { value?: string; unit?: string; basis?: string; source?: string }>;
}

/** The variables one published line left out, and the code each was omitted under (L-QTY-02). */
export function omittedOf(row: StoreRow): { variable: string; code: string }[] {
  const held = (row as Record<string, unknown>)["omitted"];
  return ((held ?? []) as { variable: string; code: string }[]).map((one) => ({ variable: String(one.variable), code: String(one.code) }));
}

/** What a case states as the detailing where it states one itself (interfaces: `DetailingSetup`). */
export function detailingStating(values: {
  lapMultiplier?: number;
  fyMPa?: number;
  fcPsi?: number;
  hook?: { multiplier: number | null; minimumMm: number | null };
  suspended?: readonly string[];
}): DetailingSetupShape {
  const base = detailingUnread();
  return {
    ...base,
    fy: values.fyMPa === undefined ? null : { value: String(values.fyMPa), unit: "MPa", basis: "TRANSCRIBED", source: "DXF_HANDLE:1F43" },
    fc: values.fcPsi === undefined ? null : { value: String(values.fcPsi), unit: "psi", basis: "TRANSCRIBED", source: "DXF_HANDLE:1F41" },
    lapMultiplier: values.lapMultiplier ?? null,
    hookExtension: values.hook ?? null,
    suspended: values.suspended ?? [],
    sourceKeys: ["DXF_HANDLE:1F43", "DXF_HANDLE:1F41", "DXF_HANDLE:1F4C", "DXF_HANDLE:1F4E"],
  };
}
