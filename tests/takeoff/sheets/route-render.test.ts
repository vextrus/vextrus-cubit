/**
 * AC-4 — the S-Drawings route, rendered by the served product (R-TO-004, R-UI-050, Design Decision
 * docs/design/s-drawings.md §1 and §7).
 *
 * The screen is judged as a reader meets it: the product is built and served against this file's own
 * scratch database and storage root, the page is fetched with a member's session, and the markup that
 * came back is read as a document. Nothing is asserted about the route's source — what a screen
 * renders is what it sends.
 *
 * Every expectation is derived from the index the module itself answered and from the rosters the
 * product declares (`DISCIPLINES`, `FIDELITY_FACTS`), so a sheet added to the corpus or a fact added
 * to the roster is carried without an edit (B-19).
 *
 * The seven R-UI-050 states are NOT re-derived here: the merged `tests/screen-states/matrix.test.ts`
 * walks every route on disk and fails a screen that declares fewer, which is that rule's one home.
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  CORE_SHEETS_MODULE,
  PRINCIPAL,
  SHEETS_MODULE,
  byCodePoint,
  closeStage,
  disciplinesFromBible,
  drawingsPath,
  fetchPage,
  grantRole,
  openSheetsStage,
  productModule,
  renderRasters,
  serveStagedApp,
  stagePerson,
  stageProject,
  stageSheets,
  stopStagedApp,
  type CoreSheetsSeam,
  type OfferedGroup,
  type Person,
  type SheetCard,
  REPO_ROOT,
  type SheetsSeam,
} from "../support/sheets-stage";

/**
 * The HTML parser this file reads a served page with. `jsdom` is a declared dependency of the
 * increment and installed in the checkout; it is reached through `createRequire` rather than a
 * static specifier because the package ships no types, and a page is judged by the ELEMENTS it
 * carries — the flight payload Next writes into a `<script>` is text, and text cannot answer a
 * `querySelectorAll` the way a regular expression over the source would let it.
 */
function jsdom(): { JSDOM: new (html: string) => { window: { document: Document } } } {
  const require_ = createRequire(join(REPO_ROOT, "noop.cjs"));
  return require_("jsdom") as { JSDOM: new (html: string) => { window: { document: Document } } };
}

/** One real extraction, one `next build`, one served page: the whole staged run lives in here. */
const BUDGET_MS = 900_000;

/** The dist directory this file builds into, so `git status` stays clean and no lane collides. */
const DIST = ".next-sheets-acceptance";

interface Staged {
  core: CoreSheetsSeam;
  person: Person;
  projectId: string;
  emptyProjectId: string;
  cards: SheetCard[];
  groups: OfferedGroup[];
  origin: string;
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const sheets = await productModule<SheetsSeam>(SHEETS_MODULE);
    const core = await productModule<CoreSheetsSeam>(CORE_SHEETS_MODULE);

    await openSheetsStage();
    const { person, projectId } = await stagePerson("route");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    const emptyProjectId = stageProject(person.tenantId, "Sheets route with no drawings");

    const { drawing, record } = await stageSheets(person, projectId, "route");
    await renderRasters(person, drawing, record);

    const cards = await sheets.sheetIndexOf({ tenantId: person.tenantId, projectId });
    const groups = await sheets.offeredGroupsOf({ tenantId: person.tenantId, projectId });
    const { origin } = await serveStagedApp(DIST);
    return { core, person, projectId, emptyProjectId, cards, groups, origin };
  })());
}

afterAll(async () => {
  stopStagedApp();
  await closeStage();
}, 120_000);

/** The page a signed-in member is served at an address, as a document. */
async function documentAt(path: string): Promise<Document> {
  const stage = await staged();
  const answer = await fetchPage(stage.origin, path, stage.person.cookie);
  expect(answer.status, `${path} is served to a member of the workspace it belongs to`).toBe(200);
  expect(answer.url.endsWith(path), `${path} is the address that answered — a redirect to ${answer.url} is a different screen`).toBe(true);
  return new (jsdom().JSDOM)(answer.html).window.document;
}

/** Every element carrying a test id, in document order — the closed contract's own hooks (C-05). */
function all(scope: Document | Element, testId: string): Element[] {
  return [...scope.querySelectorAll(`[data-testid="${testId}"]`)];
}

/** The one element carrying a test id inside a card, refused by name where the card has none. */
function one(card: Element, testId: string, sheet: string): Element {
  const found = all(card, testId);
  expect(found.length, `the card for ${sheet} renders exactly one ${testId} (Design Decision §7)`).toBe(1);
  return found[0] as Element;
}

describe("AC-4: the drawings route renders the index server-side", () => {
  test("AC-4: one sheet-card per card of the index, each carrying the cells the contract names", async () => {
    const stage = await staged();
    const document_ = await documentAt(drawingsPath(stage.person.tenantId, stage.projectId));

    const index = all(document_, "sheet-index");
    expect(index.length, "the screen renders its one sheet index").toBe(1);
    const cards = all(index[0] as Element, "sheet-card");
    expect(byCodePoint(cards.map((card) => card.getAttribute("data-sheet") ?? "")), "one card per sheet the module answered, named by its sheet id").toEqual(byCodePoint(stage.cards.map((card) => card.sheetId)));

    const byId = new Map(stage.cards.map((card) => [card.sheetId, card]));
    for (const element of cards) {
      const sheet = element.getAttribute("data-sheet") ?? "";
      const card = byId.get(sheet) as SheetCard;
      const effective = card.confirmed === null ? card.proposal.discipline : card.confirmed.discipline;
      expect(element.getAttribute("data-discipline"), `the card for ${sheet} publishes the discipline it stands at`).toBe(effective);
      expect(element.getAttribute("data-confirmed"), `the card for ${sheet} publishes whether that discipline is confirmed (L-REG-03 fails closed)`).toBe(card.confirmed === null ? "false" : "true");

      one(element, "sheet-card-thumbnail", sheet);

      // Every cell the contract names carries the card's own value, not merely the test id: an
      // element tagged and left empty renders nothing a reader can act on (Design Decision §1).
      expect(one(element, "sheet-card-title", sheet).textContent, `the card for ${sheet} shows the proposed title`).toContain(card.proposal.title);
      expect(one(element, "sheet-card-format", sheet).textContent, `the card for ${sheet} shows the format the drawing is stored as, verbatim (I-25: data renders as data)`).toContain(card.format);
      expect(one(element, "sheet-card-scheme", sheet).textContent, `the card for ${sheet} shows the extractor scheme the record states, verbatim (R-TO-001)`).toContain(card.scheme);
      expect(one(element, "sheet-card-scale", sheet).getAttribute("data-scale"), `the card for ${sheet} publishes the scale state the module derived (R-TO-004)`).toBe(card.scaleState);
      expect(one(element, "sheet-card-views", sheet).getAttribute("data-views"), `the card for ${sheet} publishes the view count it holds — empty while no view has been classified, never a count invented`).toBe(card.viewCount === null ? "" : String(card.viewCount));
      if (card.proposal.number !== null) {
        expect(one(element, "sheet-card-number", sheet).textContent, `the card for ${sheet} shows the number the grammar read from its title block`).toContain(card.proposal.number);
      } else {
        one(element, "sheet-card-number", sheet);
      }

      const basis = one(element, "sheet-card-discipline", sheet).getAttribute("data-basis");
      expect(basis, `the card for ${sheet} says who judged its discipline (I-83: a proposal basis, not an R-UI-002 basis)`).toBe(card.confirmed === null ? card.proposal.basis : "CONFIRMED");

      const facts = all(element, "sheet-fact");
      expect(byCodePoint(facts.map((fact) => fact.getAttribute("data-fact") ?? "")), `the card for ${sheet} shows every fidelity fact the roster names, zeros included (R-TO-001)`).toEqual(byCodePoint([...stage.core.FIDELITY_FACTS]));
      for (const fact of facts) {
        const name = fact.getAttribute("data-fact") ?? "";
        expect(fact.getAttribute("data-value"), `the fact ${name} on ${sheet} publishes the value the record states`).toBe(String(card.facts[name]));
      }
    }
  }, BUDGET_MS);

  test("AC-4: the Dropzone stands above the index, with search, discipline chips, the offered groups and the timeline", async () => {
    const stage = await staged();
    const document_ = await documentAt(drawingsPath(stage.person.tenantId, stage.projectId));

    const dropzone = all(document_, "dropzone")[0];
    const index = all(document_, "sheet-index")[0];
    expect(dropzone, "the screen mounts the one Dropzone (R-SPINE-020's pattern, its own Decision ruling it)").toBeTruthy();
    expect(index, "the screen renders its index").toBeTruthy();
    const order = (dropzone as Element).compareDocumentPosition(index as Element);
    // Node.DOCUMENT_POSITION_FOLLOWING is 4: the index comes after the dropzone in document order.
    expect(order & 4, "the Dropzone is mounted above the sheets it fills (Design Decision §1)").toBe(4);

    expect(all(document_, "sheet-search").length, "the index is searchable (R-TO-004: filter and search)").toBe(1);

    // The roster is read out of R-TO-004 itself, not out of the export the screen reads: comparing
    // the chips to `DISCIPLINES` alone would let a truncated enum agree with a truncated chip list.
    const disciplines = disciplinesFromBible();
    expect(byCodePoint([...stage.core.DISCIPLINES]), "DISCIPLINES is the closed roster R-TO-004 names, whole (L-REG-03: discipline is a closed enum)").toEqual(byCodePoint(disciplines));
    const options = all(document_, "sheet-filter-option");
    expect(byCodePoint(options.map((option) => option.getAttribute("data-value") ?? "")), "one chip per discipline the law names, plus ALL — the filter is over the closed enum, never over what today's sheets happen to be").toEqual(byCodePoint(["ALL", ...disciplines]));

    expect(all(document_, "offered-groups").length, "the one OfferedGroups pattern stands on the screen (L-ACT-02: bulk is offered, never assembled)").toBe(1);
    const offered = all(document_, "offered-group");
    expect(offered.length, "every group the module offers is rendered").toBe(stage.groups.length);
    expect(all(document_, "job-timeline").length, "the job timeline stands where the work was started (R-UI-024, X-1)").toBe(1);
  }, BUDGET_MS);

  test("AC-4: a project holding no drawings renders sheets-empty naming that cause", async () => {
    const stage = await staged();
    const document_ = await documentAt(drawingsPath(stage.person.tenantId, stage.emptyProjectId));

    const empty = all(document_, "sheets-empty");
    expect(empty.length, "silence never happens: an empty index says why it is empty (R-UI-020, I-91)").toBe(1);
    expect((empty[0] as Element).getAttribute("data-cause"), "a project holding no drawings says so by name").toBe("no-drawings");
    expect(all(document_, "sheet-card").length, "there is no card to show").toBe(0);
  }, BUDGET_MS);
});
