/**
 * AC-7 — the finish rails offer a face net of its scheduled openings, with the facts that SELECT the
 * item carried as they were written and never as a band (L-MEA-03, L-MEA-06, L-QTY-03, AM-11).
 *
 * Both rails read the SAME surface and must say the same thing about what is deducted from it: a
 * plaster and a paint of one face are two work items of one geometry, so the candidates are the same
 * candidates and only the selecting facts differ (R-TO-032). What is graded is what the rails
 * ANSWER — two pure calls over the scenario the test contract states — and the two rosters that put
 * them in front of the measure job.
 *
 * The channel's threshold is graded through the gate's own partition, against an edition whose two
 * thresholds deliberately DISAGREE: a finish candidate judged by the opening channel's figure would
 * land on the other side, so the case says which parameter the channel really reads.
 */
import { describe, expect, test } from "vitest";
import {
  CALIBRATION_KEY,
  COMPLETE,
  DEDUCTION_CHANNELS_OWED,
  DERIVED,
  FINISH_OPENING_CHANNEL,
  FINISH_OPENING_THRESHOLD_PARAMETER,
  FINISH_PAINT,
  FINISH_PLASTER,
  GATE_MODULE,
  GEOMETRY_OF,
  MASONRY_BRICKWORK,
  MASONRY_ROSTER_LINES,
  OFFERS_LAW_MODULE,
  OPENING_CHANNEL,
  OPENING_THRESHOLD_PARAMETER,
  PAINT_RULE_ID,
  PAINT_SELECTORS,
  PLASTER_RULE_ID,
  PLASTER_SELECTORS,
  SURFACE,
  SURFACE_PLACEMENT,
  editionSource,
  expectedCandidates,
  masonryRailDoor,
  masonryRoster,
  productModule,
  railsRoster,
  seedEdition,
  surfaceScenario,
  type DeductionShape,
  type MeasureShape,
  type OfferShape,
  type RailShape,
  type ReadingShape,
  type SurfaceSetupShape,
} from "./support/masonry-contract";

/** A reading of the setup, as an offer carries it — value, unit, basis and source, as written. */
function asWritten(held: ReadingShape): MeasureShape {
  return { value: held.value, unit: held.unit, basis: held.basis, source: held.source };
}

/** Candidates compared as a multiset: what a rail offers is a SET of instances, not an order. */
function sorted(candidates: readonly DeductionShape[]): string[] {
  return candidates.map((candidate) => JSON.stringify(candidate)).sort();
}

/** The one offer this criterion expects, asserted to be one. */
function oneOffer(offers: readonly OfferShape[], what: string): OfferShape {
  expect(offers.length, `${what} — the rail answered ${JSON.stringify(offers.map((offer) => [offer.kind, offer.ruleId]))}`).toBe(1);
  return offers[0] as OfferShape;
}

describe("AC-7: the finish rails offer faces net of scheduled openings, with selecting facts", () => {
  test("AC-7: plasterRail answers one offer over F-MASONRY-SURFACE, bound and deducted as L-MEA-03 states it", async () => {
    const edition = await seedEdition();
    const door = await masonryRailDoor();
    const scenario = surfaceScenario(edition, FINISH_PLASTER);
    const held = scenario.input.setup.surfaces[SURFACE_PLACEMENT] as SurfaceSetupShape;

    const batch = (door.plasterRail as RailShape)(scenario.input);
    expect(batch.observations, "a surface read whole says nothing beside its offer").toEqual([]);
    const offer = oneOffer(batch.offers, "one surface bears one plaster item");

    expect(
      { kind: offer.kind, class: offer.class, ruleId: offer.ruleId },
      "the plaster of a surface, measured by the rule the shard records (interfaces)",
    ).toEqual({ kind: FINISH_PLASTER, class: SURFACE, ruleId: PLASTER_RULE_ID });
    expect(
      { type: offer.geometry.type, calibration: offer.geometry.calibration },
      "read as the POLYGON a closed outline is, standing on the affirmed calibration of the view it was read in (L-FRM-01, L-QTY-03)",
    ).toEqual({ type: GEOMETRY_OF[FINISH_PLASTER], calibration: CALIBRATION_KEY });
    expect(offer.register.objectKey, "about the register row it was read for (L-REG-04)").toBe(scenario.objectKey);
    expect(offer.coverage, "and nothing was left out (L-QTY-02)").toBe(COMPLETE);
    expect([...offer.omitted], "so nothing is enumerated as omitted").toEqual([]);

    expect(
      offer.bindings,
      "the gross as the reader wrote it, and the threshold DERIVED from the pinned edition it cites — `openings` is the GATE's to bind from what it partitioned, so a rail that bound it would be computing (L-MEA-08, riskNotes (2))",
    ).toEqual({
      gross: asWritten(held.gross as ReadingShape),
      threshold: {
        value: edition.parameters[FINISH_OPENING_THRESHOLD_PARAMETER]?.value,
        unit: edition.parameters[FINISH_OPENING_THRESHOLD_PARAMETER]?.unit,
        basis: DERIVED,
        source: editionSource(edition, FINISH_OPENING_THRESHOLD_PARAMETER),
      },
    });

    expect(
      sorted(offer.deductions),
      "one candidate per opening INSTANCE, each in the finish channel and each citing the schedule row it was read at — a rail enumerates, it never sums (L-MEA-03, L-MEA-08)",
    ).toEqual(sorted(expectedCandidates(scenario.openings, scenario.levelLabel, FINISH_OPENING_CHANNEL)));
    expect(
      offer.deductions.every((candidate) => candidate.channel === FINISH_OPENING_CHANNEL),
      "every one of them in the finish channel, which carries the finish threshold (goal)",
    ).toBe(true);

    expect(Object.keys(offer.selectors).sort(), "the four facts that SELECT a plaster item (L-MEA-06)").toEqual([...PLASTER_SELECTORS].sort());
    expect(
      offer.selectors,
      "each carried as the reader wrote it — `12 mm`, never `band: 2`: store the reading, and let the pricing seam band it (L-MEA-06)",
    ).toEqual({
      thickness: asWritten(held.thickness as ReadingShape),
      mix: asWritten(held.mix as ReadingShape),
      face: asWritten(held.face),
      floor: asWritten(held.floor),
    });
  });

  test("AC-7: paintRail answers one offer over the same surface — the same deductions, its own two selectors", async () => {
    const edition = await seedEdition();
    const door = await masonryRailDoor();
    const plaster = surfaceScenario(edition, FINISH_PLASTER);
    const paint = surfaceScenario(edition, FINISH_PAINT);
    const held = paint.input.setup.surfaces[SURFACE_PLACEMENT] as SurfaceSetupShape;

    const offer = oneOffer((door.paintRail as RailShape)(paint.input).offers, "one surface bears one paint item");
    expect({ kind: offer.kind, class: offer.class, ruleId: offer.ruleId }, "the paint of a surface, by its own rule (interfaces)").toEqual({
      kind: FINISH_PAINT,
      class: SURFACE,
      ruleId: PAINT_RULE_ID,
    });

    const plastered = oneOffer((door.plasterRail as RailShape)(plaster.input).offers, "and the plaster of the same surface");
    expect(
      sorted(offer.deductions),
      "the two finishes of one face deduct the same openings — one geometry, two work items (R-TO-032, L-MEA-03)",
    ).toEqual(sorted(plastered.deductions));

    expect(Object.keys(offer.selectors).sort(), "paint is selected by the face and the floor alone — a paint has no thickness and no mix (L-MEA-06)").toEqual([...PAINT_SELECTORS].sort());
    expect(offer.selectors, "each carried as the reader wrote it").toEqual({ face: asWritten(held.face), floor: asWritten(held.floor) });
  });

  test("AC-7: MASONRY_RAILS keys exactly the three kinds, and the barrel hands out those very functions", async () => {
    const roster = await masonryRoster();
    const rails = await railsRoster();
    const door = await masonryRailDoor();

    expect(Object.keys(roster).sort(), "the area's roster keys exactly the three kinds this shard measures (AM-11, L-MEA-08)").toEqual([...Object.keys(MASONRY_ROSTER_LINES)].sort());
    for (const [kind, rail] of Object.entries(MASONRY_ROSTER_LINES)) {
      expect(roster[kind], `${kind} is measured by \`${rail}\` itself — a wrapper would be a second implementation (ARCH-02)`).toBe(
        (door as unknown as Record<string, unknown>)[rail],
      );
      expect(rails[kind], `and the barrel answers ${kind} with the area's own rail (AM-11: the barrel enumerates and never re-declares)`).toBe(roster[kind]);
    }
    expect(
      typeof rails[MASONRY_BRICKWORK],
      "the barrel measures brickwork too — a kind with no rail is a kind nothing measures (L-MEA-08)",
    ).toBe("function");
  });

  test("AC-7: the contract admits both channels, and the finish channel is partitioned against its OWN threshold", async () => {
    const law = await productModule<{ DEDUCTION_CHANNELS: readonly string[] }>(OFFERS_LAW_MODULE);
    expect(
      [...law.DEDUCTION_CHANNELS],
      "the rail↔gate contract admits exactly the opening channel and the finish channel, in that order — a channel nobody admits is a candidate the gate refuses (interfaces)",
    ).toEqual([...DEDUCTION_CHANNELS_OWED]);

    const gate = await productModule<{
      partitionDeductions: (
        candidates: readonly DeductionShape[],
        parameters: Readonly<Record<string, { value: string; unit: string }>>,
      ) => { ok: boolean; deducted?: readonly DeductionShape[]; kept?: readonly DeductionShape[]; code?: string };
    }>(GATE_MODULE);
    expect(typeof gate.partitionDeductions, `${GATE_MODULE} publishes \`partitionDeductions\` — where a channel meets its threshold (L-MEA-08)`).toBe("function");

    // The two thresholds disagree on purpose: a finish candidate of 2.1 m² is ABOVE the finish
    // threshold and BELOW the opening one, so which side it lands on says which parameter the
    // finish channel really reads (L-MEA-01: a threshold per channel).
    const parameters = { [OPENING_THRESHOLD_PARAMETER]: { value: "99", unit: "m2" }, [FINISH_OPENING_THRESHOLD_PARAMETER]: { value: "0.1", unit: "m2" } };
    const over: DeductionShape = { channel: FINISH_OPENING_CHANNEL, measure: { value: "2.1", unit: "m2", basis: "TRANSCRIBED", source: "sched#w2" } };
    const at: DeductionShape = { channel: FINISH_OPENING_CHANNEL, measure: { value: "0.1", unit: "m2", basis: "TRANSCRIBED", source: "sched#w1" } };

    const answer = gate.partitionDeductions([over, at], parameters);
    expect(answer.ok, `the two candidates partition: ${JSON.stringify(answer)}`).toBe(true);
    expect(
      [...(answer.deducted ?? [])],
      `the finish channel reads \`${FINISH_OPENING_THRESHOLD_PARAMETER}\` and not the opening channel's figure — 2.1 m² is above the one and below the other (L-MEA-01, interfaces)`,
    ).toEqual([over]);
    expect([...(answer.kept ?? [])], "and a candidate exactly AT its own threshold is KEPT — the partition is strictly greater (L-MEA-02)").toEqual([at]);

    // The same measure, in the other channel: judged by the OTHER parameter, it is kept. The two
    // channels do not borrow each other's thresholds (L-MEA-01: a threshold per channel).
    const asOpening: DeductionShape = { ...over, channel: OPENING_CHANNEL };
    const other = gate.partitionDeductions([asOpening], parameters);
    expect(other.ok, `the same measure partitions in the opening channel: ${JSON.stringify(other)}`).toBe(true);
    expect(
      [...(other.kept ?? [])],
      `2.1 m² is KEPT in the opening channel, where the threshold this edition states is 99 m² — the same reading, the other parameter, the other side (L-MEA-01)`,
    ).toEqual([asOpening]);
  });
});
