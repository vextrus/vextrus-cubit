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
  aDocumentRow,
  all,
  attribute,
  cellsOf,
  copy,
  documentsProps,
  documentsScreen,
  documentsStrings,
  enumLabelShape,
  humaniseEnum,
  mountDocuments,
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

  test("AC-1: a single issue nobody has superseded is one row saying so", async () => {
    const screen = await documentsScreen();
    const only = aDocumentRow({ version: 3 });
    const root = mountDocuments(screen, documentsProps({ rows: [only] }));

    expect(attribute(one(root, "grid"), "data-rows-rendered"), "the grid counts what it drew, whatever the roster is").toBe("1");
    expect(all(root, "row").length, "one listing is one row").toBe(1);
    expect(attribute(one(root, "row"), "data-superseded"), "nothing replaced it, so it says false rather than saying nothing").toBe("false");
  });
});
