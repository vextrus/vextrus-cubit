/**
 * AC-1 (the live half) — the database admits a quantity of the new kind.
 *
 * `rcc.formwork` is closed over in four places at once: the catalogue's `KINDS`, and the four
 * `*_kind_closed` CHECKs the migrations state over `closedList(KINDS)`. A kind minted in the consts
 * and not re-stated in the CHECKs is a kind the product measures and the store refuses — so this
 * drives one formwork offer through the shipped gate and asks the store to hold the line it
 * published. Nothing is inserted by hand: a line the gate wrote is the only proof the door is open.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  COMPLETE,
  LEVEL_PLACEHOLDER,
  QUANTITY_LINES_TABLE,
  closeStage,
  field,
  gateSeam,
  measure,
  offer,
  registerSeam,
  rowsOfCampaign,
  stageCampaign,
  type OfferShape,
  type StagedCampaign,
  type StoreRow,
  type VerdictShape,
} from "../gate/support/gate-stage";
import { COLUMN_C1 } from "../register/support/register-stage";
import { BEAM_CLASS, BEAM_FORMWORK_RULE_ID, FRAME_VERSION, MILLIMETRES, PIECES, PRISM_RECT, RCC_FORMWORK } from "./support/frame-rail-stage";

/** The calibration the readings of this offer stand on (L-QTY-03). */
const CALIBRATION = "CAL:S-102:grid-B";

/** The pair the campaign's edition puts in force for this line (AC-2). */
const BEAM_FORMWORK_PAIR = { ruleId: BEAM_FORMWORK_RULE_ID, version: FRAME_VERSION };

/** The readings the beam-formwork method declares, in the unit the drawing wrote them in (AC-2). */
const READINGS: Readonly<Record<string, string>> = Object.freeze({ b: "250", D: "450", t_left: "0", t_right: "150", clear: "4200" });

afterAll(async () => {
  await closeStage();
});

type Run = { it: StagedCampaign; verdict: VerdictShape; offer: OfferShape; lines: StoreRow[] };

let running: Promise<Run> | undefined;

const run = (): Promise<Run> =>
  (running ??= (async () => {
    const it = await stageCampaign("frame-kind", { methods: [BEAM_FORMWORK_PAIR] });
    const register = await registerSeam();
    const answered = await register.registerSighting(it.registerScope, {
      ...COLUMN_C1,
      elementType: BEAM_CLASS,
      label: "frame-kind-beam",
      mark: "B1",
      level: { levelId: LEVEL_PLACEHOLDER },
    });
    expect(field(answered, "registered", "registered"), `the beam sighting registered: ${JSON.stringify(answered)}`).toBe(true);
    const objectKey = String(field(answered, "objectKey", "object_key"));

    const bindings = Object.fromEntries(
      Object.entries(READINGS).map(([name, value]) => [name, measure(value, MILLIMETRES, { calibration: CALIBRATION })]),
    );
    bindings["count"] = measure("1", PIECES, { calibration: CALIBRATION });

    const made = offer({
      setRevisionId: it.setRevisionId,
      objectKey,
      kind: RCC_FORMWORK,
      class: BEAM_CLASS,
      geometryType: PRISM_RECT,
      ruleId: BEAM_FORMWORK_RULE_ID,
      bindings,
      calibration: CALIBRATION,
    });

    const gate = await gateSeam();
    const verdict = await gate.evaluateOffers(it.gateScope, { offers: [made], observations: [] });
    return { it, verdict, offer: made, lines: rowsOfCampaign(QUANTITY_LINES_TABLE, it.tenantId, it.campaignId) };
  })());

describe("AC-1: a line of the new kind can be published and stored", () => {
  test("AC-1: the gate publishes the formwork offer rather than refusing it", async () => {
    const { verdict } = await run();
    expect(
      { published: verdict.published, refused: verdict.refused, queued: verdict.queued },
      `an offer of a kind the catalogue holds and a class that bears it is published: ${JSON.stringify(verdict.refusals)}`,
    ).toEqual({ published: 1, refused: 0, queued: 0 });
  });

  test("AC-1: the store holds it — the four closed-kind CHECKs admit rcc.formwork", async () => {
    const { lines } = await run();
    expect(lines.length, "the campaign holds the line the gate published; a CHECK that never learned the new kind would have refused the write").toBe(1);
    const line = lines[0] as StoreRow;
    expect(String(field(line, "kind", "kind")), "and it is stored as the kind it was measured under").toBe(RCC_FORMWORK);
    expect(String(field(line, "class", "class")), "on the class that bears it").toBe(BEAM_CLASS);
    expect(String(field(line, "coverage", "coverage")), "with every component of its description measured (L-QTY-02)").toBe(COMPLETE);
  });
});
