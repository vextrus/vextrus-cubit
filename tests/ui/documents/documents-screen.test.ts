// @vitest-environment jsdom
/**
 * AC-1's bare-mount half — the rows, their order and the attributes each carries, asserted over the
 * screen alone: `DocumentsScreen({ rows, tenantId, projectId, reportId: null })` is handed the very
 * listings the journey's stage writes and judged on what it draws (increment interfaces).
 *
 * AC-1's served half — the same claim at `/t/{tenantId}/p/{projectId}/documents` over rows the store
 * really holds, newest first — is walked by `tests/e2e/documents.spec.ts` (J-030), because a rendered
 * route is the only honest proof that the page's one read reaches this screen.
 *
 * Nothing here freezes a roster: every count is taken from the rows the mount was handed, and every
 * word from the product's own string table (B-19).
 */
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import {
  DOCUMENTS_SCREEN_MODULE,
  ISSUER,
  aDocumentRow,
  all,
  attribute,
  cellsOf,
  copy,
  documentsId,
  documentsProps,
  documentsScreen,
  documentsStrings,
  enumLabelShape,
  humaniseEnum,
  idChipShape,
  mountDocuments,
  productModule,
  one,
  rowsOf,
  text,
  twoIssues,
  unlabelledKind,
  visibleText,
} from "./support/documents-stage";

afterEach(cleanup);

describe("AC-1 — the list, as the screen draws it", () => {
  test("AC-1: the staged listings mount bare as one row each, in the order they were handed over, ready", async () => {
    const screen = await documentsScreen();
    const rows = twoIssues();
    const root = mountDocuments(screen, documentsProps({ rows }));

    expect(attribute(root, "data-state"), "rows to show is the ready state (R-UI-050, Decision §2)").toBe("ready");

    const grid = one(root, "grid");
    expect(
      attribute(grid, "data-rows-rendered"),
      `the grid publishes how many rows it drew — the roster it was handed, never a re-reckoning: ${rows.length}`,
    ).toBe(String(rows.length));

    const drawn = rowsOf(root);
    expect(drawn.length, "one `documents-row` per listing").toBe(rows.length);
    expect(
      drawn.map((row) => attribute(row, "data-document")),
      "in the store's own order — the order the rows arrived in, newest issue first",
    ).toEqual(rows.map((row) => row.id));
  });

  test("AC-1: every row states its document, kind, version and whether it was superseded", async () => {
    const screen = await documentsScreen();
    const rows = twoIssues();
    const root = mountDocuments(screen, documentsProps({ rows }));
    const drawn = rowsOf(root);

    rows.forEach((row, at) => {
      const element = drawn[at] as HTMLElement;
      expect(attribute(element, "data-document"), `row ${at} is the listing's own row id`).toBe(row.id);
      expect(attribute(element, "data-kind"), `row ${at} carries the kind the store recorded, raw`).toBe(row.kind);
      expect(attribute(element, "data-version"), `row ${at} carries the issue it is`).toBe(String(row.version));
      expect(
        attribute(element, "data-superseded"),
        `row ${at} says whether a later issue replaced it — the listing's \`supersededBy\` and nothing else: ${String(row.supersededBy)}`,
      ).toBe(String(row.supersededBy !== null));
    });
  });

  test("AC-1: the frozen first cell renders the kind through the shipped EnumLabel, reading the words its own key is authored under", async () => {
    const screen = await documentsScreen();
    const strings = await documentsStrings();
    const rows = twoIssues();
    const root = mountDocuments(screen, documentsProps({ rows }));

    for (const element of rowsOf(root)) {
      // The kind the ROW says it is — so a cell that painted one word whatever the row held would be
      // caught by the row beside it rather than agreed with (B-19).
      const kind = attribute(element, "data-kind") ?? "";
      const label = copy(strings, `documents_kind_${kind}`);
      const cells = cellsOf(element);
      expect(cells.length, "the row is drawn as cells, the kind first (Decision §1)").toBeGreaterThan(1);

      const rendered = cells[0] as HTMLElement;
      const enumLabel = rendered.querySelector(`[data-value="${kind}"]`) as HTMLElement | null;
      expect(enumLabel, `the kind renders as a label over its stored value \`${kind}\` (R-UI-082)`).not.toBeNull();

      // Rendered THROUGH the primitive, not merely like it: the element is compared with what the
      // shipped EnumLabel itself produces for this value and these words — its classes, what a
      // reader sees, and where the raw value is allowed to be.
      const shape = await enumLabelShape(kind, label);
      expect(
        shape.classes.every((className) => (enumLabel as HTMLElement).classList.contains(className)),
        `the kind is the shipped EnumLabel's own element (it wears ${JSON.stringify(shape.classes)})`,
      ).toBe(true);
      expect(visibleText(enumLabel), `and says the words this kind is authored under: ${label}`).toBe(shape.visibleText);
      expect(visibleText(enumLabel), "which is the copy table's own word for it").toBe(label);
      expect(
        visibleText(element).includes(kind),
        `the stored key \`${kind}\` is never read out loud — it lives in the technical disclosure alone (R-UI-082)`,
      ).toBe(false);
    }
  });

  test("AC-1: a kind the copy table authors no words for reads by the enum's own mechanical rule", async () => {
    const screen = await documentsScreen();
    const strings = await documentsStrings();
    const humanise = await humaniseEnum();
    // A kind this screen has authored no `documents_kind_<kind>` for — probed from the table, so the
    // day one of them IS authored the suite moves to the next rather than freezing today's roster.
    const kind = unlabelledKind(strings);
    const row = aDocumentRow({ kind });
    const root = mountDocuments(screen, documentsProps({ rows: [row] }));

    const cell = cellsOf(one(root, "row"))[0] as HTMLElement;
    const enumLabel = cell.querySelector(`[data-value="${kind}"]`) as HTMLElement | null;
    expect(enumLabel, `the unlabelled kind \`${kind}\` still renders over its stored value`).not.toBeNull();

    const shape = await enumLabelShape(kind);
    expect(visibleText(enumLabel), `an unlabelled kind falls back to the enum's own reading of it: ${humanise(kind)}`).toBe(shape.visibleText);
    expect(visibleText(enumLabel), "which is `humaniseEnum`'s answer and no word this screen invented").toBe(humanise(kind));
    expect(visibleText(cell).includes(kind), `and the raw key \`${kind}\` is still never read out loud (R-UI-082)`).toBe(false);
  });

  test("AC-1: the version cell is the bare integer, and it is not the kind's cell", async () => {
    const screen = await documentsScreen();
    const rows = twoIssues();
    const root = mountDocuments(screen, documentsProps({ rows }));
    const drawn = rowsOf(root);

    rows.forEach((row, at) => {
      const cells = cellsOf(drawn[at] as HTMLElement);
      const bare = cells.filter((cell) => text(cell) === String(row.version));
      expect(bare.length, `one cell of the row states version ${row.version} as the bare integer — no prefix, no "v" (Decision §1)`).toBe(1);
      expect(cells.indexOf(bare[0] as HTMLElement), "and it is not the frozen kind cell").toBeGreaterThan(0);
    });
  });

  test("I-348: the root states itself — `data-screen-root` beside its `data-state` — and the grid is a rendered region", async () => {
    // The craft re-look: the walk read `state=none regions=0` here, so `settled()` never waited on it.
    const screen = await documentsScreen();
    const root = mountDocuments(screen, documentsProps());
    expect(root.hasAttribute("data-screen-root"), "the screen root says it is one (the I-213 class)").toBe(true);
    expect(attribute(root, "data-state")).toBe("ready");
    const grid = one(root, "grid");
    expect(attribute(grid, "data-rendered-region"), "the grid says it is the region a read waits on, under its own id").toBe(documentsId("grid"));
  });

  test("I-348: the issuer is a person, named by the project's roster, with the recorded id kept whole", async () => {
    const screen = await documentsScreen();
    const label = "rafiq@cubit.test";
    const root = mountDocuments(screen, documentsProps({ people: { [ISSUER]: label } }));
    for (const row of rowsOf(root)) {
      const issuer = row.querySelector(`[data-testid="${documentsId("issuedBy")}"]`) as HTMLElement | null;
      expect(issuer, "each row states who issued it").not.toBeNull();
      expect(visibleText(issuer as HTMLElement), "by the name the roster knows them by (R-UI-082)").toBe(label);
      expect(attribute(issuer as HTMLElement, "data-value"), "and the id the store recorded stays whole in the data").toBe(ISSUER);
      expect(issuer?.querySelector("[data-testid]"), "no chip of a hash stands for a person the roster names").toBeNull();
    }
  });

  test("I-348: an issuer the roster does not name is the recorded id, through the one chip", async () => {
    const screen = await documentsScreen();
    const root = mountDocuments(screen, documentsProps({ people: {} }));
    const chipShape = await idChipShape(ISSUER, documentsId("issuedBy"));
    for (const row of rowsOf(root)) {
      const issuer = row.querySelector(`[data-testid="${documentsId("issuedBy")}"]`) as HTMLElement;
      expect(attribute(issuer, "data-value"), "the whole id in the chip's data").toBe(ISSUER);
      expect(chipShape.classes.every((name) => issuer.classList.contains(name)), `the shipped IdChip's own element (it wears ${JSON.stringify(chipShape.classes)})`).toBe(true);
    }
  });

  test("I-348: the seven columns fit the grid at 1280, so the row's one door is never cut", async () => {
    // The craft re-look: at 1280 the widths summed to 1,316 against a 1,184 grid, and `Open PDF`
    // showed as "Op". 1280 − the 48 rail − main's 24 + 24 padding is the grid's band; a vertical
    // scrollbar may take up to 16 of it.
    const module = await productModule<{ DOCUMENTS_COLUMNS?: readonly { size?: number }[] }>(DOCUMENTS_SCREEN_MODULE);
    const sizes = (module.DOCUMENTS_COLUMNS ?? []).map((column) => column.size ?? 0);
    expect(sizes.length, "§1's seven columns").toBe(7);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(1280 - 48 - 24 * 2 - 16);
  });

  test("AC-1: a single issue nobody has superseded is one row saying so", async () => {
    const screen = await documentsScreen();
    const only = aDocumentRow({ version: 3 });
    const root = mountDocuments(screen, documentsProps({ rows: [only] }));

    expect(attribute(one(root, "grid"), "data-rows-rendered"), "the grid counts what it drew, whatever the roster is").toBe("1");
    expect(all(root, "row").length, "one listing is one row").toBe(1);
    expect(attribute(one(root, "row"), "data-superseded"), "nothing replaced it, so it says false rather than saying nothing").toBe("false");
  });
});
