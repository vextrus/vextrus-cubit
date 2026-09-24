/**
 * FND-OWN, through the gate: F-RCC6-BNBC's 26 pile caps, measured with the piles they stand on read,
 * published by the ONE writer of lines into a live campaign (L-MEA-08, L-MEA-09, I-544..d).
 *
 * WHAT IS READ: S-04's piles, S-06's caps, the grid both draw and the rings out of the artifact, by
 * the partition's pure stages and the relation the measure setup reads (`pilesHeldOf`,
 * `capJunctionSetupOf`); the caps' plans and the families through the setup's own mappings. The
 * campaign's edition cites every pair of the shard, the new seven among them.
 *
 * WHAT IS STOOD IN FOR, named rather than hidden: one register row per cap from the gate's own stage,
 * handed the family and the plan the placement stage gave that cap; the piles as placements the rail
 * reads the schedule of, never as rows of their own (the pile rail is not what this grades); and, in
 * the second campaign, the two readings no reader of the set stores yet — the heads' height above the
 * soffit (75.6 mm, by the levels) and PC5's recess (2493 × 2188 × 914, as R0's Rev C S-07 prints it).
 *
 * THREE CAMPAIGNS, the three states the product stands in:
 *   · piles unread (no relation handed — no pile plan in the revision, or none the caps' plan can be
 *     laid over): 26 cap lines kept, PARTIAL, `CAP_PILES_UNREAD`, no figure — never the prism it once
 *     fell back to (FND-OWN review, I-547); the blinding likewise; the formwork untouched.
 *   · heads unstated (the set today): 26 cap lines kept, PARTIAL, `PILE_HEAD_UNSTATED`, no figure —
 *     never the whole prism over 89 heads (L-QTY-04); the 12 rectangular caps' blinding COMPLETE and
 *     net of 47 pile sections; the formwork untouched.
 *   · heads and recess stated: 26 cap lines COMPLETE, one per cap, and the figures R0's golden rules.
 */
import { afterAll, describe, expect, test } from "vitest";
import { capJunctionSetupOf } from "@/modules/takeoff/measure/cap-junctions";
import { outlineSetupOf, memberFamiliesSetupOf } from "@/modules/takeoff/measure/setup";
import type { RecessSetup } from "@/core/offers/contract";
import {
  PCC_BLINDING,
  PILE_CAP,
  RCC_CONCRETE,
  RCC_FORMWORK,
  canon,
  closeStage,
  evaluate,
  linesUnderRule,
  publishedByCell,
  railBatchOf,
  railsRoster,
  stageFoundationsCampaign,
  type CellReading,
  type FoundationsStage,
  type RailBatchShape,
  type StagedMember,
  type VerdictShape,
} from "./support/foundations-stage";
import { bnbc, capsOf, heldOver, pilesOf, type StagesRead } from "./support/cap-junctions-stage";

const BUDGET_MS = 900_000;

/** The heads' height above the soffit, by the levels (S-05 `4DA` against the neck and the depth) — STAGED. */
const HEAD = { reading: { value: "75.6", unit: "mm", basis: "TRANSCRIBED" as const, source: "DXF_HANDLE:4DA" }, standing: "RESOLVED" as const };

/** PC5's recess, as R0's Rev C S-07 prints it — STAGED. */
const PC5_RECESS: RecessSetup = {
  length: { value: "2493", unit: "mm", basis: "TRANSCRIBED", source: "REV-C:S-07:RECESS-L" },
  breadth: { value: "2188", unit: "mm", basis: "TRANSCRIBED", source: "REV-C:S-07:RECESS-B" },
  depth: { value: "914", unit: "mm", basis: "TRANSCRIBED", source: "REV-C:S-07:RECESS-D" },
};

type Measured = { stage: FoundationsStage; batch: RailBatchShape; verdict: VerdictShape; formwork: VerdictShape; cells: Map<string, CellReading> };

/**
 * One campaign over the 26 caps, its setup carrying the caps' plans, the piles they hold and — where
 * `stated` — the head height and PC5's recess; every rail of the leaf run as ONE batch and the gate
 * handed it, then the formwork rail the same way.
 */
/** What a campaign is handed of the caps' junctions: nothing, the piles alone, or the piles and what the heads and the recess stand at. */
type Handed = "unread" | "piles" | "stated";

async function measured(label: string, read: StagesRead, handed: Handed): Promise<Measured> {
  const caps = capsOf(read);
  const members: StagedMember[] = caps.map((row, index) => ({ id: `${row.mark}-${index + 1}`, class: PILE_CAP, mark: row.mark }));
  const stage = await stageFoundationsCampaign(label, members);
  const ingestId = Object.values(stage.setup.placements)[0]?.ingestId as string;
  const drawingId = Object.values(stage.setup.placements)[0]?.drawingId as string;
  stage.setup.memberTypes = { [ingestId]: memberFamiliesSetupOf(read.registered.families) as never };

  const outlines = new Map((read.placed.outlines ?? []).map((outline) => [outline.placementKey, outline]));
  const held = heldOver(read);
  const capJunctions: Record<string, unknown> = {};
  caps.forEach((cap, index) => {
    const key = String(stage.objects[index]?.["placementKey"]);
    const plan = outlines.get(cap.placementKey);
    expect(plan !== undefined && stage.setup.placements[key] !== undefined, `the ${index + 1}th register row stands for ${cap.placementKey}, and the stage read its plan`).toBe(true);
    stage.setup.placements[key] = { ...(stage.setup.placements[key] as object), memberFamily: cap.memberFamily, outline: outlineSetupOf(plan as never) } as never;
    const junction = capJunctionSetupOf(key, held.get(cap.placementKey) ?? []);
    if (handed === "piles") capJunctions[key] = junction;
    if (handed === "stated") capJunctions[key] = { ...junction, headHeight: HEAD, recess: cap.mark === "PC5" ? PC5_RECESS : null };
  });
  for (const pile of pilesOf(read)) {
    stage.setup.placements[pile.placementKey] = {
      drawingId,
      ingestId,
      viewKey: pile.viewKey,
      memberFamily: pile.memberFamily,
      engine: "VECTOR",
      sourceEntity: pile.placementKey,
      outline: null,
    };
  }
  (stage.setup as unknown as Record<string, unknown>)["capJunctions"] = capJunctions;

  const batch = await railBatchOf(stage);
  const verdict = await evaluate(stage, batch);
  const rails = await railsRoster();
  const formworkBatch = rails[RCC_FORMWORK]?.({ campaignId: stage.campaignId, setRevisionId: stage.setRevisionId, kind: RCC_FORMWORK, objects: stage.objects, setup: stage.setup }) ?? { offers: [], observations: [] };
  const formwork = await evaluate(stage, formworkBatch);
  return { stage, batch, verdict, formwork, cells: await publishedByCell(stage.tenantId, stage.campaignId) };
}

let pilesUnreadHeld: Promise<Measured> | undefined;
let unread: Promise<Measured> | undefined;
let stated: Promise<Measured> | undefined;
const pilesUnread = (): Promise<Measured> => (pilesUnreadHeld ??= bnbc().then((read) => measured("fnd-own-piles-unread", read, "unread")));
const headsUnread = (): Promise<Measured> => (unread ??= bnbc().then((read) => measured("fnd-own-unread", read, "piles")));
const headsStated = (): Promise<Measured> => (stated ??= bnbc().then((read) => measured("fnd-own-stated", read, "stated")));

afterAll(async () => {
  await closeStage();
});

describe("I-547: nobody read the caps' piles — every cap kept and named, never the prism", () => {
  test(
    "pile_cap × rcc.concrete and × pcc.blinding: 26 lines each, every one PARTIAL naming CAP_PILES_UNREAD, and the gate refused nothing",
    async () => {
      const { stage, verdict, cells } = await pilesUnread();
      expect(verdict.refused, `the edition cites the caps' own sentences, so nothing is refused (${JSON.stringify(verdict.refusals.slice(0, 3))})`).toBe(0);
      const concrete = cells.get(`${PILE_CAP}|${RCC_CONCRETE}`);
      expect([concrete?.lines, concrete?.partial], "26 lines kept, every one with no figure — the prism over heads nobody placed would read over (L-QTY-04)").toEqual([26, 26]);
      expect(new Set(concrete?.partialCodes), "each names the relation nobody read").toEqual(new Set(["CAP_PILES_UNREAD"]));
      expect(linesUnderRule(stage.tenantId, stage.campaignId, "rcc.foundation.prism_rect").length + linesUnderRule(stage.tenantId, stage.campaignId, "rcc.foundation.prism_poly").length, "and not one cap line stands under the footing's prism").toBe(0);
      const blinding = cells.get(`${PILE_CAP}|${PCC_BLINDING}`);
      expect([blinding?.lines, blinding?.partial], "26 blinding lines, every one kept").toEqual([26, 26]);
      expect(new Set(blinding?.partialCodes), "the 14 PC2 name their plan as well; every one names the relation").toEqual(new Set(["CAP_PILES_UNREAD", "BLINDING_PLAN_DEFERRED"]));
    },
    BUDGET_MS,
  );

  test(
    "pile_cap × rcc.formwork: untouched — 26 COMPLETE, 254.132613 m²",
    async () => {
      const { formwork, cells } = await pilesUnread();
      const { exact } = await canon();
      expect(formwork.refused, "nothing refused").toBe(0);
      const held = cells.get(`${PILE_CAP}|${RCC_FORMWORK}`) as CellReading;
      expect([held.lines, held.partial], "26 lines, all COMPLETE").toEqual([26, 0]);
      expect(held.sum.eq(exact("254.132613")), `${held.sum.toString()} m²`).toBe(true);
    },
    BUDGET_MS,
  );
});

describe("I-544/b: the piles read, the heads' height unstated — the set as it stands", () => {
  test(
    "pile_cap × rcc.concrete: 26 lines kept, every one PARTIAL naming PILE_HEAD_UNSTATED, and the gate refused nothing",
    async () => {
      const { verdict, cells } = await headsUnread();
      expect(verdict.refused, `the edition cites the caps' own sentences, so nothing is refused (${JSON.stringify(verdict.refusals.slice(0, 3))})`).toBe(0);
      const held = cells.get(`${PILE_CAP}|${RCC_CONCRETE}`);
      expect(held?.lines, "one line per cap — J-000's measure leg counts them against the golden's 26 members").toBe(26);
      expect(held?.partial, "every one kept with no figure: the whole prism would read over the heads (L-QTY-04)").toBe(26);
      expect(new Set(held?.partialCodes), "and each names the one reading it lacks").toEqual(new Set(["PILE_HEAD_UNSTATED"]));
    },
    BUDGET_MS,
  );

  test(
    "pile_cap × pcc.blinding: the 12 rectangular caps COMPLETE under pcc.blinding_rect_piled, 3.989 m³ net of 47 pile sections; the 14 PC2 defer",
    async () => {
      const { stage, cells } = await headsUnread();
      const { exact } = await canon();
      const held = cells.get(`${PILE_CAP}|${PCC_BLINDING}`) as CellReading;
      expect(held.lines, "26 blinding lines").toBe(26);
      expect(held.partial, "the 14 PC2 defer by their plan").toBe(14);
      expect(new Set(held.partialCodes), "under BLINDING_PLAN_DEFERRED alone").toEqual(new Set(["BLINDING_PLAN_DEFERRED"]));
      expect(linesUnderRule(stage.tenantId, stage.campaignId, "pcc.blinding_rect_piled").length, "every blinding line names the sentence that takes the piles out").toBe(26);
      expect(
        exact("3.9885").lte(held.sum) && held.sum.lte(exact("3.9895")),
        `the 12 publish ${held.sum.toString()} m³ — 3.989 to the printed place: 4.692 less the 0.703 the piles own`,
      ).toBe(true);
    },
    BUDGET_MS,
  );

  test(
    "pile_cap × rcc.formwork: untouched — 26 COMPLETE, 254.132613 m²: the piles meet the soffit, and the soffit is never formed",
    async () => {
      const { formwork, cells } = await headsUnread();
      const { exact } = await canon();
      expect(formwork.refused, "nothing refused").toBe(0);
      const held = cells.get(`${PILE_CAP}|${RCC_FORMWORK}`) as CellReading;
      expect([held.lines, held.partial], "26 lines, all COMPLETE").toEqual([26, 0]);
      expect(held.sum.eq(exact("254.132613")), `${held.sum.toString()} m²`).toBe(true);
    },
    BUDGET_MS,
  );
});

describe("I-544/c: the heads' height and PC5's recess stated — one line per cap, and the figures R0 rules", () => {
  test(
    "pile_cap × rcc.concrete: 26 COMPLETE lines, 122.475 m³ — the prisms less 89 heads and PC5's recess — inside R0's band on 122.500",
    async () => {
      const { stage, verdict, cells } = await headsStated();
      const { exact } = await canon();
      expect(verdict.refused, `nothing refused (${JSON.stringify(verdict.refusals.slice(0, 3))})`).toBe(0);
      const held = cells.get(`${PILE_CAP}|${RCC_CONCRETE}`) as CellReading;
      expect([held.lines, held.partial], "26 lines, all COMPLETE").toEqual([26, 0]);
      expect(held.sum.lte(exact("122.5005")) && exact("122.500").mul(exact("0.97")).sub(exact("0.0005")).lte(held.sum), `${held.sum.toString()} m³ stands inside R0's band`).toBe(true);
      expect(held.sum.lte(exact("122.4750")) && exact("122.4745").lte(held.sum), `${held.sum.toString()} m³ is 122.475 to the printed place`).toBe(true);

      const recessed = linesUnderRule(stage.tenantId, stage.campaignId, "rcc.pile_cap.prism_rect_recess");
      expect(recessed.length, "PC5 alone under the recess sentence").toBe(1);
      const formula = String((recessed[0] as Record<string, unknown>)["formula"]);
      expect(formula, "and its line prints what it netted: the heads, then the recess (L-QTY-03)").toContain("n × 3.14159265358979323846 × d × d × e ÷ 4 − Lr × Br × Dr");
    },
    BUDGET_MS,
  );

  test(
    "pile_cap × rcc.formwork: PC5 formed along its recess's four sides too — 262.689 m², inside R0's band on 262.773",
    async () => {
      const { stage, formwork, cells } = await headsStated();
      const { exact } = await canon();
      expect(formwork.refused, "nothing refused").toBe(0);
      const held = cells.get(`${PILE_CAP}|${RCC_FORMWORK}`) as CellReading;
      expect([held.lines, held.partial], "26 lines, all COMPLETE").toEqual([26, 0]);
      expect(linesUnderRule(stage.tenantId, stage.campaignId, "rcc.pile_cap.formwork_rect_recess").length, "PC5 under the recess sentence").toBe(1);
      const owed = exact("254.132613").add(exact("2").mul(exact("2.493").add(exact("2.188"))).mul(exact("0.914")));
      expect(held.sum.eq(owed), `${held.sum.toString()} m² is 254.132613 and 2 × (2.493 + 2.188) × 0.914`).toBe(true);
      expect(held.sum.lte(exact("262.7735")) && exact("262.773").mul(exact("0.97")).sub(exact("0.0005")).lte(held.sum), "inside R0's band").toBe(true);
    },
    BUDGET_MS,
  );
});
