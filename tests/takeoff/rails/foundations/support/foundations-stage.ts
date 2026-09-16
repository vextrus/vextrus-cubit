/**
 * The live half of the FOUNDATIONS mechanics: a campaign over foundation members, the SITE facts
 * entered through the core store, and the per-cell read of what the gate published (L-MEA-08,
 * L-MEA-06, L-QTY-06, AM-06).
 *
 * Mechanics only — nothing here judges the product. The database, the accounts, the pinned set
 * revision, the campaign and the register rows all come from the stage the gate and the column rail
 * already run on (`../../../gate/support/gate-stage`): one invariant, one home (B-17, ARCH-02). The
 * vocabulary, the shapes and the hand-built input live beside this file in `./foundations-contract`,
 * which opens no database — and which this file re-exports, so a caller reads one door.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it. Nothing here reads product source, and nothing here
 * judges: keep it free of judgement so neither lane can hide one here.
 */
import { expect } from "vitest";
import { ident, lit } from "../../../../../db/__tests__/support/live-sql";
import {
  COLUMN_C1,
  QUANTITY_LINES_TABLE,
  RAIL_OBSERVATIONS_TABLE,
  actorOf,
  closeStage,
  field,
  gateSeam,
  insertion,
  performAct,
  pinnedView,
  registerSeam,
  rowsOfCampaign,
  sql,
  stageCampaign,
  storeRows,
  type Person,
  type Sighting,
  type StagedCampaign,
  type StoreRow,
  type VerdictShape,
} from "../../../gate/support/gate-stage";
import {
  BNBC_MODEL,
  BNBC_SITE,
  CALIBRATION_KEY,
  DB_SEAM_MODULE,
  FOUNDATIONS_PAIRS,
  INGEST_ID,
  MILLIMETRE,
  MILLIMETRE_SQUARED,
  RCC_CONCRETE,
  SITE_FACTS_DOOR_MODULE,
  SITE_FACTS_STORE_MODULE,
  TRANSCRIBED,
  canon,
  foundationsRoster,
  outline,
  placement,
  productModule,
  railsRoster,
  reading,
  siteFactsLaw,
  variant,
  type DecimalLike,
  type OfferShape,
  type PlacementSetup,
  type RailBatchShape,
  type RailObservationShape,
  type RailSetupShape,
  type RailShape,
  type SiteFactSetup,
  type StandingSiteFactShape,
  type VariantSetup,
} from "./foundations-contract";

export * from "./foundations-contract";
export { QUANTITY_LINES_TABLE, RAIL_OBSERVATIONS_TABLE, closeStage, field, gateSeam, rowsOfCampaign, storeRows };
export type { StagedCampaign, StoreRow, VerdictShape };

/** The SITE-fact store in core — INSERT and read, and nothing else (interfaces). */
export type SiteFactsStore = {
  writeSiteFact: (tx: unknown, scope: { tenantId: string; projectId: string }, actId: string, write: unknown) => Promise<void>;
  siteFactRowsOf: (tx: unknown, scope: { tenantId: string; projectId: string }) => Promise<readonly Record<string, unknown>[]>;
};

/** The ONE module door the ledger is read through (interfaces). */
export type SiteFactsDoor = {
  siteFactsOf: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, StandingSiteFactShape | undefined>>;
  SITE_FACTS: readonly string[];
  isSiteFact: (value: unknown) => boolean;
};

/** The SITE-fact store in core (interfaces). */
export async function siteFactsStore(): Promise<SiteFactsStore> {
  const door = await productModule<Record<string, unknown>>(SITE_FACTS_STORE_MODULE);
  for (const call of ["writeSiteFact", "siteFactRowsOf"]) {
    expect(typeof door[call], `${SITE_FACTS_STORE_MODULE} publishes \`${call}\` (interfaces)`).toBe("function");
  }
  return door as unknown as SiteFactsStore;
}

/** The one reader of the ledger (interfaces). */
export async function siteFactsDoor(): Promise<SiteFactsDoor> {
  const door = await productModule<Record<string, unknown>>(SITE_FACTS_DOOR_MODULE);
  expect(typeof door["siteFactsOf"], `${SITE_FACTS_DOOR_MODULE} publishes \`siteFactsOf\` — the ONE door the ledger is read at (interfaces)`).toBe("function");
  return door as unknown as SiteFactsDoor;
}

/** The seam a transaction is opened on, so a core store can be written to from a test. */
type DbSeam = { forTenant: (ctx: { tenantId: string }) => { transaction: (work: (tx: unknown) => Promise<unknown>) => Promise<unknown> } };

/** One tenant transaction, run to completion — how a caller of a core store reaches one. */
export async function inTenantTx<T>(tenantId: string, work: (tx: unknown) => Promise<T>): Promise<T> {
  const seam = await productModule<DbSeam>(DB_SEAM_MODULE);
  return (await seam.forTenant({ tenantId }).transaction(async (tx) => work(tx))) as T;
}

/**
 * Enter one SITE fact through the CORE STORE, inside a tenant transaction — the door AM-06's act
 * will write through when it lands (inc-304b, out of scope here). The write is the product's own:
 * `siteFactWrite` makes it and `writeSiteFact` appends it, and nothing here touches the table.
 */
export async function enterSiteFact(
  scope: { tenantId: string; projectId: string },
  actId: string,
  input: { fact: string; valueAsWritten: string; unitAsWritten: string; sourceNote: string },
): Promise<void> {
  const [law, store] = await Promise.all([siteFactsLaw(), siteFactsStore()]);
  const write = law.siteFactWrite(input);
  await inTenantTx(scope.tenantId, async (tx) => {
    await store.writeSiteFact(tx, scope, actId, write);
  });
}

/* ------------------------------------------------------------------ staging a campaign over members */

/** One foundation member a campaign is staged over, as a case states it. */
export type StagedMember = {
  /** This acceptance's own name for the row — never part of any key. */
  id: string;
  class: string;
  mark: string;
  /** The section a schedule states for the family, in millimetres (a rect plan). */
  section?: { l: string; b: string };
  /** The plan outline a reader read, where the plan is a polygon or a read rectangle. */
  outline?: { type: string; area: string; length?: string; breadth?: string };
  /** The named dimensions the family's schedule states beyond its section, in millimetres. */
  dimensions?: Record<string, string>;
  /** Where the readings of this member were read — the fixture path a source cites. */
  source?: string;
};

/** One SITE fact a stage enters, as it is written (L-MEA-06: value and unit AS WRITTEN). */
export type StagedFact = { fact: string; valueAsWritten: string; unitAsWritten: string; sourceNote?: string };

/** Everything a criterion driven over a real campaign is handed. */
export type FoundationsStage = StagedCampaign & {
  setup: RailSetupShape;
  /** The register rows the campaign holds, in the order the members were staged. */
  objects: Record<string, unknown>[];
  /** The act every SITE fact of this stage cites. */
  actId: string;
};

/**
 * A campaign whose pinned edition cites this leaf's seven methods, with one register object per
 * member, the setup those rows are read against, and the SITE facts entered through the core store.
 *
 * Everything is driven through the shipped doors: the workspace, project, pin and campaign come from
 * the gate's own stage, the rows from the register's `registerSighting`, and the facts from
 * `writeSiteFact` — read back through `siteFactsOf`, the one reader, never off the table.
 */
export async function stageFoundationsCampaign(label: string, members: readonly StagedMember[], facts: readonly StagedFact[] = []): Promise<FoundationsStage> {
  const staged = await stageCampaign(label, { methods: [...FOUNDATIONS_PAIRS], objects: 0 });
  const register = await registerSeam();

  let at = 0;
  for (const member of members) {
    at += 1;
    const sighting = {
      ...(COLUMN_C1 as unknown as Record<string, unknown>),
      label: `${label}-${member.id}`,
      elementType: member.class,
      mark: member.mark,
      x: 1000 + at * 137,
      y: 250 + at * 11,
      // A foundation member stands in the FOUNDATION slot and on no level of the stack (L-REG-02).
      level: { slot: "FOUNDATION" },
    } as unknown as Sighting;
    const answer = await register.registerSighting(staged.registerScope, sighting);
    expect(field(answer, "registered", "registered"), `the sighting ${label}-${member.id} registered: ${JSON.stringify(answer)}`).toBe(true);
  }
  const rows = (await register.registerObjectsOf(staged.registerScope)) as unknown as Record<string, unknown>[];
  expect(rows.length, `the staged campaign ${label} carries one register row per member`).toBe(members.length);

  // The rows come back in the register's own order; each is matched to the member it was staged from
  // by its mark, so the setup describes the very row the rail will read.
  const byMark = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const mark = String(row["mark"]);
    byMark.set(mark, [...(byMark.get(mark) ?? []), row]);
  }
  const taken = new Map<string, number>();
  const placements: Record<string, PlacementSetup> = {};
  const memberTypes: Record<string, readonly VariantSetup[]> = {};
  const objects: Record<string, unknown>[] = [];
  for (const member of members) {
    const held = byMark.get(member.mark) ?? [];
    const index = taken.get(member.mark) ?? 0;
    taken.set(member.mark, index + 1);
    const row = held[index];
    expect(row, `the register holds a row for ${member.id} (mark ${member.mark})`).toBeTruthy();
    const known = row as Record<string, unknown>;
    const placementKey = String(known["placementKey"]);
    const family = `${member.mark}:${member.id}`;
    const source = member.source ?? BNBC_MODEL;
    placements[placementKey] = placement({
      viewKey: String(known["viewKey"]),
      memberFamily: family,
      sourceEntity: placementKey,
      outline:
        member.outline === undefined
          ? null
          : outline({
              type: member.outline.type,
              area: reading(member.outline.area, MILLIMETRE_SQUARED, { source: `${source}#${member.id}.area` }),
              length: member.outline.length === undefined ? null : reading(member.outline.length, MILLIMETRE, { source: `${source}#${member.id}.l` }),
              breadth: member.outline.breadth === undefined ? null : reading(member.outline.breadth, MILLIMETRE, { source: `${source}#${member.id}.b` }),
            }),
    });
    memberTypes[family] = [
      variant({
        variantKey: family,
        width: member.section === undefined ? null : Number(member.section.l),
        depth: member.section === undefined ? null : Number(member.section.b),
        sourceKeys: [`${source}#${member.id}.section`],
        dimensions: Object.fromEntries(
          Object.entries(member.dimensions ?? {}).map(([name, value]) => [
            name,
            reading(value, MILLIMETRE, { basis: TRANSCRIBED, source: `${source}#${member.id}.${name}` }),
          ]),
        ),
      }),
    ];
    objects.push(known);
  }

  // One act for the facts to cite. AUTHOR_SITE_FACT and its panel are inc-304b's (scope); what the
  // ledger owes is a LIVE act, and a committed act of this project is one.
  const { actId } = await performAct(actorOf(staged.person as Person), insertion(staged.projectId, "1F", 1));
  for (const entry of facts) {
    await enterSiteFact({ tenantId: staged.tenantId, projectId: staged.projectId }, actId, {
      fact: entry.fact,
      valueAsWritten: entry.valueAsWritten,
      unitAsWritten: entry.unitAsWritten,
      sourceNote: entry.sourceNote ?? `${BNBC_SITE}: ${entry.fact} as the notes state it`,
    });
  }

  const door = await siteFactsDoor();
  const standing = await door.siteFactsOf({ tenantId: staged.tenantId, projectId: staged.projectId });
  const siteFacts: Record<string, SiteFactSetup> = {};
  for (const [fact, held] of Object.entries(standing)) {
    if (held === undefined) continue;
    siteFacts[fact] = {
      value: held.valueAsWritten,
      unit: held.unitAsWritten,
      canonicalMetres: held.canonicalMetres,
      sourceNote: held.sourceNote,
      actId: held.actId,
    };
  }

  const pin = await pinnedView({ tenantId: staged.tenantId, projectId: staged.projectId });
  expect(pin.pinned, "the staged project is pinned to an edition — its parameters are what a DERIVED reading binds (L-MEA-01)").toBe(true);
  const views: Record<string, string> = {};
  for (const one of Object.values(placements)) views[one.viewKey] = CALIBRATION_KEY;

  const setup: RailSetupShape = {
    placements,
    memberTypes: { [INGEST_ID]: memberTypes },
    levels: [],
    calibrations: { [INGEST_ID]: views },
    grades: {},
    runs: {},
    lintels: {},
    siteFacts,
    edition: { digest: String(pin.digest), parameters: (pin.parameters ?? {}) as Record<string, { value: string; unit: string }> },
  };

  return { ...staged, setup, objects, actId };
}

/**
 * Every rail of this leaf run over the staged campaign, as ONE batch — what the measure job hands the
 * gate. The concrete kind is run through the BARREL, so the composition the frame's roster line holds
 * is what measures it (AC-1).
 */
export async function railBatchOf(stage: FoundationsStage): Promise<RailBatchShape> {
  const rails = await railsRoster();
  const roster = await foundationsRoster();
  const offers: OfferShape[] = [];
  const observations: RailObservationShape[] = [];
  const running: Record<string, RailShape | undefined> = { [RCC_CONCRETE]: rails[RCC_CONCRETE], ...roster };
  for (const [kind, rail] of Object.entries(running)) {
    expect(typeof rail, `a rail measures ${kind} (L-MEA-08: a kind with no rail is a kind nothing measures)`).toBe("function");
    const batch = (rail as RailShape)({
      campaignId: stage.campaignId,
      setRevisionId: stage.setRevisionId,
      kind,
      objects: stage.objects,
      setup: stage.setup,
    });
    offers.push(...batch.offers);
    observations.push(...batch.observations);
  }
  return { offers, observations };
}

/** The gate's verdict over one batch of offers, through the one writer of lines (SEAM-GATE). */
export async function evaluate(stage: FoundationsStage, batch: RailBatchShape): Promise<VerdictShape> {
  const gate = await gateSeam();
  return (await gate.evaluateOffers(stage.gateScope, batch as never)) as VerdictShape;
}

/** One line's column under either spelling, as text. */
export function said(row: StoreRow, camel: string, snake: string): string {
  return String(field(row, camel, snake));
}

/** What one published cell holds: the exact sum of its figures, and the codes its partial rows name. */
export type CellReading = { sum: DecimalLike; lines: number; partial: number; partialCodes: string[] };

/**
 * The figure each published line carries, keyed by line and read as TEXT.
 *
 * The audit read carries a whole row through `row_to_json`, which renders a `numeric` as a JSON
 * NUMBER — a double, which cannot hold what the canon carried. A figure is what a bill is priced
 * from (B-07), so the figures alone are read from the column's own digits; everything else about a
 * line still comes through the one audit read. A row kept with no quantity answers `null`.
 */
function publishedFigures(tenantId: string, campaignId: string): Map<string, string | null> {
  const rows = sql(
    `select line_id::text, coalesce(value::text, '') from ${ident(QUANTITY_LINES_TABLE)}
      where tenant_id = ${lit(tenantId)}::uuid and campaign_id = ${lit(campaignId)}::uuid;`,
  );
  return new Map(rows.map((row) => [String(row[0]), row[1] === undefined || row[1] === "" ? null : String(row[1])]));
}

/**
 * The lines one campaign published, by (class, kind) — the cell the golden keys its rows by.
 *
 * The sum is the canon's exact decimal over the rows' own figures (B-07), and a row kept with no
 * quantity contributes its omitted codes instead of a figure (L-QTY-02).
 */
export async function publishedByCell(tenantId: string, campaignId: string): Promise<Map<string, CellReading>> {
  const { exact } = await canon();
  const figures = publishedFigures(tenantId, campaignId);
  const cells = new Map<string, CellReading>();
  for (const line of rowsOfCampaign(QUANTITY_LINES_TABLE, tenantId, campaignId)) {
    const key = `${said(line, "class", "class")}|${said(line, "kind", "kind")}`;
    const held = cells.get(key) ?? { sum: exact("0"), lines: 0, partial: 0, partialCodes: [] };
    const value = figures.get(said(line, "lineId", "line_id"));
    held.lines += 1;
    if (value === null || value === undefined) {
      held.partial += 1;
      const omitted = ((line as Record<string, unknown>)["omitted"] ?? []) as readonly { code?: string }[];
      for (const one of omitted) {
        if (typeof one.code === "string" && !held.partialCodes.includes(one.code)) held.partialCodes.push(one.code);
      }
      held.partialCodes.sort();
    } else {
      held.sum = held.sum.add(exact(String(value)));
    }
    cells.set(key, held);
  }
  return cells;
}

/** Every line one campaign published under one rule id, whole (L-QTY-03). */
export function linesUnderRule(tenantId: string, campaignId: string, ruleId: string): StoreRow[] {
  return rowsOfCampaign(QUANTITY_LINES_TABLE, tenantId, campaignId).filter((row) => said(row, "ruleId", "rule_id") === ruleId);
}
