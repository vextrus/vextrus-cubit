/**
 * S-Documents, as the journey walks it (docs/design/s-documents.md §7's closed hook contract).
 *
 * Every locator is found by the id the Decision fixes or by the role and name a reader uses; nothing
 * here knows a class name or a DOM shape, and nothing here judges the product. The ids are READ from
 * `src/ui/testids.ts` — the product's one home for them (AM-09 §1) — under the group this screen
 * publishes, so no id is spelled twice in the tree. Until that group lands, every lookup fails by
 * name, which is the red this increment is owed.
 *
 * The Builder may edit this file (test contract).
 */
import { type Locator, type Page } from "@playwright/test";
import { TESTIDS, isTestId, testIdSelector, type TestId } from "../../../src/ui/testids";
import { heldAttribute } from "../support/retrying-read";

/** The address this screen answers at (Decision §7, test contract). */
export const S_DOCUMENTS = Object.freeze({
  documents: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/documents`,
} as const);

/** The group this screen publishes its ids under, as the registry holds it today. */
const group = (TESTIDS as unknown as { documents?: Record<string, string> }).documents ?? {};

/**
 * One id of this screen, by the key the registry files it under — never a literal in a test.
 *
 * The answer is the registry's own `TestId`, narrowed by the registry's own guard: an id this
 * checkout does not publish is not a test id at all, and saying so by name here is the red this
 * increment is owed (AM-09 §1).
 */
function idOf(key: string): TestId {
  const id = group[key];
  if (typeof id !== "string" || !isTestId(id)) {
    throw new Error(`src/ui/testids.ts publishes no TESTIDS.documents.${key} — S-Documents has not landed its ids yet`);
  }
  return id;
}

export class SDocumentsPage {
  constructor(private readonly page: Page) {}

  /** Open the screen at its own address (R-UI-031: the URL is the source of truth). */
  async open(tenantId: string, projectId: string): Promise<void> {
    await this.page.goto(S_DOCUMENTS.documents(tenantId, projectId));
  }

  /* --- the screen, and the state it says it is in (R-UI-050) --- */
  get screen(): Locator {
    return this.page.getByTestId(idOf("screen"));
  }
  async state(): Promise<string | null> {
    return heldAttribute(this.screen, "data-state");
  }

  /* --- the grid, its rows, and what each row says about its document --- */
  get grid(): Locator {
    return this.page.getByTestId(idOf("grid"));
  }
  async rowsRendered(): Promise<string | null> {
    return heldAttribute(this.grid, "data-rows-rendered");
  }
  get rows(): Locator {
    return this.page.getByTestId(idOf("row"));
  }
  row(documentId: string): Locator {
    return this.page.locator(`${testIdSelector(idOf("row"))}[data-document="${documentId}"]`);
  }
  /** The DataTable's own body rows inside this grid — the element the grid law is measured on. */
  bodyRows(): Locator {
    return this.grid.locator(`${testIdSelector(TESTIDS.datatable.row)}, ${testIdSelector(idOf("row"))}`);
  }
  get header(): Locator {
    return this.grid.getByTestId(TESTIDS.datatable.header);
  }

  /* --- the identifiers a row states, each through the one chip primitive (R-UI-082) --- */
  digest(row: Locator): Locator {
    return row.getByTestId(idOf("digest"));
  }
  issuedBy(row: Locator): Locator {
    return row.getByTestId(idOf("issuedBy"));
  }
  acts(row: Locator): Locator {
    return row.getByTestId(idOf("act"));
  }
  supersededBy(row: Locator): Locator {
    return row.getByTestId(idOf("supersededBy"));
  }
  openLink(row: Locator): Locator {
    return row.getByTestId(idOf("open"));
  }

  /* --- the states that stand in the grid's place --- */
  get empty(): Locator {
    return this.page.getByTestId(idOf("empty"));
  }
  get error(): Locator {
    return this.page.getByTestId(idOf("error"));
  }
  get reportId(): Locator {
    return this.page.getByTestId(idOf("reportId"));
  }
  get retry(): Locator {
    return this.page.getByTestId(idOf("retry"));
  }

  /* --- where the reader is, as the frame says it (R-UI-084) --- */
  get crumbPage(): Locator {
    return this.page.getByTestId(TESTIDS.shell.crumbPage);
  }
  get main(): Locator {
    return this.page.getByTestId(TESTIDS.shell.main);
  }

  /** What the frame paints differently on every run, masked for the design pictures (Decision §7). */
  masks(): Locator[] {
    return [
      this.page.locator(testIdSelector(TESTIDS.shell.breadcrumb)),
      this.page.locator(testIdSelector(TESTIDS.shell.user)),
      this.page.locator(testIdSelector(TESTIDS.shell.tenantSwitcher)),
    ];
  }
}
