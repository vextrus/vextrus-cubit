/**
 * AC-1 and the server half of AC-3 — the sheet index of a project (R-TO-004, R-TO-001, L-ACT-02).
 *
 * The corpus is carried through the shipped extractor once and every expectation below is derived
 * from what it answered: the sheets from the record's own `facts.layouts`, the fidelity facts from
 * its own counters, the proposed numbers from the title-block text of the artifact itself, and the
 * sheet names from `fixtures/rcc6/manifest.json` — the declared fixture identity, imported rather
 * than retyped (B-19). Nothing here freezes a layout count, a sheet roster or a discipline list.
 *
 * Staged lazily and memoised: a throwing hook leaves every case skipped, and a skipped case judges
 * no criterion at all.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  CORE_SHEETS_MODULE,
  PRINCIPAL,
  RCC6_FORMAT,
  SHEETS_MODULE,
  addressOf,
  byCodePoint,
  closeStage,
  countersFor,
  drawingUnitOf,
  entityKeysOf,
  factReportsSomething,
  grantRole,
  layoutBearing,
  manifestSheetNames,
  openSheetsStage,
  productModule,
  rastersOf,
  renderRasters,
  reportsSomething,
  sheetNumberOnSheet,
  stagePerson,
  stageProject,
  stageSheets,
  storageOf,
  straysOn,
  type ArtifactGraph,
  type CoreSheetsSeam,
  type IngestRecord,
  type Person,
  type SheetCard,
  type SheetsSeam,
  type StagedDrawing,
} from "../support/sheets-stage";

/** How long a staged case may take: one real `uv run` cold, a raster pass and the reads after it. */
const BUDGET_MS = 900_000;

interface Staged {
  sheets: SheetsSeam;
  core: CoreSheetsSeam;
  person: Person;
  projectId: string;
  emptyProjectId: string;
  drawing: StagedDrawing;
  record: IngestRecord;
  graph: ArtifactGraph;
  cards: SheetCard[];
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const sheets = await productModule<SheetsSeam>(SHEETS_MODULE);
    const core = await productModule<CoreSheetsSeam>(CORE_SHEETS_MODULE);

    await openSheetsStage();
    const { person, projectId } = await stagePerson("index");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    const emptyProjectId = stageProject(person.tenantId, "Sheets with no drawings");

    const { drawing, record, graph } = await stageSheets(person, projectId);
    await renderRasters(person, drawing, record);

    const cards = await sheets.sheetIndexOf({ tenantId: person.tenantId, projectId });
    return { sheets, core, person, projectId, emptyProjectId, drawing, record, graph, cards };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** The card of one sheet, refused by name when the index does not carry it. */
function cardFor(cards: readonly SheetCard[], layoutName: string): SheetCard {
  const found = cards.find((card) => card.layoutName === layoutName);
  expect(found, `the index carries a card for the sheet \`${layoutName}\` the record's layout inventory names`).toBeTruthy();
  return found as SheetCard;
}

describe("AC-1: one card per sheet of the current record", () => {
  test("AC-1: sheetIndexOf answers exactly one card per layout the record inventoried, keyed by sheetIdOf", async () => {
    const stage = await staged();
    const layouts = stage.record.facts.layouts.map((layout) => layout.name);
    expect(layouts.length, "the staged record inventoried the sheets its drawing carries — with none there is nothing to judge").toBeGreaterThan(0);

    expect(byCodePoint(stage.cards.map((card) => card.layoutName)), "one card per entry of the current record's facts.layouts — no sheet invented and none dropped (R-TO-004)").toEqual(byCodePoint(layouts));
    for (const card of stage.cards) {
      expect(card.sheetId, `the card for ${card.layoutName} is identified by sheetIdOf(ingestId, layoutName)`).toBe(stage.core.sheetIdOf(stage.record.ingestId, card.layoutName));
      expect(stage.core.parseSheetId(card.sheetId), "parseSheetId reads back exactly what sheetIdOf composed").toStrictEqual({ ingestId: stage.record.ingestId, layoutName: card.layoutName });
      expect({ drawingId: card.drawingId, ingestId: card.ingestId }, `the card for ${card.layoutName} names the drawing and the record it is a reading of`).toStrictEqual({
        drawingId: stage.drawing.drawingId,
        ingestId: stage.record.ingestId,
      });
      expect(card.kind, `the card for ${card.layoutName} carries the layout kind the artifact states`).toBe(stage.graph.layouts.find((layout) => layout.name === card.layoutName)?.kind);
    }
  }, BUDGET_MS);

  test("AC-1: each card carries its stored format, its extractor's scheme, the thumb tier and a derived scale state", async () => {
    const stage = await staged();
    const storage = await storageOf();
    const rasters = await rastersOf(stage.person, stage.drawing.drawingId);
    const unit = drawingUnitOf(stage.graph);

    for (const card of stage.cards) {
      expect(card.format, `the card for ${card.layoutName} carries the format the drawing is stored under`).toBe(RCC6_FORMAT);
      expect(card.scheme, `the card for ${card.layoutName} carries the scheme the record's own extractor identity states (R-TO-001)`).toBe(stage.record.extractor.scheme);
      expect(card.viewCount, "views are not classified by this increment, and a count nobody derived is never invented (L-CAD-06 is M2's)").toBeNull();

      const layout = stage.graph.layouts.find((entry) => entry.name === card.layoutName);
      const placeable = layout !== undefined && layout.bbox !== null && layout.bbox !== undefined && unit !== null;
      expect(stage.core.SCALE_STATES, `the scale state of ${card.layoutName} is drawn from SCALE_STATES`).toContain(card.scaleState);
      expect(card.scaleState, `a sheet with ${placeable ? "an extent and a drawing unit stands unaffirmed" : "no extent or no drawing unit is unplaceable"} (R-TO-004)`).toBe(placeable ? "unaffirmed" : "unplaceable");

      const served = rasters.find((sheet) => sheet.layoutName === card.layoutName);
      const thumb = served?.tiers["thumb"];
      if (thumb === undefined) {
        expect(card.thumbnail, `no thumb tier was rendered for ${card.layoutName}, so its card carries no thumbnail`).toBeNull();
        continue;
      }
      expect(card.thumbnail, `the card for ${card.layoutName} carries the raster seam's thumb tier`).not.toBeNull();
      const thumbnail = card.thumbnail as { url: string; width: number; height: number };
      expect({ width: thumbnail.width, height: thumbnail.height }, `the thumbnail of ${card.layoutName} is the size the thumb tier was rendered at`).toStrictEqual({ width: thumb.width, height: thumb.height });
      expect(addressOf(thumbnail.url), `the thumbnail of ${card.layoutName} addresses the same stored object the thumb tier does`).toBe(addressOf(thumb.url));
      const vouched = storage.verify(thumbnail.url);
      expect(vouched, `the thumbnail URL of ${card.layoutName} is one SEAM-STORAGE vouches for, at the thumb tier's own address`).toStrictEqual({ ok: true, tenantId: stage.person.tenantId, sha256: thumb.sha256 });
    }
  }, BUDGET_MS);

  test("AC-1: every card carries every fidelity fact the roster names, agreeing with the record's own counters", async () => {
    const stage = await staged();
    expect(stage.core.FIDELITY_FACTS.length, "FIDELITY_FACTS names the facts R-TO-001 shows on a card").toBeGreaterThan(0);

    for (const card of stage.cards) {
      expect(byCodePoint(Object.keys(card.facts)), `the card for ${card.layoutName} carries exactly the roster FIDELITY_FACTS names — a fact suppressed is a fact nobody can miss`).toEqual(byCodePoint([...stage.core.FIDELITY_FACTS]));
      for (const [name, value] of Object.entries(card.facts)) {
        expect(["number", "boolean"], `${name} on ${card.layoutName} is reported as a number or a flag`).toContain(typeof value);
      }

      const counters = countersFor(stage.record, card.layoutName);
      expect(card.facts["strays_rejected"], `strays_rejected on ${card.layoutName} is the count the record's own layout row states (R-TO-001)`).toBe(straysOn(stage.record, card.layoutName));
      expect(factReportsSomething(card.facts["explode_truncated"] ?? false), `explode_truncated on ${card.layoutName} agrees with the record's counter for that space`).toBe(reportsSomething(counters.explode_truncated));
      expect(factReportsSomething(card.facts["explode_losses"] ?? false), `explode_losses on ${card.layoutName} agrees with the record's counter for that space`).toBe(reportsSomething(counters.explode_losses));
      expect(factReportsSomething(card.facts["flatten_capped"] ?? false), `flatten_capped on ${card.layoutName} agrees with the record's counter for that space`).toBe(reportsSomething(counters.flatten_capped));
      expect(factReportsSomething(card.facts["dropped_layouts"] ?? false), `dropped_layouts on ${card.layoutName} agrees with the layouts the record says it dropped`).toBe(reportsSomething(stage.record.facts.dropped_layouts));
    }
  }, BUDGET_MS);

  test("AC-1: the title-block grammar proposes each manifest sheet's title, number and discipline with cited keys", async () => {
    const stage = await staged();
    const keys = entityKeysOf(stage.graph);

    for (const name of manifestSheetNames()) {
      const layout = layoutBearing(stage.graph, name);
      expect(layout, `the corpus puts the sheet named "${name}" on a layout of its own — the manifest declares it`).not.toBeNull();
      const card = cardFor(stage.cards, (layout as { name: string }).name);

      expect(card.proposal.title, `the grammar proposes "${name}" as the title of its own sheet (R-TO-004: the title block, read deterministically)`).toBe(name);
      expect(card.proposal.number, `the proposed number of "${name}" is the n of its own title block's SHEET n OF m line`).toBe(sheetNumberOnSheet(stage.graph, card.layoutName));
      expect(card.proposal.discipline, `"${name}" is proposed STRUCTURAL — its title entity stands on a structural layer (L-REG-03: machine-proposed, human-confirmed)`).toBe("STRUCTURAL");
      expect(stage.core.DISCIPLINES, "a proposed discipline is drawn from the closed enum").toContain(card.proposal.discipline);
      expect(card.proposal.basis, `"${name}" was read by the grammar, so its basis is GRAMMAR (L-AI-03: a deterministic grammar where the text is vector)`).toBe("GRAMMAR");
      expect(stage.core.PROPOSAL_BASES, "a proposal basis is drawn from the closed enum").toContain(card.proposal.basis);

      expect(card.proposal.cited.length, `the proposal for "${name}" cites the entities it was read from (R-TO-004, L-AI-03)`).toBeGreaterThan(0);
      for (const cited of card.proposal.cited) {
        expect(keys.has(cited), `the cited key ${cited} is one the record's own artifact carries — evidence names something`).toBe(true);
      }
      expect(card.confirmed, `"${name}" is proposed and not yet confirmed, so it carries no confirmation (L-REG-03 fails closed)`).toBeNull();
    }
  }, BUDGET_MS);

  test("AC-1: a project holding no drawings answers an empty index", async () => {
    const stage = await staged();
    expect(await stage.sheets.sheetIndexOf({ tenantId: stage.person.tenantId, projectId: stage.emptyProjectId }), "a project with no drawings has no sheets — an empty answer, never a refusal").toEqual([]);
  }, BUDGET_MS);
});

describe("AC-3: the groups the machine offers are derived from current state", () => {
  test("AC-3: offeredGroupsOf answers one PROPOSED_DISCIPLINE group per drawing and proposed discipline, with resolved membership", async () => {
    const stage = await staged();
    const groups = await stage.sheets.offeredGroupsOf({ tenantId: stage.person.tenantId, projectId: stage.projectId });

    const unconfirmed = stage.cards.filter((card) => card.confirmed === null);
    const expected = new Set(unconfirmed.map((card) => `${card.drawingId} ${card.proposal.discipline}`));
    const proposed = groups.filter((group) => group.key.kind === "PROPOSED_DISCIPLINE");
    expect(byCodePoint(proposed.map((group) => `${String(group.key.drawingId)} ${group.key.discipline}`)), "one group per (drawing, proposed discipline) that still holds an unconfirmed sheet — derived from current state, never stored").toEqual(byCodePoint([...expected]));

    const bySheetId = new Map(stage.cards.map((card) => [card.sheetId, card]));
    for (const group of groups) {
      expect(group.members.length, `the group ${JSON.stringify(group.key)} is offered, so it has members — a group of nobody is not offered (L-ACT-02)`).toBeGreaterThan(0);
      expect(typeof group.label, "a group is named, because R-UI-023 offers named groups").toBe("string");
      expect(group.label.length, "a group's name is not empty").toBeGreaterThan(0);
      for (const member of group.members) {
        const card = bySheetId.get(member);
        expect(card, `the member ${member} of ${JSON.stringify(group.key)} is a sheet the index carries`).toBeTruthy();
        expect((card as SheetCard).confirmed, `the member ${member} is unconfirmed — a confirmed sheet leaves every group`).toBeNull();
        if (group.key.kind === "PROPOSED_DISCIPLINE") {
          expect({ drawingId: (card as SheetCard).drawingId, discipline: (card as SheetCard).proposal.discipline }, `the member ${member} is one the group's own key describes (the typed grouping key over the fact judged)`).toStrictEqual({
            drawingId: group.key.drawingId,
            discipline: group.key.discipline,
          });
        }
      }
      expect(new Set(group.members).size, "a group names each member once").toBe(group.members.length);
    }
  }, BUDGET_MS);
});
