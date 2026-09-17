/**
 * AC-3(a): a register row whose placement the setup does not hold is reported under a code that says
 * so — not under the one that says its FAMILY is unknown (debt-src-modules-bfezdu, L-MEA-08, Q-07).
 *
 * The two absences are graded side by side over one hand-built input, each taking away exactly one
 * thing: the placement, or the family's variants. A rail that answers one code for both cannot pass
 * both cases, which is what makes the copy a reader is sent to the right copy.
 */
import { describe, expect, test } from "vitest";
import { MODULE, agreedHeight, levelSetup, productModule, railInput, registerRow, variantSetup } from "./support/sweep-stage";

/** One observation a rail reports instead of offering a row (L-MEA-08). */
type Observation = { class: string; kind: string; code: string; objectKey?: string; sourceEntity?: string };

/** What a rail answers with. */
type Batch = { offers: readonly Record<string, unknown>[]; observations: readonly Observation[] };

type Rail = (input: Record<string, unknown>) => Batch;

/** One registered refusal, as the register holds one. */
type Entry = { code: string; message: string; remedy: string; severity: string; surface: string };

const PLACEMENT_UNHELD = "PLACEMENT_UNHELD";
const MEMBER_TYPE_UNKNOWN = "MEMBER_TYPE_UNKNOWN";
const RCC_CONCRETE = "rcc.concrete";

const INGEST_ID = "33333333-3333-4333-8333-333333333333";
const VIEW_KEY = "PLAN:S-102:t:4";
const LEVEL_ID = "44444444-4444-4444-8444-444444444444";
const PLACEMENT_KEY = "PLACEMENT:S-102:C1:1000:2000";
const FAMILY = "C1";

/** The one row every case reads, and the setup that stands whole around it. */
const ROW = registerRow({ placementKey: PLACEMENT_KEY, levelId: LEVEL_ID, viewKey: VIEW_KEY, mark: FAMILY });

function input(changed: { placements?: Record<string, unknown>; memberTypes?: Record<string, Record<string, readonly Record<string, unknown>[]>> } = {}): Record<string, unknown> {
  return railInput({
    kind: RCC_CONCRETE,
    objects: [ROW],
    placements: changed.placements ?? {
      [PLACEMENT_KEY]: { drawingId: "22222222-2222-4222-8222-222222222222", ingestId: INGEST_ID, viewKey: VIEW_KEY, memberFamily: FAMILY, engine: "VECTOR", sourceEntity: PLACEMENT_KEY },
    },
    memberTypes: changed.memberTypes ?? { [INGEST_ID]: { [FAMILY]: [variantSetup({ variantKey: FAMILY, width: 300, depth: 450 })] } },
    levels: [levelSetup({ levelId: LEVEL_ID, label: "L1", ordinal: 0, height: agreedHeight("3", "M", "S-105:e:3") })],
    calibrations: { [INGEST_ID]: { [VIEW_KEY]: "cal-1" } },
  });
}

/** The column rail, and the roster of codes it publishes. */
async function railDoor(): Promise<{ rail: Rail; codes: readonly string[] }> {
  const door = await productModule<Record<string, unknown>>("src/modules/takeoff/rails/columns/index.ts");
  expect(typeof door["columnConcreteRail"], "the column rail's home publishes `columnConcreteRail`").toBe("function");
  expect(Array.isArray(door["COLUMN_RAIL_CODES"]), "and `COLUMN_RAIL_CODES`, the rail-local closed roster").toBe(true);
  return { rail: door["columnConcreteRail"] as Rail, codes: door["COLUMN_RAIL_CODES"] as readonly string[] };
}

/** The one observation a batch reports, having offered nothing. */
function reported(batch: Batch): Observation {
  expect(batch.offers, "a row the rail could not read is not offered (L-MEA-08)").toEqual([]);
  expect(batch.observations.length, "and it is reported exactly once, on the row that earned it").toBe(1);
  return batch.observations[0] as Observation;
}

describe("AC-3: the absence a row is reported under is the absence it stands under", () => {
  test("AC-3: a row whose placement the setup does not hold is reported PLACEMENT_UNHELD, naming the placement key", async () => {
    const { rail, codes } = await railDoor();

    const unheld = reported(rail(input({ placements: {} })));
    expect(
      unheld.code,
      "the setup holds no placement for this row, so there is no drawing, view or engine to offer it under — and the reader is sent to rebuild the partition, not to a member-type registry that answered nothing wrong (Q-07: a code's copy is the recourse it names)",
    ).toBe(PLACEMENT_UNHELD);
    expect(unheld.sourceEntity, "and the entity it names is the placement key a reader has to go and look for").toBe(PLACEMENT_KEY);
    expect(unheld.objectKey, "on the register row that is the evidence").toBe(ROW["objectKey"]);

    const unknown = reported(rail(input({ memberTypes: { [INGEST_ID]: {} } })));
    expect(unknown.code, "while a family the member-type registry holds no variant for keeps the code that says exactly that — its copy is not relitigated by this sweep").toBe(MEMBER_TYPE_UNKNOWN);

    expect(codes, "the rail's own closed roster carries the new code: a code a rail speaks and the roster does not name is a code no reader was told to expect (AM-11)").toContain(PLACEMENT_UNHELD);
    expect(codes, "and still carries the one it no longer speaks for this absence").toContain(MEMBER_TYPE_UNKNOWN);
  });

  test("AC-3: PLACEMENT_UNHELD is registered in the frame area and assembled into the one taxonomy", async () => {
    const area = await productModule<Record<string, unknown>>(MODULE.frameErrors);
    const registry = (area["FRAME_REFUSALS"] ?? {}) as Record<string, Entry | undefined>;
    const entry = registry[PLACEMENT_UNHELD];
    expect(entry, `${MODULE.frameErrors} registers ${PLACEMENT_UNHELD} — the area the column rail's codes live in (AM-11)`).toBeTruthy();
    expect((entry as Entry).code, "under its own name").toBe(PLACEMENT_UNHELD);
    expect((entry as Entry).message.length, "saying what happened").toBeGreaterThan(0);
    expect((entry as Entry).remedy.length, "and what to do about it").toBeGreaterThan(0);

    const barrel = await productModule<Record<string, unknown>>(MODULE.errors);
    const refusals = (barrel["REFUSALS"] ?? {}) as Record<string, Entry | undefined>;
    expect(refusals[PLACEMENT_UNHELD], "and the barrel enumerates it: one closed taxonomy, assembled and never re-declared (AM-11, ARCH-02)").toBeTruthy();
    expect(
      (refusals[MEMBER_TYPE_UNKNOWN] as Entry | undefined)?.message,
      "while MEMBER_TYPE_UNKNOWN's own copy is untouched — a code whose reading was wrong is re-homed, never rewritten (riskNotes (1))",
    ).toBe((registry[MEMBER_TYPE_UNKNOWN] as Entry | undefined)?.message);
  });
});
