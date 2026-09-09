/**
 * AC-4's gate half — L-QTY-02's PARTIAL_DECLARED, published as a row with no quantity (SEAM-GATE,
 * L-QTY-02, L-QTY-03, L-MEA-08).
 *
 * "A row kept with no quantity (e.g. `STOREY_HEIGHT_UNSTATED`) is PARTIAL_DECLARED, never COMPLETE",
 * and L-MEA-08 fixes three arms: a declared exclusion enumerated on the row is neither a contract
 * violation (the refused arm) nor a deferral (the queued arm), so it publishes — with `value` null,
 * the omitted components on the row, and a formula that says which variable is missing and why
 * (riskNotes (2)).
 *
 * The offers are the RAIL's own, made through the shipped door over rows the register holds, so what
 * the gate is judged on is what the product would really hand it. The one hand-made offer is the
 * counter-case the criterion names: COMPLETE coverage with a declared variable simply absent, which
 * is the rail and the method disagreeing about the declaration and is still refused.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  COLUMN_CONCRETE_RULE_ID,
  COLUMN_CONCRETE_VERSION,
  COMPLETE,
  HEIGHT_VARIABLE,
  OFFER_NOT_TO_CONTRACT,
  PARTIAL_DECLARED,
  STOREY_HEIGHT_UNSTATED,
  closeStage,
  columnConcreteMethod,
  columnLinesOf,
  columnRailDoor,
  gateSeam,
  levelUnread,
  offersContract,
  railInput,
  said,
  setupForRows,
  stageColumnCampaign,
  type ColumnCampaign,
  type ColumnOfferShape,
  type StoreRow,
  type VerdictShape,
} from "../rails/support/column-rail-stage";
import { LEVEL_ID } from "../rails/support/column-rail-stage";

afterAll(async () => {
  await closeStage();
});

/** What one run of the gate over the rail's batch left behind, computed once and read by every case. */
type Run = { it: ColumnCampaign; verdict: VerdictShape; kept: ColumnOfferShape; malformed: ColumnOfferShape };

let running: Promise<Run> | undefined;

const run = (): Promise<Run> =>
  (running ??= (async () => {
    const it = await stageColumnCampaign("partial", { objects: 2 });
    const rail = await columnRailDoor();
    const gate = await gateSeam();

    // Both rows stand on a level nobody has read a storey height for, so the rail offers both under
    // PARTIAL_DECLARED with the height enumerated as omitted.
    const setup = setupForRows(it.rows, { height: levelUnread({ levelId: LEVEL_ID, label: "L1", ordinal: 1 }).height });
    const input = railInput({
      campaignId: it.campaignId,
      setRevisionId: it.setRevisionId,
      objects: it.rows,
      placements: setup.placements,
      memberTypes: setup.memberTypes,
      levels: setup.levels,
      calibrations: setup.calibrations,
    });
    const offered = rail.columnConcreteRail(input).offers;
    expect(offered.length, "both staged column rows are offered — a level with no height is a row kept, not a row dropped (L-QTY-02)").toBe(2);

    const kept = offered[0] as ColumnOfferShape;
    // The counter-case: the same reading, claiming COMPLETE coverage while a declared variable is
    // simply absent from the bindings. Nothing is enumerated, so nothing declares the omission.
    const malformed: ColumnOfferShape = { ...(offered[1] as ColumnOfferShape), coverage: COMPLETE, omitted: [] };

    const verdict = await gate.evaluateOffers(it.gateScope, { offers: [kept, malformed], observations: [] });
    return { it, verdict, kept, malformed };
  })());

/** The one line this campaign published for the kept offer. */
async function keptLine(): Promise<StoreRow> {
  const { it, kept } = await run();
  const lines = columnLinesOf(it.tenantId, it.campaignId).filter((row) => said(row, "objectKey", "object_key") === kept.register.objectKey);
  expect(lines.length, `the kept offer published exactly one line (the campaign holds ${lines.length} for its object)`).toBe(1);
  return lines[0] as StoreRow;
}

describe("AC-4: a declared exclusion publishes a row with no quantity", () => {
  test("AC-4: the kept offer lands on the published arm, the malformed one is refused, and the arms sum to the offers", async () => {
    const { verdict, malformed } = await run();

    expect(
      { published: verdict.published, queued: verdict.queued, refused: verdict.refused },
      "a declared exclusion is a row the gate publishes — neither a refusal (contract violations only) nor a queue item (riskNotes (2))",
    ).toEqual({ published: 1, queued: 0, refused: 1 });
    expect(verdict.published + verdict.refused + verdict.queued, "and the three arms still account for every offer handed in (L-MEA-08)").toBe(2);
    expect(
      [...verdict.refusals],
      "an offer claiming COMPLETE coverage while a declared variable is missing from its bindings is the rail and the method disagreeing (AC-4)",
    ).toEqual([{ objectKey: malformed.register.objectKey, code: OFFER_NOT_TO_CONTRACT }]);
  });

  test("AC-4: the published row carries no quantity, states PARTIAL_DECLARED and enumerates what it omitted", async () => {
    const { kept } = await run();
    const row = await keptLine();
    const contract = await offersContract();

    expect(said(row, "ruleId", "rule_id"), "the line names the rule it was derived by (L-QTY-03)").toBe(COLUMN_CONCRETE_RULE_ID);
    expect(said(row, "ruleVersion", "rule_version"), "and the version the edition put in force").toBe(COLUMN_CONCRETE_VERSION);
    expect((row as Record<string, unknown>)["value"] ?? null, "a row kept with no quantity carries no quantity — never a zero, never a guess (L-QTY-02)").toBeNull();
    expect(said(row, "coverage", "coverage"), "and states the coverage it stands under (L-QTY-02)").toBe(PARTIAL_DECLARED);
    expect(contract.COVERAGES, "PARTIAL_DECLARED is a coverage the rail↔gate contract admits — PARTIAL_UNDECLARED is unrepresentable (L-QTY-02)").toContain(PARTIAL_DECLARED);
    expect(
      (row as Record<string, unknown>)["omitted"],
      "every omitted component is enumerated on the row itself, exactly as the rail declared it (L-QTY-02)",
    ).toEqual([...kept.omitted]);
    expect([...kept.omitted], "and the omission this level stands under is the height, by its registered code").toEqual([
      { variable: HEIGHT_VARIABLE, code: STOREY_HEIGHT_UNSTATED },
    ]);
  });

  test("AC-4: the rendered formula names the omitted variable and why it is missing", async () => {
    const { kept } = await run();
    const row = await keptLine();
    const gate = await gateSeam();
    const method = await columnConcreteMethod();

    // The sentence a reader audits the row by, composed from the method's own declaration and the
    // gate's own carrying — never a string typed here (L-QTY-03, B-19).
    const named = method.variables.map((variable) => {
      const left = kept.omitted.find((entry) => entry.variable === variable.name);
      if (left !== undefined) return `${variable.name} omitted: ${left.code}`;
      const carried = gate.normaliseMeasure(kept.bindings[variable.name] as { value: string; unit: string; basis: string; source: string }, variable.dimension);
      expect(carried.ok, `the gate carries ${variable.name} into the canonical unit of ${variable.dimension}: ${JSON.stringify(carried)}`).toBe(true);
      const held = carried as { ok: true; value: string; unit: string };
      return `${variable.name} = ${held.value} ${held.unit}`;
    });

    expect(
      said(row, "formula", "formula"),
      "the human-auditable formula is rendered from the method's one template, and says of the missing variable that it was omitted and under which code (L-QTY-03, AC-4)",
    ).toBe(`${method.template} (${named.join(", ")})`);
    expect(said(row, "formula", "formula"), "the sentence opens with the method's template itself").toContain(`${method.template} (`);
    expect(said(row, "formula", "formula"), "and names the height as omitted under the code the level stands at").toContain(
      `${HEIGHT_VARIABLE} omitted: ${STOREY_HEIGHT_UNSTATED}`,
    );
  });
});
