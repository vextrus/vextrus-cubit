/**
 * S-BBS, as the journey walks it (docs/design/s-bbs.md §6's closed hook contract).
 *
 * Every locator is found by the id the Decision fixes or by the role and name a reader uses; nothing
 * here knows a class name or a DOM shape, and nothing here judges the product. The ids are READ from
 * `src/ui/testids.ts` — the product's one home for them (AM-09 §1) — under the group this screen
 * publishes, so no id is spelled twice in the tree. Until that group lands, every lookup fails by
 * name, which is the red this increment is owed.
 *
 * The Builder may edit this file (test contract).
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { TESTIDS, isTestId, testIdSelector, type TestId } from "../../../src/ui/testids";
import { shellMasks } from "./shell.page";
import { heldAttribute, readWhen } from "../support/retrying-read";

/** The addresses this screen answers at and offers (Decision §6, test contract). */
export const S_BBS = Object.freeze({
  bbs: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/bbs`,
  register: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/register`,
} as const);

/** One painted row of the grid: its place in the whole list and every `data-*` it publishes. */
export type BbsPaintedRow = { readonly index: number; readonly data: Readonly<Record<string, string>> };

/** The whole grid, read row by row past its window: group rows, NET rows and LAP rows, in order. */
export type BbsWholeGrid = {
  readonly members: readonly BbsPaintedRow[];
  readonly rows: readonly BbsPaintedRow[];
  readonly laps: readonly BbsPaintedRow[];
  /** Places in the list between the first and last row read that no pass painted — zero when whole. */
  readonly gaps: number;
};

/** How long a whole read of a long schedule may take before it is a failure with a named cause. */
const WHOLE_READ_TIMEOUT_MS = 120_000;

/** The group this screen publishes its ids under, as the registry holds it today. */
const group = (TESTIDS as unknown as { bbs?: Record<string, string> }).bbs ?? {};
const takeoffGroup = TESTIDS.takeoff as unknown as Record<string, string>;

/** One id of this screen, by the key the registry files it under — never a literal in a test. */
function idOf(key: string): TestId {
  const id = group[key];
  if (typeof id !== "string" || !isTestId(id)) {
    throw new Error(`src/ui/testids.ts publishes no TESTIDS.bbs.${key} — S-BBS has not landed its ids yet`);
  }
  return id;
}

/** The lane's own sixth tab, from the same registry. */
function navId(): TestId {
  const id = takeoffGroup["navBbs"];
  if (typeof id !== "string" || !isTestId(id)) {
    throw new Error("src/ui/testids.ts publishes no TESTIDS.takeoff.navBbs — the lane's sixth tab has not landed yet");
  }
  return id;
}

export class SBbsPage {
  constructor(private readonly page: Page) {}

  /** Open the schedule's address directly and wait for the screen to stand. */
  async open(tenantId: string, projectId: string): Promise<void> {
    await this.page.goto(S_BBS.bbs(tenantId, projectId));
    await expect(this.screen, "the bar schedule renders for a project the workspace holds").toBeVisible();
  }

  /** Reach the screen the way a reader does: the takeoff lane's own sixth tab. */
  async openThroughNav(): Promise<void> {
    await this.navBbs.click();
    await this.page.waitForURL(/takeoff\/bbs/);
    await expect(this.screen, "the sixth tab lands on the bar schedule").toBeVisible();
  }

  get screen(): Locator {
    return this.page.getByTestId(idOf("screen"));
  }
  get grid(): Locator {
    return this.page.getByTestId(idOf("grid"));
  }
  get answer(): Locator {
    return this.page.getByTestId(idOf("answer"));
  }
  get empty(): Locator {
    return this.page.getByTestId(idOf("empty"));
  }
  get revision(): Locator {
    return this.page.getByTestId(idOf("revision"));
  }
  get stock(): Locator {
    return this.page.getByTestId(idOf("stock"));
  }
  get summary(): Locator {
    return this.page.getByTestId(idOf("summary"));
  }
  /** The export door, the job strip a press mounts, and the link a finished render offers (I-bbs-8). */
  get exportButton(): Locator {
    return this.page.getByTestId(idOf("export"));
  }
  get jobs(): Locator {
    return this.page.getByTestId(idOf("jobs"));
  }
  get documentLink(): Locator {
    return this.page.getByTestId(idOf("documentLink"));
  }
  get navBbs(): Locator {
    return this.page.getByTestId(navId());
  }
  get takeoffNav(): Locator {
    return this.page.getByTestId(TESTIDS.takeoff.nav);
  }
  get crumbPage(): Locator {
    return this.page.getByTestId(TESTIDS.shell.crumbPage);
  }
  get main(): Locator {
    return this.page.getByTestId(TESTIDS.shell.main);
  }

  /** What state the screen says it is in — the RENDERED contract a read waits on (R-UI-050). */
  async state(): Promise<string | null> {
    return heldAttribute(this.screen, "data-state");
  }

  /** How many rows the grid says it painted — the statement a read of a virtualised table waits on. */
  async rowsRendered(): Promise<string | null> {
    return heldAttribute(this.grid, "data-rows-rendered");
  }

  /* --- the grid: members, their bars, and the lap beside a bar that laps --- */
  get members(): Locator {
    return this.page.getByTestId(idOf("member"));
  }
  member(objectKey: string): Locator {
    return this.page.locator(`${testIdSelector(idOf("member"))}[data-member="${objectKey}"]`);
  }
  get rows(): Locator {
    return this.page.getByTestId(idOf("row"));
  }
  row(barKey: string): Locator {
    return this.page.locator(`${testIdSelector(idOf("row"))}[data-bar-key="${barKey}"]`);
  }
  get laps(): Locator {
    return this.page.getByTestId(idOf("lap"));
  }
  lapOf(barKey: string): Locator {
    return this.page.locator(`${testIdSelector(idOf("lap"))}[data-bar-key="${barKey}"]`);
  }

  /**
   * The WHOLE schedule, read the way a reader reads a long one: scrolled from the top to the foot of
   * the grid, every row each window paints kept by its place in the list (`aria-rowindex`). A
   * virtualised grid paints a window of its rows (§5 rule 9, past 200), so a locator over the page
   * sees only that window; this reads them all. The read is whole only when its NET rows are the
   * document's lines (`bbs-screen`'s `data-rows`) and no place between its first and last row went
   * unpainted — otherwise it is read again, and a read that never comes whole fails by name.
   */
  async wholeGrid(): Promise<BbsWholeGrid> {
    const lines = Number(await heldAttribute(this.screen, "data-rows", "the lines the schedule states"));
    const testIds = { member: idOf("member"), row: idOf("row"), lap: idOf("lap") };
    const viewport = this.grid.getByTestId(TESTIDS.datatable.viewport);
    return readWhen(
      () =>
        viewport.evaluate(async (box, ids): Promise<BbsWholeGrid> => {
          const frame = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
          const painted = new Map<number, { kind: string; data: Record<string, string> }>();
          const kinds = new Set<string>([ids.member, ids.row, ids.lap]);
          const keep = (): void => {
            for (const row of Array.from(box.querySelectorAll("[role=row][aria-rowindex]"))) {
              const kind = row.getAttribute("data-testid") ?? "";
              if (!kinds.has(kind)) continue;
              const data: Record<string, string> = {};
              for (const name of row.getAttributeNames()) if (name.startsWith("data-")) data[name] = row.getAttribute(name) ?? "";
              painted.set(Number(row.getAttribute("aria-rowindex")), { kind, data });
            }
          };
          box.scrollTop = 0;
          await frame();
          // Half a window a step, so every row stands in two windows and none falls between them.
          for (let step = 0; step < 100_000; step += 1) {
            keep();
            const foot = box.scrollTop + box.clientHeight >= box.scrollHeight - 1;
            if (foot) break;
            box.scrollTop += Math.max(1, Math.floor(box.clientHeight / 2));
            await frame();
          }
          box.scrollTop = 0;
          const order = [...painted.keys()].sort((left, right) => left - right);
          const first = order[0] ?? 0;
          const last = order.at(-1) ?? -1;
          const of = (kind: string) => order.flatMap((index) => (painted.get(index)?.kind === kind ? [{ index, data: painted.get(index)?.data ?? {} }] : []));
          return { members: of(ids.member), rows: of(ids.row), laps: of(ids.lap), gaps: last - first + 1 - order.length };
        }, testIds),
      (read) => read.rows.length === lines && read.gaps === 0 && read.members.length > 0,
      `the whole schedule read past the grid's window: ${String(lines)} NET rows with no place unpainted`,
      WHOLE_READ_TIMEOUT_MS,
    );
  }

  /* --- the cutting-stock summary beneath it --- */
  get summaryRows(): Locator {
    return this.page.getByTestId(idOf("summaryRow"));
  }
  summaryRow(diameter: string): Locator {
    return this.page.locator(`${testIdSelector(idOf("summaryRow"))}[data-diameter="${diameter}"]`);
  }

  /** The grid's own header, through the shipped primitive's id. */
  header(): Locator {
    return this.grid.getByTestId(TESTIDS.datatable.header).first();
  }

  /**
   * What a picture of this screen must not compare: the shell's per-run identities and the chip
   * whose value changes with every staged run.
   */
  masks(): Locator[] {
    return [...shellMasks(this.page), this.revision];
  }
}
