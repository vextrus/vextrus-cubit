/**
 * AC-1, AC-3, AC-5 — the fourth partition stage: a gridless schedule table reconstructed from the
 * texts a drawing really carries, and the member-type registry folded out of it (R-TO-030, R-TO-031,
 * L-CAD-08).
 *
 * The stage is driven through the SHIPPED job over a really recorded ingest: a drawing is seeded, the
 * shipped ingest pipeline records it from a stand-in CLI that hands back a hand-authored artifact,
 * and `runPartitionJob` is then run over that record. What is graded is what the run left in the
 * store, what the module's own doors answer about it, and what the two pure functions answer for the
 * same evidence.
 *
 * Nothing here transcribes a row. The table an artifact owes is read off the artifact that was drawn
 * — its header band, its data bands and the keys of the texts in them — and every parsed field of the
 * registry is the notation's own reading of the verbatim cell text, which the golden corpus pins
 * independently (B-19, AC-6). An artifact drawn differently owes different rows.
 *
 * The model is asked from an EMPTY fixture root: both captions of the staged artifact are ones the
 * grammar reads, so nothing can leave this suite for a network (L-AI-01).
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import {
  PRINCIPAL,
  closeStage,
  grantRole,
  openSheetsStage,
  productModule,
  rebuildDoor,
  stagePerson,
  tempFixtureRoot,
  unique,
  withFixtureRoot,
  type Person,
  type StepRecord,
} from "../support/partition-stage";
import { stageDrawing } from "../../support/ingest-stage";
import {
  GRID_STAGE,
  SCENARIO,
  SCHEDULE,
  SCHEDULES,
  SCHEDULES_STAGE,
  SCHEDULE_DEFERRAL_REASONS_HOME,
  SCHEDULE_NONE_RECONSTRUCTED,
  SCHEDULE_VIEW_CONTRIBUTED_NOTHING,
  STORED_STEP,
  ZONE_MAIN,
  ZONE_TIES_END,
  ZONE_TIES_MID,
  asideBandsOf,
  byCell,
  byKey,
  cellOf,
  countWordsAmong,
  dataBandsOf,
  deferralOf,
  evidenceOf,
  expectedFamiliesOf,
  expectedTableOf,
  headerBandOf,
  keysAtEveryDepth,
  keysOf,
  memberTypeRows,
  notationDoor,
  reconstructDoor,
  registryDoor,
  runSchedulePartition,
  scheduleCellRows,
  scheduleDeferralRows,
  scheduleOf,
  scheduleRows,
  scheduleStoreDoor,
  scheduleViewKey,
  schedulesDoor,
  stageScheduleIngest,
  tableSnapshot,
  variantKeyOf,
  viewKeysOfType,
  withScheduleWriteBroken,
  type FamilyRow,
  type StagedScheduleIngest,
} from "../support/schedules-stage";

/** How long a staged case may take: a database provisioned, a drawing ingested, a partition run. */
const BUDGET_MS = 900_000;

/** The bytes a stored drawing is addressed by; what they say decides nothing. */
const BYTES = new TextEncoder().encode("0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n");

interface Staged {
  person: Person;
  projectId: string;
  plain: StagedScheduleIngest;
  steps: StepRecord[];
  viewKey: string;
}

let staging: Promise<Staged> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    // The stage's own doors are asked for FIRST: a tree this stage has not been built into should
    // red as the modules it is missing rather than after a database and an ingest.
    await reconstructDoor();
    await registryDoor();
    await notationDoor();
    await openSheetsStage();
    const { person, projectId } = await stagePerson("schedules");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    const plain = await stageScheduleIngest(person, projectId, SCENARIO.PLAIN, 81);
    const steps = await withFixtureRoot(tempFixtureRoot("schedules-empty"), async () => runSchedulePartition(person, plain, SCENARIO.PLAIN));
    const viewKey = await scheduleViewKey(person.tenantId, plain.ingestId);
    return { person, projectId, plain, steps, viewKey };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** The scope every door read is made in. */
function scopeOf(stage: Staged): { tenantId: string; projectId: string; drawingId: string } {
  return { tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId: stage.plain.drawing.drawingId };
}

/** A registry, in one order and without the keys it cites — the citation is graded on its own below. */
function shapeOf(families: readonly FamilyRow[]): unknown[] {
  return byKey(families, (family) => `${family.scheduleKey}|${family.family}`).map((family) => ({
    scheduleKey: family.scheduleKey,
    family: family.family,
    markText: family.markText,
    rowIndex: family.rowIndex,
    variants: byKey(family.variants ?? [], (variant) => variant.variantKey).map((variant) => ({
      variantKey: variant.variantKey,
      bandText: variant.bandText,
      bandFrom: variant.bandFrom,
      bandTo: variant.bandTo,
      sectionText: variant.sectionText,
      sectionWidth: variant.sectionWidth,
      sectionDepth: variant.sectionDepth,
      sectionUnit: variant.sectionUnit,
      zones: byKey(variant.zones ?? [], (zone) => zone.zone).map((zone) => ({
        zone: zone.zone,
        text: zone.text,
        bars: zone.bars,
        spacing: zone.spacing,
        spacingUnit: zone.spacingUnit,
        spacingBar: zone.spacingBar,
      })),
    })),
  }));
}

/** The registry this acceptance reads the staged artifact as owing. */
async function owedFamilies(stage: Staged): Promise<FamilyRow[]> {
  return expectedFamiliesOf(stage.plain.artifact, await notationDoor());
}

describe("AC-1: a schedule table is reconstructed without gridlines", () => {
  test("AC-1: the caption anchors one table whose columns, pitch and cells are the texts that were drawn", async () => {
    const stage = await staged();
    const built = stage.plain.artifact;
    const owed = expectedTableOf(built);
    expect(owed, "the staged artifact really draws a header band — with none there is no table for this case to be about").toBeTruthy();

    const { reconstructSchedules } = await reconstructDoor();
    const answer = reconstructSchedules(await evidenceOf(built));
    const scheduleViews = await viewKeysOfType(stage.person.tenantId, stage.plain.ingestId, SCHEDULE);
    expect(answer.views, `the reconstructor read the SCHEDULE views the partition really holds — and only those (VIEW_TYPE); it holds ${scheduleViews.join(", ")}`).toBe(scheduleViews.length);
    expect(answer.tables.length, `exactly one table stands for the one schedule view; the run answered ${answer.tables.length}`).toBe(1);
    expect(answer.deferrals, "a schedule that reconstructed defers nothing").toEqual([]);

    const table = answer.tables[0];
    expect(
      {
        viewKey: table?.viewKey,
        scheduleKey: table?.scheduleKey,
        title: table?.title,
        pitch: table?.pitch,
        columns: table?.columns,
        cells: byCell(table?.cells ?? []),
      },
      "the table is anchored on the caption's own source key, titled by what the caption says, pitched at the row spacing the bands were stacked at, columned by the header texts' insertion x in ascending order (riskNotes (1)), and its cells are the texts of the header band and of every data band beneath it, each citing the key of the text it was read from",
    ).toEqual({
      viewKey: stage.viewKey,
      scheduleKey: owed?.scheduleKey,
      title: owed?.title,
      pitch: owed?.pitch,
      columns: owed?.columns,
      cells: byCell(owed?.cells ?? []),
    });
  }, BUDGET_MS);

  test("AC-1: the leading note is no row of the table and the note beyond the stop is cited by no cell", async () => {
    const stage = await staged();
    const built = stage.plain.artifact;
    const aside = asideBandsOf(built);
    expect(
      aside.map((band) => band.role),
      "the staged artifact really draws a leading note above the header and a trailing note more than 3.5 pitches below the last band — with neither, this case would grade nothing (AC-1)",
    ).toEqual(["leading", "trailing"]);

    const { reconstructSchedules } = await reconstructDoor();
    const table = reconstructSchedules(await evidenceOf(built)).tables[0];
    const cited = new Set((table?.cells ?? []).flatMap((cell) => cell.sourceKeys));
    for (const band of aside) {
      expect(
        keysOf(band).filter((key) => cited.has(key)),
        `the ${band.role} band at y=${band.y} is no part of the table: the header is the first leading band holding a mark cell, and the row clustering stops at a gap over 3.5× the pitch`,
      ).toEqual([]);
    }

    const header = headerBandOf(built);
    const rows = [...new Set((table?.cells ?? []).map((cell) => cell.rowIndex))].sort((left, right) => left - right);
    expect(rows[0], "row 0 is the header band").toBe(0);
    expect(
      (table?.cells ?? []).filter((cell) => cell.rowIndex === 0).map((cell) => cell.text).sort(),
      "and what row 0 says is what the header band says",
    ).toEqual((header?.cells ?? []).map((cell) => cell.text).sort());
    expect(
      rows,
      `the rows are the header and the data bands, in descending y — the artifact draws ${dataBandsOf(built).length} data bands`,
    ).toEqual(Array.from({ length: dataBandsOf(built).length + 1 }, (_unused, index) => index));
  }, BUDGET_MS);

  test("AC-1: the stored schedule row and its cells are the table the stage reconstructed", async () => {
    const stage = await staged();
    const owed = expectedTableOf(stage.plain.artifact);
    const stored = scheduleRows(stage.person.tenantId, stage.plain.ingestId);
    expect(stored.length, "one `schedules` row stands for the one table the ingest's schedule view yielded").toBe(1);
    expect(stored[0], "carrying the view it was read off, the caption it is anchored on, what the caption says and the pitch its rows stand at").toEqual({
      viewKey: stage.viewKey,
      scheduleKey: owed?.scheduleKey,
      title: owed?.title,
      pitch: owed?.pitch,
    });
    expect(
      scheduleCellRows(stage.person.tenantId, stage.plain.ingestId, owed?.scheduleKey ?? ""),
      "and every cell of that table is a stored row, at its row and column, saying what was drawn and citing the keys it was read from",
    ).toEqual(byCell(owed?.cells ?? []));
  }, BUDGET_MS);
});

describe("AC-3: the schedules stage runs inside the rebuild, writes with the partition, and is read through the doors", () => {
  test("AC-3: the stage list names `schedules` once, immediately after `grid`", async () => {
    const rebuild = await rebuildDoor();
    const stages = [...rebuild.PARTITION_STAGES];
    expect(
      stages.filter((stage) => stage === SCHEDULES_STAGE).length,
      `the stage list names \`${SCHEDULES_STAGE}\` exactly once — a roster that repeats one would run it twice; the list reads: ${stages.join(" → ")}`,
    ).toBe(1);
    expect(stages.indexOf(GRID_STAGE), `and it still names \`${GRID_STAGE}\`; the list reads: ${stages.join(" → ")}`).toBeGreaterThanOrEqual(0);
    expect(
      stages.indexOf(SCHEDULES_STAGE),
      `and the schedules stage stands immediately after the grid backbone — it is the fourth stage of the same partition; the list reads: ${stages.join(" → ")}`,
    ).toBe(stages.indexOf(GRID_STAGE) + 1);
  }, BUDGET_MS);

  test("AC-3: the run records a `schedules` step saying what it examined, wrote and deferred, and no member count", async () => {
    const stage = await staged();
    const said = stage.steps.map((entry) => entry.step);
    const at = said.indexOf(SCHEDULES_STAGE);
    expect(at, `the run recorded a \`${SCHEDULES_STAGE}\` step — a stage with nothing behind it is not a visible stage (R-TO-030); the log reads: ${said.join(" → ")}`).toBeGreaterThanOrEqual(0);
    expect(at, `and it stands after the grid backbone; the log reads: ${said.join(" → ")}`).toBeGreaterThan(said.indexOf(GRID_STAGE));
    expect(at, `and before the step that says the partition was written; the log reads: ${said.join(" → ")}`).toBeLessThan(said.indexOf(STORED_STEP));

    const detail = stage.steps[at]?.detail ?? {};
    for (const key of ["views", "tables", "deferred"]) expect(typeof detail[key], `the step says \`${key}\` as a number`).toBe("number");
    // What the numbers SAY is what makes the step visible: a detail nobody could read off the run's
    // own result is a constant with a number's shape (R-TO-030).
    expect(detail["views"], "the step examined the SCHEDULE views the partition really holds").toBe((await viewKeysOfType(stage.person.tenantId, stage.plain.ingestId, SCHEDULE)).length);
    expect(detail["tables"], "and wrote the tables the store now holds").toBe(scheduleRows(stage.person.tenantId, stage.plain.ingestId).length);
    expect(detail["deferred"], "and the deferrals the store now holds").toBe(scheduleDeferralRows(stage.person.tenantId, stage.plain.ingestId).length);
    expect(
      countWordsAmong(Object.keys(detail)),
      "and it says nothing about how MANY members there are: a schedule says what a member IS, and the count is placement's answer off the layout plans (R-TO-031)",
    ).toEqual([]);
  }, BUDGET_MS);

  test("AC-3: a rebuild whose schedule write fails leaves the partition that stood before it", async () => {
    const stage = await staged();
    const before = {
      views: tableSnapshot(stage.person.tenantId, stage.plain.ingestId, "partition_views"),
      schedules: tableSnapshot(stage.person.tenantId, stage.plain.ingestId, SCHEDULES),
    };
    expect(before.views.length, "the first rebuild really wrote views — an empty partition would compare equal to anything").toBeGreaterThan(0);
    expect(before.schedules.length, "and really wrote a schedule").toBeGreaterThan(0);
    await scheduleStoreDoor();

    const failed = await withScheduleWriteBroken(async () => {
      try {
        await withFixtureRoot(tempFixtureRoot("schedules-broken"), async () => runSchedulePartition(stage.person, stage.plain, "schedules-broken"));
        return null;
      } catch (failure) {
        return failure;
      }
    });
    expect(failed, "a rebuild that cannot write its schedule rows fails — a partition half written is never quietly reported as a partition").not.toBeNull();

    expect(
      {
        views: tableSnapshot(stage.person.tenantId, stage.plain.ingestId, "partition_views"),
        schedules: tableSnapshot(stage.person.tenantId, stage.plain.ingestId, SCHEDULES),
      },
      "the six schedule tables are written in the SAME transaction as `partition_views`: a write that fails leaves the ingest's previously stored rows exactly as they stood, never a partition with no schedules or a schedule with no views (R-TO-030, L-REG-04)",
    ).toEqual(before);
  }, BUDGET_MS);

  test("AC-3: schedulesOf answers the drawing's stored schedules, cells and deferrals", async () => {
    const stage = await staged();
    const door = await schedulesDoor();
    const answered = await door.schedulesOf(scopeOf(stage));
    expect(answered, "the drawing's schedules are readable through the module's own door (R-TO-030: each stage's result is visible)").toBeTruthy();
    expect(answered?.ingestId, "for the ingest record that stands for the drawing now").toBe(stage.plain.ingestId);

    const stored = scheduleRows(stage.person.tenantId, stage.plain.ingestId);
    const answeredSchedules = (answered?.schedules ?? []) as Record<string, unknown>[];
    expect(
      byKey(answeredSchedules.map(scheduleOf), (row) => row.scheduleKey),
      "the door answers the schedules the store holds",
    ).toEqual(stored);
    for (const [index, schedule] of byKey(answeredSchedules, (row) => String(row["scheduleKey"] ?? row["schedule_key"] ?? "")).entries()) {
      const key = stored[index]?.scheduleKey ?? "";
      expect(byCell(((schedule["cells"] ?? []) as unknown[]).map(cellOf)), `with the cells of ${key} beneath it`).toEqual(scheduleCellRows(stage.person.tenantId, stage.plain.ingestId, key));
    }
    expect(((answered?.deferrals ?? []) as unknown[]).map(deferralOf), "and the deferrals the store holds beside them").toEqual(
      scheduleDeferralRows(stage.person.tenantId, stage.plain.ingestId),
    );
  }, BUDGET_MS);

  test("AC-3: memberTypesOf answers the drawing's stored registry", async () => {
    const stage = await staged();
    const door = await schedulesDoor();
    const answered = await door.memberTypesOf(scopeOf(stage));
    expect(answered, "the drawing's member types are readable through the module's own door — placement and the rails read them (R-TO-031)").toBeTruthy();
    expect(answered?.ingestId, "for the ingest record that stands for the drawing now").toBe(stage.plain.ingestId);
    expect(shapeOf((answered?.families ?? []) as FamilyRow[]), "the door answers the families, variants and zones the store holds").toEqual(
      shapeOf(memberTypeRows(stage.person.tenantId, stage.plain.ingestId)),
    );
    expect(
      countWordsAmong(keysAtEveryDepth(answered)),
      "and no object at any depth of that answer carries a member count: a schedule says what a member is, never how many stand (R-TO-031)",
    ).toEqual([]);
  }, BUDGET_MS);

  test("AC-3: both doors answer null for a drawing outside the scope, and before any partition stands", async () => {
    const stage = await staged();
    const door = await schedulesDoor();
    const scope = scopeOf(stage);

    const unpartitioned = await stageDrawing(stage.person, stage.projectId, BYTES, { name: unique("unpartitioned.dxf"), format: "dxf" });
    for (const [name, read] of [
      ["schedulesOf", door.schedulesOf],
      ["memberTypesOf", door.memberTypesOf],
    ] as const) {
      expect(await read({ ...scope, drawingId: unpartitioned.drawingId }), `${name} answers nothing for a drawing whose partition has never been rebuilt — an absence a caller can act on, not a refusal (R-UI-050)`).toBeNull();
      expect(await read({ ...scope, drawingId: randomUUID() }), `${name} answers nothing for a drawing this workspace does not hold`).toBeNull();
      expect(await read({ ...scope, projectId: randomUUID() }), `${name} answers nothing for a drawing outside the scope's project (R-SPINE-004)`).toBeNull();
      expect(await read({ ...scope, tenantId: randomUUID() }), `${name} answers nothing for a drawing outside the scope's workspace (SEAM-TENANT)`).toBeNull();
    }
  }, BUDGET_MS);

  test("AC-3: SCHEDULE_DEFERRAL_REASONS is the closed list the store's CHECK is the other half of", async () => {
    const home = await productModule<Record<string, unknown>>(SCHEDULE_DEFERRAL_REASONS_HOME);
    const reasons = home["SCHEDULE_DEFERRAL_REASONS"] as readonly string[] | undefined;
    expect(reasons, `${SCHEDULE_DEFERRAL_REASONS_HOME} publishes SCHEDULE_DEFERRAL_REASONS (test contract)`).toBeTruthy();
    expect(new Set(reasons ?? []), "and it holds exactly the two reasons a schedule view defers under, which is what the store's CHECK admits (AC-4, riskNotes (2))").toEqual(
      new Set([SCHEDULE_NONE_RECONSTRUCTED, SCHEDULE_VIEW_CONTRIBUTED_NOTHING]),
    );
  }, BUDGET_MS);
});

describe("AC-5: the tables fold into one row per mark family, with variants and rebar zones beneath", () => {
  test("AC-5: the stored registry is the families the artifact's mark cells name, and nothing else", async () => {
    const stage = await staged();
    const owed = await owedFamilies(stage);
    const notation = await notationDoor();
    const built = stage.plain.artifact;
    const markColumn = (headerBandOf(built)?.cells ?? []).find((cell) => notation.isMarkHeader(cell.text));
    expect(markColumn, "the staged artifact really draws a header holding a name or mark cell — the header is what a table's columns are taken from (AC-1)").toBeTruthy();
    const drawnMarks = dataBandsOf(built).map((band) => band.cells.find((cell) => cell.x === markColumn?.x)?.text ?? "");

    // Armed by the artifact: it really draws a mark cell that is NOISE and marks that need
    // normalising, or the reading below would agree with a registry that took every cell (AC-5).
    expect(drawnMarks.filter((text) => !notation.isMarkFamily(text)).length, `the staged artifact really draws a mark cell that names no member; it drew ${drawnMarks.join(", ")}`).toBeGreaterThan(0);
    expect(
      drawnMarks.filter((text) => notation.isMarkFamily(text) && notation.normaliseMark(text) !== text).length,
      `and one that is not already its own normalised form; it drew ${drawnMarks.join(", ")}`,
    ).toBeGreaterThan(0);

    const stored = memberTypeRows(stage.person.tenantId, stage.plain.ingestId);
    expect(
      stored.map((family) => family.family),
      `one row per mark family, the mark normalised — and no family for a note, a dash, the header cell or a bar cell (riskNotes (3)); the artifact drew ${drawnMarks.join(", ")}`,
    ).toEqual(owed.map((family) => family.family));
    expect(shapeOf(stored), "with the mark text verbatim, the row it was read from, one variant per floor band and the rebar zones beneath each of them").toEqual(shapeOf(owed));
  }, BUDGET_MS);

  test("AC-5: registerMemberTypes folds the reconstructed tables the same way", async () => {
    const stage = await staged();
    const { reconstructSchedules } = await reconstructDoor();
    const { registerMemberTypes } = await registryDoor();
    const registered = registerMemberTypes(reconstructSchedules(await evidenceOf(stage.plain.artifact)).tables);
    expect(shapeOf(registered.families), "the pure registry answers the families the store holds — the store keeps a derivation, never a second opinion").toEqual(
      shapeOf(await owedFamilies(stage)),
    );
    expect(registered.deferrals, "and a schedule that minted a family defers nothing").toEqual([]);
  }, BUDGET_MS);

  test("AC-5: a variant is a floor band with its own section, and beneath it the rebar zones of that row", async () => {
    const stage = await staged();
    const stored = memberTypeRows(stage.person.tenantId, stage.plain.ingestId);
    const familyOf = (name: string): FamilyRow | undefined => stored.find((family) => family.family === name);
    const variantOf = (name: string, key: string) => familyOf(name)?.variants.find((variant) => variant.variantKey === key);
    const zoneOf = (name: string, key: string, zone: string) => variantOf(name, key)?.zones.find((one) => one.zone === zone);

    const bands = [variantKeyOf("GF", "3RD"), variantKeyOf("4TH", "ROOF")];
    for (const family of stored) {
      expect(
        family.variants.map((variant) => variant.variantKey),
        `${family.family} carries one variant per floor-band column of the header, keyed by the band it reads (AC-5)`,
      ).toEqual(bands);
      for (const variant of family.variants) {
        expect(
          variant.zones.map((zone) => zone.zone),
          `and beneath ${family.family}/${variant.variantKey} the rebar zones its row's columns name`,
        ).toEqual([ZONE_MAIN, ZONE_TIES_END, ZONE_TIES_MID]);
      }
    }

    expect(
      { text: variantOf("C1", bands[0] ?? "")?.sectionText, width: variantOf("C1", bands[0] ?? "")?.sectionWidth, depth: variantOf("C1", bands[0] ?? "")?.sectionDepth, unit: variantOf("C1", bands[0] ?? "")?.sectionUnit },
      "C1's first band keeps the section verbatim and carries its parsed reading in inches",
    ).toEqual({ text: '12"x15"', width: 12, depth: 15, unit: "in" });
    expect(
      { text: variantOf("C3", bands[1] ?? "")?.sectionText, width: variantOf("C3", bands[1] ?? "")?.sectionWidth, depth: variantOf("C3", bands[1] ?? "")?.sectionDepth, unit: variantOf("C3", bands[1] ?? "")?.sectionUnit },
      "and a section the drawing wrote without a unit keeps the numbers and no unit at all — never an inch nobody said",
    ).toEqual({ text: "12X12", width: 12, depth: 12, unit: null });

    expect({ text: zoneOf("C1", bands[0] ?? "", ZONE_MAIN)?.text, bars: zoneOf("C1", bands[0] ?? "", ZONE_MAIN)?.bars }, "C1's main zone keeps the cell verbatim and reads the group it names").toEqual({
      text: "8-16Ø",
      bars: [{ n: 8, diameterMm: 16 }],
    });
    for (const [zone, spacing] of [
      [ZONE_TIES_END, 4],
      [ZONE_TIES_MID, 6],
    ] as const) {
      expect(
        { spacing: zoneOf("C1", bands[0] ?? "", zone)?.spacing, unit: zoneOf("C1", bands[0] ?? "", zone)?.spacingUnit, bar: zoneOf("C1", bands[0] ?? "", zone)?.spacingBar },
        `and its ${zone} zone reads the bar and the centres the cell states`,
      ).toEqual({ spacing, unit: "in", bar: 10 });
    }
  }, BUDGET_MS);

  test("AC-5: every registry row cites the cells it was read from, and the view defers nothing", async () => {
    const stage = await staged();
    const built = stage.plain.artifact;
    const owed = await owedFamilies(stage);
    const stored = memberTypeRows(stage.person.tenantId, stage.plain.ingestId);
    const header = headerBandOf(built);
    const dataBands = dataBandsOf(built);

    for (const family of stored) {
      const drawn = dataBands[family.rowIndex - 1];
      const mine = owed.find((one) => one.family === family.family);
      const rowKeys = new Set([...(drawn === undefined ? [] : keysOf(drawn)), ...(header === null ? [] : keysOf(header))]);
      expect(family.sourceKeys.length, `${family.family} cites the cell it was read from`).toBeGreaterThan(0);
      expect(
        (mine?.sourceKeys ?? []).filter((key) => !family.sourceKeys.includes(key)),
        `${family.family} cites the mark cell it was minted from, and its row_index names the table row that cell stands in`,
      ).toEqual([]);
      expect(family.sourceKeys.filter((key) => !rowKeys.has(key)), `and cites nothing outside its own row and the header over it`).toEqual([]);

      for (const variant of family.variants) {
        const owedVariant = (mine?.variants ?? []).find((one) => one.variantKey === variant.variantKey);
        expect((owedVariant?.sourceKeys ?? []).filter((key) => !variant.sourceKeys.includes(key)), `${family.family}/${variant.variantKey} cites the section cell it was read from`).toEqual([]);
        expect(variant.sourceKeys.filter((key) => !rowKeys.has(key)), `and nothing outside its own row and the header over it`).toEqual([]);
        for (const zone of variant.zones) {
          const owedZone = (owedVariant?.zones ?? []).find((one) => one.zone === zone.zone);
          expect((owedZone?.sourceKeys ?? []).filter((key) => !zone.sourceKeys.includes(key)), `${family.family}/${variant.variantKey}/${zone.zone} cites the zone cell it was read from`).toEqual([]);
          expect(zone.sourceKeys.filter((key) => !rowKeys.has(key)), `and nothing outside its own row and the header over it`).toEqual([]);
        }
      }
    }

    expect(scheduleDeferralRows(stage.person.tenantId, stage.plain.ingestId), "a schedule view whose table minted a family defers nothing (AC-7)").toEqual([]);
  }, BUDGET_MS);
});
