/**
 * J-032 — the schedules and notes workspace: a reconstructed schedule stands beside the sheet it was
 * read from with every cell a trace, the member types it named are listed verbatim, and a person
 * transcribes the sheet's general notes — some as proposed, one edited — while a reading somebody
 * else already made disagrees and suspends the figure (R-TO-034, L-CAD-08, R-UI-022, R-UI-050,
 * AM-03(h), docs/design/s-schedules.md).
 *
 * The journey walks the product as a person does: from the takeoff lane's fourth tab, onto the sheet
 * rail, into the reconstructed table and the registry beneath it; then onto the notes sheet, through
 * the one act door and its consequence dialog, and back to the answer — the readings that were kept,
 * the verdict each was given, and the one standing that nobody can settle by pressing again.
 *
 * The two design checkpoints are taken here and nowhere else; the picture itself is the gate's to
 * re-take (v16.2 §1).
 */
import { expect, test, type Locator } from "@playwright/test";
import { SSchedulesPage } from "./pages/s-schedules.page";
import { STakeoffPage } from "./pages/s-takeoff.page";
import { copySentences, stageBareProject, stageSchedules } from "./takeoff/schedules-stage";
import { checkpoint } from "./support/checkpoint";
import { emulateTheme, restoreLaneTheme } from "./support/lane-theme";
import { everyAttribute, everyRow, heldAttribute, readWhen, steadyCount } from "./support/retrying-read";
import { signInAsSeededTenant } from "./support/seeded-session";
import { settled } from "./support/settled";

/** The width the frame paints the rail, the work column and the inspector side by side at (R-UI-030). */
test.use({ viewport: { width: 1440, height: 900 } });

/** The five kinds the sheet's notes propose, in the law's own order (R-TO-034). */
const FY = "FY";
const FC = "FC";
const LAP = "LAP";
const HOOK = "HOOK";
const HOOK_MIN = "HOOK_MIN";
const KINDS: readonly string[] = [FY, FC, LAP, HOOK, HOOK_MIN];

/** What the walk reads the minimum hook as, against the 75 mm the sheet states. */
const EDITED_HOOK_MIN = "100";

/** The verdicts, the standings, the basis and the code this walk reads by name (test contract). */
const ACCEPTED = "ACCEPTED";
const EDITED = "EDITED";
const AGREED = "AGREED";
const SUSPENDED = "SUSPENDED";
const TRANSCRIBED = "TRANSCRIBED";
const NOTE_READING_CONTESTED = "NOTE_READING_CONTESTED";

/** The word the tab and the crumb say (docs/design/s-schedules.md §3). */
const SCHEDULES = "Schedules";

/** The state a screen is in when something on it is refused and everything else reads on (R-UI-050). */
const PARTIAL = "partial";

/** What a sheet whose texts state no figure says in the notes panel's place (Decision §1, AC-7). */
const NOTES_NONE_PROPOSED = "NOTES_NONE_PROPOSED";

/**
 * The address a trace opens, spelled as the test contract spells it: the viewer at that sheet, the
 * cited entities in `s`, and no `line` param. The acceptance spells it so the screen cannot be
 * graded against its own composition of it.
 */
function selectionAddress(tenantId: string, projectId: string, drawingId: string, layoutName: string, sourceKeys: readonly string[]): string {
  return `/t/${tenantId}/p/${projectId}/viewer/${drawingId}/${encodeURIComponent(layoutName)}?s=${sourceKeys.map((key) => encodeURIComponent(key)).join(",")}`;
}

/** How many of the stored rows say exactly this — the multiplicity the screen owes, never a guess. */
function howMany<T>(rows: readonly T[], alike: (one: T) => boolean): number {
  return rows.filter(alike).length;
}

/**
 * The words a piece of text says: its runs of letters and digits, with the punctuation, the rules and
 * the basis glyphs between them dropped. Both sides of a vocabulary reading are cut this way, so
 * `12"x15"` and `10Ø @ 4" c/c` compare as the schedule wrote them and a `3` the screen reckoned for
 * itself compares as the word it is.
 */
function words(said: string): string[] {
  return said
    .toLowerCase()
    .split(/[^a-z0-9À-˿Ͱ-῿Ⰰ-퟿]+/)
    .filter((word) => word.length > 0);
}

/** Every run of digits a piece of text holds: `1'-0"x1'-3"` holds 1, 0, 1 and 3, and `×2` holds 2. */
function figures(said: string): string[] {
  return said.match(/[0-9]+/g) ?? [];
}

/** Whitespace as a browser lays it out is not a difference in what was said. */
function oneLine(said: string): string {
  return said.replace(/\s+/g, " ").trim();
}

/**
 * What is left of a piece of text once every string the store holds for it has been taken out of it,
 * longest first. A figure surviving this is a figure that stands OUTSIDE everything the drawing
 * wrote there — which is to say, one the screen reckoned for itself.
 */
function residue(said: string, held: readonly string[]): string {
  return [...held]
    .map((one) => oneLine(one))
    .filter((one) => one.length > 0)
    .sort((left, right) => right.length - left.length)
    .reduce((rest, one) => rest.split(one).join(" "), oneLine(said));
}

/** Two spellings of one mark: the same letters and digits, however the schedule punctuated them (I-251). */
function sameMark(said: string, mark: string): boolean {
  return words(said).join("") === words(mark).join("");
}

/**
 * What a region of the registry says IN ITS OWN RIGHT — its rendered text, less the text of every
 * registry row nested inside it (the page object's own selector).
 *
 * The per-row reading is the whole point: a vocabulary taken over the WHOLE pane admits `C-1 ×1`,
 * because the `1` of the mark beside it is already a word of the pane. Read row by row, the badge
 * has only its own row's stored strings to answer to.
 *
 * Two agreeing readings inside one poll, as every other answering read here is taken (AM-09 §4).
 */
async function ownSaid(region: Locator, nested: string, what: string): Promise<string> {
  const seen: string[] = [];
  const agreed = await readWhen(
    async () => {
      seen.push(
        await region.evaluate((node: Element, selector: string) => {
          const clone = node.cloneNode(true) as Element;
          for (const inside of Array.from(clone.querySelectorAll(selector))) inside.remove();
          return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
        }, nested),
      );
      return seen.slice(-2);
    },
    (last) => last.length === 2 && last[0] === last[1],
    `${what}: two readings of what it says in its own right agreed`,
  );
  return agreed[1] as string;
}

test.describe("J-032 — schedules, the member-type registry and sheet notes", () => {
  test("J-032: the reconstructed schedule stands beside its sheet, every cell a trace, the registry verbatim", async ({ page }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    const staged = await stageSchedules(page, { label: "j032-tables" });
    const schedules = new SSchedulesPage(page);
    const takeoff = new STakeoffPage(page);

    /* --- the fourth tab of the lane, beside the three that stood there (AC-7) --- */
    await takeoff.open(staged.tenantId, staged.projectId);
    await expect(schedules.navRegister, "the register tab stands where it stood").toBeVisible();
    await expect(schedules.navSchedules, "and the schedules tab this increment adds, fourth").toBeVisible();
    await schedules.openThroughNav();
    await settled(page);
    await expect(schedules.navSchedules, "the tab for the address in the browser says so").toHaveAttribute("aria-current", "page");
    await expect(schedules.crumbPage, "and the crumb names the screen a reader is on").toHaveText(SCHEDULES);
    await expect(schedules.inspector, "nothing is selected, so no inspector stands at all (R-UI-080)").toHaveCount(0);

    /* --- the rail: one row per sheet the pinned revision holds something to read on (AC-7) --- */
    const scheduleSheet = schedules.sheetRow(staged.drawingId, staged.scheduleLayout);
    const notesSheet = schedules.sheetRow(staged.drawingId, staged.notesLayout);
    await expect(scheduleSheet, "the sheet the schedules were reconstructed from stands in the rail").toHaveCount(1);
    await expect(notesSheet, "and the sheet whose notes can be read").toHaveCount(1);
    await expect(
      schedules.sheetRow(staged.drawingId, staged.barrenLayout),
      `the drawing's third sheet holds no schedule, no deferral and no text, so it is not a row at all (I-248): ${staged.barrenLayout}`,
    ).toHaveCount(0);
    await expect(schedules.sheetRows, "the rail is the sheets that hold something — never the revision's list of layouts").toHaveCount(staged.sheetsHolding.length);
    expect(
      await everyAttribute(schedules.sheetRows, "data-layout", "the sheets the rail lists"),
      `every row the rail drew is a sheet the store gives this screen something to show: ${JSON.stringify(staged.sheetsHolding)}`,
    ).toEqual(expect.arrayContaining(staged.sheetsHolding));

    /* --- the table, exactly as it was stored, with every cell an EvidenceLink (AC-7) --- */
    await scheduleSheet.click();
    await settled(page);
    const table = schedules.table(staged.scheduleKey);
    await expect(table, "the stored schedule renders under the key it was stored as").toHaveCount(1);

    // A row of the grid is a row of DATA. The band the schedule's columns were taken from is the grid's
    // own header — sticky, named, above everything — so the rows the table says it drew are the stored
    // bands BENEATH it, and never the stored band count (Decision §1, I-250). A screen that fed the
    // header band through as a body row would read one too many here.
    expect(await schedules.rowsRendered(table), `and states the rows it drew — the stored bands below the header, never a re-reckoning: ${JSON.stringify(staged.dataRows)}`).toBe(
      String(staged.dataRows.length),
    );
    await expect(schedules.bodyRows(table), "one row of the grid per stored band of data").toHaveCount(staged.dataRows.length);

    const header = schedules.tableHeader(table);
    await expect(header, "and the grid names its columns in a header region of its own (DataTable v2, Decision §1)").toHaveCount(1);
    await expect(schedules.bodyRows(header), "which is no row of the body: a header is not data (R-UI-082)").toHaveCount(0);
    for (const said of staged.headerTexts) {
      await expect(
        header.getByText(said, { exact: true }).first(),
        `the column the schedule headed ${said} is named where a reader looks for a column's name, verbatim`,
      ).toBeVisible();
    }

    const cells = schedules.cells(table);
    const drawn = await steadyCount(cells, "the cells of the reconstructed table");
    expect(drawn, "a reconstructed table renders the cells it stored").toBeGreaterThan(0);

    // Every stored cell, where it was stored, saying what it says and citing what IT cites. The header
    // band is the grid's own header — asserted as one above — so it is no cell of the body.
    for (const stored of staged.cells.filter((one) => one.rowIndex > staged.headerRow && one.text.length > 0)) {
      const where = `row ${stored.rowIndex}, column ${stored.columnIndex}`;
      const at = schedules.cell(table, stored.rowIndex, stored.columnIndex);
      await expect(at, `the cell stored at ${where} stands where it was stored`).toHaveCount(1);
      const link = schedules.evidence(at);
      await expect(link, "every cell that came from a drawing carries exactly one trace (R-UI-022, I-252)").toHaveCount(1);
      // Verbatim is the whole assertion: the accessible name of the trace is the cell's stored text
      // and nothing else — no count, no arrow, no word of the screen's own beside it (I-252).
      await expect(link, `labelled with what the drawing says at ${where}, verbatim and only that (Decision §1, Cells)`).toHaveAccessibleName(stored.text);
      await expect(link, "and says it was read off the drawing's own text (L-QTY-01)").toHaveAttribute("data-basis", TRANSCRIBED);
      await expect(link, `which opens the sheet at the entities THIS cell cites, never the ones beside it: ${JSON.stringify(stored.sourceKeys)}`).toHaveAttribute(
        "href",
        selectionAddress(staged.tenantId, staged.projectId, staged.drawingId, staged.scheduleLayout, stored.sourceKeys),
      );
    }

    // And nothing is drawn that the store does not hold: every rendered cell answers to a stored one,
    // and carries that stored cell's own trace — the header band's cells too, wherever they stand.
    const holds = staged.cells.map((one) => ({ at: `${one.rowIndex}:${one.columnIndex}`, cell: one }));
    for (let at = 0; at < drawn; at += 1) {
      const one = cells.nth(at);
      const stands = `${String(await heldAttribute(one, "data-row"))}:${String(await heldAttribute(one, "data-column"))}`;
      expect(
        holds.map((held) => held.at),
        `the cell the screen drew at ${stands} is one the store holds`,
      ).toContain(stands);
      const stored = (holds.find((held) => held.at === stands) as (typeof holds)[number]).cell;
      if (stored.text.length === 0) continue;
      const link = schedules.evidence(one);
      await expect(link, `the cell drawn at ${stands} carries exactly one trace, wherever on the grid it stands (I-252)`).toHaveCount(1);
      await expect(link, `labelled with what the drawing says at ${stands}, verbatim: ${stored.text}`).toHaveAccessibleName(stored.text);
      await expect(link, `and opening the sheet at the entities that cell cites: ${JSON.stringify(stored.sourceKeys)}`).toHaveAttribute(
        "href",
        selectionAddress(staged.tenantId, staged.projectId, staged.drawingId, staged.scheduleLayout, stored.sourceKeys),
      );
    }

    /* --- the member-type registry: what the schedule said a member IS, and never how many (AC-7) --- */
    await expect(schedules.registry, "the registry stands beneath the table it was read from").toBeVisible();
    for (const family of staged.families) {
      const row = schedules.family(family);
      await expect(row, `the mark family ${family} the schedule named`).toHaveCount(1);
      const link = schedules.evidence(row).first();
      await expect(link, `whose mark is the trace back to the entities that named it: ${family}`).toHaveAccessibleName(family);
    }
    await expect(schedules.families, "one row per stored family, and no family nobody named").toHaveCount(staged.families.length);

    for (const variant of staged.variants) {
      const row = schedules.variantSaying(variant.variantKey, [variant.bandText, variant.sectionText]);
      await expect(
        row,
        `the ${variant.family} band ${variant.variantKey} says its storeys and its section verbatim (I-251)`,
      ).toHaveCount(howMany(staged.variants, (one) => one.variantKey === variant.variantKey && one.bandText === variant.bandText && one.sectionText === variant.sectionText));
      for (const said of [variant.bandText, variant.sectionText]) {
        await expect(
          row.first().getByText(said, { exact: true }).first(),
          `and says it as the schedule wrote it, whole — never as the stem of a sentence the screen composed: ${said}`,
        ).toBeVisible();
      }
    }
    await expect(schedules.variants, "one row per stored variant, and no band nobody drew").toHaveCount(staged.variants.length);

    for (const zone of staged.zones) {
      const row = schedules.zoneSaying(zone.zone, zone.text);
      await expect(
        row,
        `the ${zone.zone} rebar of ${zone.family} ${zone.variantKey} says what the schedule said: ${zone.text}`,
      ).toHaveCount(howMany(staged.zones, (one) => one.zone === zone.zone && one.text === zone.text));
      await expect(row.first().getByText(zone.text, { exact: true }).first(), `verbatim, and never a reading of it: ${zone.text}`).toBeVisible();
    }
    await expect(schedules.zones, "one row per stored rebar zone, and never a count of bars (I-251)").toHaveCount(staged.zones.length);

    // And no row of it says a figure the schedule did not write THERE. This is read row by row and
    // never over the pane: a count beside a mark — `C-1 ×1` — is admitted by any vocabulary taken
    // over the whole registry, because the marks and the sections already put small integers in it.
    // Each row answers for ITSELF: the words it says in its own right are the words of the strings
    // the store holds for that row, or the screen's own copy; and every figure standing in it stands
    // INSIDE one of those stored strings. L-CAD-08 lets a schedule state how many members exist only
    // where a column of that schedule states it, and then it is that cell's own text (I-251).
    const rowSelector = schedules.registryRowSelector;
    const copy = new Set((await copySentences()).flatMap((sentence) => words(sentence)));
    const saysOnly = async (row: Locator, what: string, stored: readonly string[]): Promise<void> => {
      const said = await ownSaid(row, rowSelector, what);
      const spoken = new Set(stored.flatMap((one) => words(one)));
      expect(
        words(said).filter((word) => !spoken.has(word) && !copy.has(word)),
        `${what} says what the schedule wrote for IT, or what this screen's copy states, and nothing else: "${said}" against ${JSON.stringify(stored)}`,
      ).toEqual([]);
      expect(
        figures(residue(said, stored)),
        `and every figure standing in ${what} is one the drawing wrote there — a member count is the screen's own reckoning, which this registry never renders (R-TO-034): "${said}"`,
      ).toEqual([]);
    };

    for (const family of staged.families) {
      // A family may be shown under the mark it is filed by AND under the cell's own spelling of it
      // where the two differ (I-251) — the same letters and digits, punctuated as the drawing did.
      const spellings = [family, ...staged.cells.map((one) => one.text).filter((text) => sameMark(text, family))];
      await saysOnly(schedules.family(family), `the ${family} family row`, spellings);
    }
    for (const variant of staged.variants) {
      for (const row of await everyRow(schedules.variantSaying(variant.variantKey, [variant.bandText, variant.sectionText]), `the ${variant.variantKey} variant rows`)) {
        await saysOnly(row, `the ${variant.family} ${variant.variantKey} variant row`, [variant.bandText, variant.sectionText]);
      }
    }
    for (const zone of staged.zones) {
      for (const row of await everyRow(schedules.zoneSaying(zone.zone, zone.text), `the ${zone.zone} rows saying ${zone.text}`)) {
        await saysOnly(row, `the ${zone.family} ${zone.variantKey} ${zone.zone} zone row`, [zone.text, zone.zone]);
      }
    }

    // And the pane around those rows says only its own copy and what the schedule said — with no
    // figure of its own at all, so a heading that counts the families it holds is caught where it
    // would stand rather than inside the rows it stands above.
    const paneSaid = await ownSaid(schedules.registry, rowSelector, "the member-type registry");
    const held = [
      ...staged.families,
      ...staged.variants.flatMap((one) => [one.family, one.variantKey, one.bandText, one.sectionText]),
      ...staged.zones.flatMap((one) => [one.family, one.variantKey, one.zone, one.text]),
      ...staged.cells.map((one) => one.text),
    ];
    const vocabulary = new Set(held.flatMap((one) => words(one)));
    expect(
      words(paneSaid).filter((word) => !vocabulary.has(word) && !copy.has(word)),
      `the registry says only what the schedule said and what this screen's copy states: "${paneSaid}"`,
    ).toEqual([]);
    expect(
      figures(residue(paneSaid, held)),
      `and reckons no figure of its own beside the rows it holds: "${paneSaid}"`,
    ).toEqual([]);

    /* --- the notes panel of a sheet whose texts state no figure: never silent (AC-7, Decision §1) --- */
    await expect(schedules.notes, "the notes panel stands on this sheet too — silence is not a state").toHaveCount(1);
    const silent = schedules.refusals(schedules.notes);
    await expect(silent, "a sheet whose texts propose nothing says so through exactly one RefusalState (R-UI-020)").toHaveCount(1);
    await expect(silent, "under the registered code for it").toHaveAttribute("data-code", NOTES_NONE_PROPOSED);
    await expect(schedules.transcribe, "and offers no act door at all: there is nothing to transcribe (Decision §1)").toHaveCount(0);

    /* --- the view that could not be reconstructed: stated where it belongs, never silently (AC-7) --- */
    const deferral = schedules.deferrals.first();
    await expect(deferral, "a schedule view that yielded no table says so on the sheet it stood on").toBeVisible();
    await expect(schedules.refusals(deferral), "through exactly one RefusalState (R-UI-020)").toHaveCount(1);
    await expect(schedules.refusalEvidence(deferral), "which carries the reader back to the sheet").toHaveCount(1);
    const deferralCode = await heldAttribute(deferral, "data-code");
    expect(
      ["SCHEDULE_NONE_RECONSTRUCTED", "SCHEDULE_VIEW_CONTRIBUTED_NOTHING"],
      `a deferral names the registered reason it deferred under: ${String(deferralCode)}`,
    ).toContain(String(deferralCode));
    expect(await schedules.state(), "a sheet that holds both a table and a deferral reads as partial, never as ready (R-UI-050)").toBe(PARTIAL);

    await checkpoint(page, testInfo, "s-schedules/tables");
    await expect(page).toHaveScreenshot(["s-schedules", "tables.png"], { mask: schedules.masks(), animations: "disabled" });

    /* --- the one inspector: absent until something is chosen, and then exactly one (AC-7) --- */
    await schedules.cells(table).first().click();
    await settled(page);
    await expect(schedules.inspector, "the cell a reader chose fills the shell's one inspector slot").toHaveCount(1);

    await emulateTheme(page, "light");
    await settled(page);
    await expect(page).toHaveScreenshot(["s-schedules", "tables-light.png"], { mask: schedules.masks(), animations: "disabled" });
    await restoreLaneTheme(page, testInfo);
  });

  test("J-032: the sheet's notes are transcribed — some as proposed, one edited — and the contested lap suspends", async ({ page }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    const staged = await stageSchedules(page, { label: "j032-notes" });
    const schedules = new SSchedulesPage(page);

    await schedules.open(staged.tenantId, staged.projectId);
    await settled(page);
    await schedules.sheetRow(staged.drawingId, staged.notesLayout).click();
    await settled(page);

    /* --- what the grammar offers: one row per kind the sheet states, each citing its own text --- */
    await expect(schedules.proposals, "the five figures this sheet's general notes state (AC-6)").toHaveCount(KINDS.length);
    for (const kind of KINDS) {
      const proposal = schedules.proposal(kind);
      await expect(proposal, `the sheet proposes its ${kind}`).toHaveCount(1);
      const written = staged.noteValues[kind] as string;
      await expect(proposal, `saying what the drawing WROTE for the ${kind}, verbatim: ${written} (AC-6, Decision §1)`).toContainText(written);
      await expect(
        schedules.proposalValue(kind),
        `and offering the figure the grammar read out of those words — never the words, and never a figure of the screen's own (I-254)`,
      ).toHaveValue(staged.noteCanonicals[kind] as string);

      const link = schedules.evidence(proposal);
      await expect(link, "a proposal cites the sentence it was read from, and only it (R-UI-022)").toHaveCount(1);
      await expect(link, "transcribed off the drawing's text").toHaveAttribute("data-basis", TRANSCRIBED);
      await expect(link, `which opens the notes sheet at THAT sentence: ${String(staged.noteKeys[kind])}`).toHaveAttribute(
        "href",
        selectionAddress(staged.tenantId, staged.projectId, staged.drawingId, staged.notesLayout, [staged.noteKeys[kind] as string]),
      );
    }

    /* --- the act: the minimum hook read at another figure, everything else as proposed (AC-6) --- */
    await schedules.transcribeWith(HOOK_MIN, EDITED_HOOK_MIN);
    await expect(schedules.dialog, "a door previews rather than committing (R-UI-021)").toBeVisible();
    await expect(schedules.dialogSubjects, "one subject per reading the transcription would write").toHaveCount(KINDS.length);
    await schedules.confirmAct();
    await settled(page);

    /* --- the answer: what was kept, the verdict each was given, and where each was read from --- */
    // The readings this sheet holds are the walk's own five and whatever already stood on it — the
    // stage says what that is, so the roster is the ground's, never a number written here (B-19).
    const stoodAlready = [staged.otherActorReading];
    await expect(schedules.readings, "one row per reading committed on this sheet — the walk's own beside the one that stood").toHaveCount(
      KINDS.length + stoodAlready.length,
    );

    for (const kind of KINDS) {
      const rows = schedules.reading(kind);
      const alike = stoodAlready.filter((one) => one.kind === kind).length;
      await expect(rows, `the ${kind} the walk read, beside every other reading of it`).toHaveCount(1 + alike);

      const cited = staged.noteKeys[kind] as string;
      const address = selectionAddress(staged.tenantId, staged.projectId, staged.drawingId, staged.notesLayout, [cited]);
      for (const row of await everyRow(rows, `the ${kind} reading rows`)) {
        await expect(row, "read off the drawing's own text (L-QTY-01)").toHaveAttribute("data-basis", TRANSCRIBED);
        await expect(row, `and naming the sentence it was read from — the one the grammar read the ${kind} out of`).toHaveAttribute("data-source", cited);
        const link = schedules.evidence(row);
        await expect(link, "with one trace back to that sentence").toHaveCount(1);
        await expect(link, `which opens the notes sheet at that entity and nothing else: ${address}`).toHaveAttribute("href", address);
      }

      // The verdict is the seam's, on the figure THIS walk committed: as proposed, or edited.
      await expect(
        schedules.readingJudged(kind, kind === HOOK_MIN ? EDITED : ACCEPTED),
        `and the ${kind} the walk read carries the verdict the seam gave it (AC-2)`,
      ).toHaveCount(1);
    }

    /* --- the standing: a figure two people read differently stands at no figure at all (AC-6) --- */
    const lap = schedules.standing(LAP);
    await expect(lap, "two readings of the lap disagree, so the lap stands suspended (L-ACT-01)").toHaveAttribute("data-standing", SUSPENDED);
    await expect(lap, "and the absence is stated under the registered code it is refused by").toHaveAttribute("data-code", NOTE_READING_CONTESTED);
    await expect(schedules.refusals(lap), "through exactly one RefusalState, in place (R-UI-020)").toHaveCount(1);
    await expect(schedules.standing(FY), "while the grade nobody contested stands agreed").toHaveAttribute("data-standing", AGREED);
    expect(await schedules.state(), "a suspended standing beside readings that stand is the partial state (R-UI-050)").toBe(PARTIAL);

    await checkpoint(page, testInfo, "s-schedules/transcribed");
    await expect(page).toHaveScreenshot(["s-schedules", "transcribed.png"], { mask: schedules.masks(), animations: "disabled" });
  });

  test("J-032: a project with no partitioned drawing teaches the next action rather than standing empty-handed", async ({ page }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    // A project nobody has read a drawing on — the empty cell of this screen's state matrix (AC-7).
    const bare = await stageBareProject(page, { label: "j032-empty" });
    const schedules = new SSchedulesPage(page);

    await schedules.open(bare.tenantId, bare.projectId);
    await settled(page);
    await expect(schedules.empty, "a project nobody has read a drawing on says what to do next (R-UI-050)").toBeVisible();
    expect(await schedules.state(), "and the screen says it is empty").toBe("empty");
  });
});
