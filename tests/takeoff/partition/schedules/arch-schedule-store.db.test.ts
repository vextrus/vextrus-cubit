// @vitest-environment node
/**
 * DB LANE — F-ARCH's schedules through the partition's own store (session 8, ARCH-3; s-schedules
 * I-506/f/g/h), live, against a scratch database the committed migrations built (0062 among them).
 *
 * The drawing is read by the shipped `cad/` CLI and the partition's pure stages
 * (`../support/arch-stages`); what they derived is written by `rewriteScheduleRows` — the very call the
 * partition's one transaction makes — and read back by `storedMemberTypesOf` and `storedSchedulesOf`,
 * the readers the rails and S-Schedules read through. Nothing here writes or reads a table by hand.
 *
 * What is graded:
 *   · the printed quantity travels as a cited reading in its own table and comes back beside the
 *     variant it was printed for — T-OPENING-NOS's disagreement with it, code, cell, plan and tags;
 *   · a wall type's `thickness` and the re-stated dimension roster are admitted by the store;
 *   · the four tables stand, the room finish schedule among them, and nothing defers;
 *   · a rebuild that derives nothing leaves no printed quantity behind (L-REG-04).
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../../db/__tests__/harness";
import { TENANT_ALPHA } from "../../../../db/__tests__/support/fixtures";
import { seedTenants } from "../../../../db/__tests__/support/live-sql";
import { closePools, forTenant } from "@/core/db";
import { REFUSALS } from "@/core/errors";
import type { MemberFamily } from "@/modules/takeoff/partition/schedules/registry";
import { rewriteScheduleRows, storedMemberTypesOf, storedSchedulesOf } from "@/modules/takeoff/partition/schedules/store";
import { archStages, trapKey } from "../support/arch-stages";
import type { StagesRead } from "../support/bnbc-stages";

/** How long the stage may take: a cold `uv run`, a scratch database, the stages. */
const BUDGET_MS = 240_000;

type Stage = { tenantId: string; projectId: string; drawingId: string; ingestId: string; read: StagesRead };

let scratch: ScratchDb | undefined;
let staging: Promise<Stage> | undefined;

/** A scratch database, one tenant, and F-ARCH's schedules written through the store — once. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantId = seedTenants(provisioned.urlMigrate)[TENANT_ALPHA] ?? "";
    expect(tenantId, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");
    // The seam pools per URL at connection time, so the app URL is named before the first query.
    process.env["DATABASE_URL"] = provisioned.urlApp;
    const read = await archStages();
    const stage: Stage = { tenantId, projectId: randomUUID(), drawingId: randomUUID(), ingestId: randomUUID(), read };
    await write(stage, true);
    return stage;
  })());

/** The partition's own write of what the schedules stage derived — or, for a rebuild that derived nothing, of none. */
async function write(stage: Stage, derived: boolean): Promise<void> {
  const { read } = stage;
  await forTenant({ tenantId: stage.tenantId }).transaction((tx) =>
    rewriteScheduleRows(tx, {
      tenantId: stage.tenantId,
      projectId: stage.projectId,
      drawingId: stage.drawingId,
      ingestId: stage.ingestId,
      schedules: derived
        ? {
            views: read.reconstructed.views,
            tables: read.reconstructed.tables,
            registry: read.registered.families,
            deferrals: [...read.reconstructed.deferrals, ...read.registered.deferrals],
          }
        : null,
    }),
  );
}

afterAll(async () => {
  await closePools();
  await scratch?.drop();
});

/** A family by its schedule's caption and its mark, as the stages registered it. */
function registered(read: StagesRead, caption: string, mark: string): MemberFamily | undefined {
  const table = read.reconstructed.tables.find((one) => one.title.startsWith(caption));
  return read.registered.families.find((family) => family.scheduleKey === table?.scheduleKey && family.family === mark);
}

describe("F-ARCH's schedules through the store (I-506..h)", () => {
  test(
    "every family comes back as the stages registered it — variants, sizes, thickness and printed quantities, byte for byte",
    async () => {
      const stage = await staged();
      const stored = await storedMemberTypesOf(stage.tenantId, stage.ingestId);
      const key = (family: Pick<MemberFamily, "scheduleKey" | "family">): string => `${family.scheduleKey}\u0000${family.family}`;
      const expected = new Map(stage.read.registered.families.map((family) => [key(family), family]));
      expect(stored.families.map(key).sort()).toEqual([...expected.keys()].sort());
      for (const family of stored.families) expect(family, `${family.family} of ${family.scheduleKey}`).toStrictEqual(expected.get(key(family)));
    },
    BUDGET_MS,
  );

  test(
    "T-OPENING-NOS: D-2's printed quantity is stored beside its variant as a cited reading, its disagreement with the plan declared — never a count of the member type",
    async () => {
      const stage = await staged();
      const stored = await storedMemberTypesOf(stage.tenantId, stage.ingestId);
      const typical = registered(stage.read, "DOOR & WINDOW SCHEDULE (1ST TO 6TH FLOOR)", "D2");
      const d2 = stored.families.find((family) => family.scheduleKey === typical?.scheduleKey && family.family === "D2");
      const printed = d2?.variants[0]?.printed;
      expect(printed?.refusal).toBe(REFUSALS.OPENING_QUANTITY_DISAGREES.code);
      expect([printed?.text, printed?.printed, printed?.basis, printed?.tagKeys.length]).toEqual(["08 NOS", 8, "per-floor", 9]);
      expect(printed?.sourceKeys, "cited to the trap's own cell").toEqual([trapKey("T-OPENING-NOS")]);
      expect(printed?.planKey, "checked against the typical floor plan").toMatch(/^LAYOUT_PLAN:/u);
      expect(d2?.variants[0]?.dimensions, "no count is filed as a dimension of the type (L-CAD-08)").toBeUndefined();
    },
    BUDGET_MS,
  );

  test(
    "BW250 and BW125 keep their thickness in millimetres — the re-stated roster admits it",
    async () => {
      const stage = await staged();
      const stored = await storedMemberTypesOf(stage.tenantId, stage.ingestId);
      const thickness = (mark: string) => stored.families.find((family) => family.family === mark)?.variants[0]?.dimensions?.find((one) => one.dimension === "thickness");
      expect([thickness("BW250")?.value, thickness("BW250")?.unit]).toEqual([250, "mm"]);
      expect([thickness("BW125")?.value, thickness("BW125")?.unit]).toEqual([125, "mm"]);
    },
    BUDGET_MS,
  );

  test(
    "the four tables stand, the room finish schedule among them, every cell cited; nothing defers",
    async () => {
      const stage = await staged();
      const stored = await storedSchedulesOf(stage.tenantId, stage.ingestId);
      expect(stored.schedules.map((table) => table.title.replace(/ {2}SCALE 1:\d+$/u, "")).sort()).toEqual([
        "DOOR & WINDOW SCHEDULE (1ST TO 6TH FLOOR)",
        "DOOR & WINDOW SCHEDULE (GROUND FLOOR)",
        "ROOM FINISH SCHEDULE",
        "WALL TYPES",
      ]);
      expect(stored.deferrals).toEqual([]);
      for (const table of stored.schedules) for (const cell of table.cells) expect(cell.sourceKeys.length, `${table.title} [${cell.rowIndex},${cell.columnIndex}]`).toBeGreaterThan(0);
    },
    BUDGET_MS,
  );

  test(
    "a rebuild that derives nothing leaves no printed quantity behind (L-REG-04)",
    async () => {
      const stage = await staged();
      await write(stage, false);
      const stored = await storedMemberTypesOf(stage.tenantId, stage.ingestId);
      expect(stored.families).toEqual([]);
      await write(stage, true);
      const again = await storedMemberTypesOf(stage.tenantId, stage.ingestId);
      expect(again.families.flatMap((family) => family.variants.flatMap((variant) => (variant.printed === undefined ? [] : [variant.printed]))).length, "and writing again restores every one").toBe(17);
    },
    BUDGET_MS,
  );
});
