/**
 * The COMPLETE half of the column-concrete line the gate publishes (L-QTY-01, L-QTY-03, L-FRM-06).
 *
 * Its sibling beside it drives the row kept with NO quantity; this drives the row that carries one,
 * over the setup the stage describes a staged campaign with — a storey height a drawing wrote as
 * `M`. "Source unit AS WRITTEN" (L-REG-01) is what a rail binds, so the gate is the carrier that has
 * to ask the canon what a written spelling names; a gate that only recognised the canon's own
 * spellings would refuse every column line `UNIT_UNMAPPED` and publish nothing at all.
 *
 * Nothing here is a number typed by hand: the value, the canonical readings and the formula are all
 * read back through the product's own doors — the method's declaration, the gate's `normaliseMeasure`
 * and its `renderFormula` — so the case grades the line against the law rather than against a
 * transcript of today's arithmetic (B-19).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  COLUMN_CONCRETE_RULE_ID,
  COLUMN_CONCRETE_VERSION,
  COMPLETE,
  DEFAULTED,
  TRANSCRIBED,
  CALIBRATION_KEY,
  closeStage,
  columnConcreteMethod,
  columnLinesOf,
  columnRailDoor,
  field,
  gateSeam,
  railInput,
  rowsOfCampaign,
  said,
  setupForRows,
  stageColumnCampaign,
  unitsSeam,
  type ColumnCampaign,
  type ColumnOfferShape,
  type FormulaMethodShape,
  type MeasureShape,
  type StoreRow,
  type VerdictShape,
} from "../rails/support/column-rail-stage";
import { CAMPAIGNS_TABLE } from "./support/gate-stage";

afterAll(async () => {
  await closeStage();
});

/** What one run of the gate over the rail's COMPLETE batch left behind, computed once. */
type Run = { it: ColumnCampaign; verdict: VerdictShape; offer: ColumnOfferShape; line: StoreRow };

let running: Promise<Run> | undefined;

const run = (): Promise<Run> =>
  (running ??= (async () => {
    const it = await stageColumnCampaign("complete");
    const rail = await columnRailDoor();
    const gate = await gateSeam();

    const setup = setupForRows(it.rows);
    const offered = rail.columnConcreteRail(
      railInput({
        campaignId: it.campaignId,
        setRevisionId: it.setRevisionId,
        objects: it.rows,
        placements: setup.placements,
        memberTypes: setup.memberTypes,
        levels: setup.levels,
        calibrations: setup.calibrations,
      }),
    ).offers;
    expect(offered.length, "the staged column row is offered once — one offer per (instance row, level)").toBe(1);
    const offer = offered[0] as ColumnOfferShape;
    expect(offer.coverage, "and it is COMPLETE: the level's storey height stands AGREED, so nothing is omitted (L-QTY-02)").toBe(COMPLETE);

    const verdict = await gate.evaluateOffers(it.gateScope, { offers: [offer], observations: [] });
    const lines = columnLinesOf(it.tenantId, it.campaignId);
    expect(lines.length, `the campaign holds one column-concrete line (it holds ${lines.length}): ${JSON.stringify(verdict.refusals)}`).toBe(1);
    return { it, verdict, offer, line: lines[0] as StoreRow };
  })());

/** Every declared variable's reading carried through the gate's own door, by name. */
async function carried(offer: ColumnOfferShape, method: FormulaMethodShape): Promise<Record<string, { value: string; unit: string }>> {
  const gate = await gateSeam();
  const normalised: Record<string, { value: string; unit: string }> = {};
  for (const variable of method.variables) {
    const answer = gate.normaliseMeasure(offer.bindings[variable.name] as MeasureShape, variable.dimension);
    expect(answer.ok, `the gate carries ${variable.name}, written "${String(offer.bindings[variable.name]?.unit)}", into the canonical unit of ${variable.dimension}: ${JSON.stringify(answer)}`).toBe(true);
    const held = answer as { ok: true; value: string; unit: string };
    normalised[variable.name] = { value: held.value, unit: held.unit };
  }
  return normalised;
}

describe("the gate publishes a COMPLETE column-concrete line over readings in the units they were written in", () => {
  test("a storey height written `M` carries: the offer publishes rather than being refused UNIT_UNMAPPED", async () => {
    const { verdict, offer } = await run();

    expect(offer.bindings["H"]?.unit, "the rail binds the height in the unit the drawing wrote it in — it converts nothing (L-REG-01)").toBe("M");
    expect(
      { published: verdict.published, queued: verdict.queued, refused: verdict.refused },
      `a written spelling the canon names is a unit the gate can carry, so the offer publishes: ${JSON.stringify(verdict.refusals)}`,
    ).toEqual({ published: 1, queued: 0, refused: 0 });
  });

  test("the line states the rule, the unit it measures in, its coverage and the references it stands on", async () => {
    const { it, line } = await run();
    const units = await unitsSeam();
    const method = await columnConcreteMethod();

    expect(said(line, "ruleId", "rule_id"), "the line names the rule it was derived by (L-QTY-03)").toBe(COLUMN_CONCRETE_RULE_ID);
    expect(said(line, "ruleVersion", "rule_version"), "and the version the edition put in force").toBe(COLUMN_CONCRETE_VERSION);
    expect(said(line, "coverage", "coverage"), "a row with every component of its description measured is COMPLETE (L-QTY-02)").toBe(COMPLETE);
    expect((line as Record<string, unknown>)["omitted"], "and enumerates no omission — the other half of the same statement").toEqual([]);
    expect(said(line, "unit", "unit"), "the line is stated in the canonical unit of the dimension its method measures (L-FRM-06)").toBe(units.CANONICAL_UNIT[method.dimension]);

    const campaign = rowsOfCampaign(CAMPAIGNS_TABLE, it.tenantId, it.campaignId)[0] as StoreRow;
    expect(said(line, "editionDigest", "edition_digest"), "the line is measured under the edition the campaign snapshotted (L-REG-07)").toBe(
      String(field(campaign, "editionDigest", "edition_digest")),
    );
    expect((line as Record<string, unknown>)["calibrationKeys"] ?? (line as Record<string, unknown>)["calibration_keys"], "and stands on the affirmed calibration reference of its (drawing, view) — a non-empty set (L-QTY-03)").toEqual([CALIBRATION_KEY]);
  });

  test("the two roll-ups are weakest-wins over the readings the line records beside them (L-QTY-01)", async () => {
    const { line } = await run();

    expect(
      said(line, "quantityBasis", "quantity_basis"),
      "the geometry and the count were MEASURED and the section and the height TRANSCRIBED, so the quantity is only as strong as its weakest determining attribute",
    ).toBe(TRANSCRIBED);
    expect(said(line, "selectionBasis", "selection_basis"), "and no selecting attribute was carried at all: nobody looked, nobody decided (riskNotes (5))").toBe(DEFAULTED);
  });

  test("each binding records what the drawing said beside what the canon made of it", async () => {
    const { offer, line } = await run();
    const method = await columnConcreteMethod();
    const normalised = await carried(offer, method);

    const recorded = (line as Record<string, unknown>)["bindings"] as Record<string, { value: string; unit: string; basis: string; source: string; canonical: { value: string; unit: string } }>;
    for (const variable of method.variables) {
      const reading = offer.bindings[variable.name] as MeasureShape;
      expect(recorded[variable.name], `the line records ${variable.name} — every variable the method declares (L-QTY-03)`).toBeTruthy();
      expect(
        { value: recorded[variable.name]?.value, unit: recorded[variable.name]?.unit, basis: recorded[variable.name]?.basis, source: recorded[variable.name]?.source },
        `and records ${variable.name} as it was WRITTEN, spelling and all — a reader re-reads the drawing, not the canon (L-REG-01)`,
      ).toEqual({ value: reading.value, unit: reading.unit, basis: reading.basis, source: reading.source });
      expect(recorded[variable.name]?.canonical, `beside the SI value at full precision the gate carried it to (L-QTY-03)`).toEqual(normalised[variable.name]);
    }
  });

  test("the value and the formula come from the one template, over the same carried readings", async () => {
    const { line } = await run();
    const { offer } = await run();
    const gate = await gateSeam();
    const units = await unitsSeam();
    const method = await columnConcreteMethod();
    const normalised = await carried(offer, method);

    expect(
      units.exact(said(line, "value", "value")).eq(units.exact(method.evaluate(normalised))),
      `the quantity is the method's own evaluation over the carried readings — ${said(line, "value", "value")} against ${method.evaluate(normalised)}`,
    ).toBe(true);
    expect(said(line, "formula", "formula"), "and the sentence a reader audits it by is rendered from the same template the value was evaluated from (L-QTY-03)").toBe(
      gate.renderFormula(method, normalised),
    );
    expect(said(line, "formula", "formula"), "which opens with the template itself").toContain(`${method.template} (`);
    for (const variable of method.variables) {
      expect(said(line, "formula", "formula"), `and names ${variable.name} at the value and unit it was evaluated at`).toContain(
        `${variable.name} = ${String(normalised[variable.name]?.value)} ${String(normalised[variable.name]?.unit)}`,
      );
    }
  });
});
