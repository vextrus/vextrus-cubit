// @vitest-environment jsdom
/**
 * I-359 — what a sheet card reads, as the 2026-09-23 re-look of the M3 project asked it to read:
 *
 *  1. the views line tells "no partition has answered" (null) from "the partition answered and no view
 *     stands on this sheet" (zero) — a cover sheet of a finished bill never says its drawing was
 *     never read;
 *  2. where the scale line already states "{count} of {total} views", the views line does not say the
 *     total again — it keeps its box and its `data-views`, and leaves sight;
 *  3. "no scale" has one spelling on the card;
 *  4. the cited entity keys are evidence for a PROPOSAL, and stand only while the discipline is one;
 *  5. the grid stretches every card of a row and stands each door at its card's foot, and the page
 *     column carries no measure (the stylesheet's own rules, read as text — jsdom lays nothing out).
 *
 * The copy is read from the route's own strings table by key, so this file spells no sentence of its
 * own (R-SPINE-060); every card is built here from the facts the case names (B-19).
 *
 * `.ts` with `createElement` rather than `.tsx`: the sheet-index precedent beside it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DISCIPLINES } from "@/core/sheets/law";
import { formatUserFigure } from "@/core/format";
import { JobsProvider, type JobsFormat } from "@/ui/patterns/job-timeline";
import { fill } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { SheetIndex } from "../sheet-index";
import { drawings } from "../strings";
import type { SheetCardData } from "../sheet-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined, prefetch: () => undefined }),
  usePathname: () => "/t/tenant-1/p/project-1/drawings",
  useSearchParams: () => new URLSearchParams(),
}));

const TENANT = "3f1c2e10-8a44-4e2b-9f0a-1c2d3e4f5061";
const PROJECT = "9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d";
const JOBS_FORMAT: JobsFormat = { seconds: (elapsedMs: number) => String(elapsedMs), refusal: () => null };
const CITED = ["DXF_HANDLE:1F37", "DXF_HANDLE:1F38", "DXF_HANDLE:1F39", "DXF_HANDLE:1F3A"];

type Readings = Partial<Pick<SheetCardData, "scaleState" | "unplaceableViews" | "viewCount" | "confirmed">>;

function card(o: Readings = {}): SheetCardData {
  return {
    sheetId: "ingest-1:S-10 COLUMN LAYOUT PLAN",
    drawingId: "11111111-1111-4111-8111-111111111111",
    layoutName: "S-10 COLUMN LAYOUT PLAN",
    format: "dxf",
    scheme: "DXF_HANDLE",
    thumbnail: null,
    proposal: { number: "S-10", title: "COLUMN LAYOUT PLAN", discipline: DISCIPLINES[0], basis: "GRAMMAR", cited: CITED },
    confirmed: o.confirmed ?? null,
    scaleState: o.scaleState ?? "unaffirmed",
    unplaceableViews: o.unplaceableViews ?? null,
    viewCount: o.viewCount === undefined ? null : o.viewCount,
    facts: {},
  };
}

function copy(key: keyof typeof drawings): string {
  return drawings[key];
}

/** The one card of a one-card index, rendered as a reader meets it. */
function renderCard(one: SheetCardData): HTMLElement {
  render(
    createElement(
      JobsProvider,
      { format: JOBS_FORMAT },
      createElement(SheetIndex, { tenantId: TENANT, projectId: PROJECT, cards: [one], groups: [], canConfirm: false, awaitingIngest: 0 }),
    ),
  );
  const cards = screen.getAllByTestId(TESTIDS.sheet.card);
  expect(cards.length, "the index rendered the one card it was given").toBe(1);
  return cards[0] as HTMLElement;
}

function text(element: HTMLElement): string {
  return (element.textContent ?? "").trim();
}

afterEach(() => {
  cleanup();
});

describe("I-359: the views line says which answer it is", () => {
  test("no partition has answered: the card says the views are not classified yet, and publishes no count", () => {
    const views = within(renderCard(card({ viewCount: null }))).getByTestId(TESTIDS.sheet.cardViews);
    expect(views.getAttribute("data-views"), "a count nobody derived is empty").toBe("");
    expect(text(views)).toBe(copy("drawings_views_unclassified"));
  });

  test("the partition answered and put no view on this sheet: the card says so, and publishes zero", () => {
    const views = within(renderCard(card({ viewCount: 0 }))).getByTestId(TESTIDS.sheet.cardViews);
    expect(views.getAttribute("data-views"), "zero is an answer, and it is published as one").toBe("0");
    expect(text(views), "never the not-yet sentence over a record the partition has read").toBe(copy("drawings_views_count_none"));
    expect(text(views)).not.toBe(copy("drawings_views_unclassified"));
  });

  test("one view and many read in the grammar of their number", () => {
    expect(text(within(renderCard(card({ viewCount: 1, scaleState: "affirmed", unplaceableViews: 0 }))).getByTestId(TESTIDS.sheet.cardViews))).toBe(
      fill(copy("drawings_views_count_one"), { count: formatUserFigure("1") }),
    );
    cleanup();
    expect(text(within(renderCard(card({ viewCount: 6, scaleState: "affirmed", unplaceableViews: 0 }))).getByTestId(TESTIDS.sheet.cardViews))).toBe(
      fill(copy("drawings_views_count"), { count: formatUserFigure("6") }),
    );
  });
});

describe("I-359: a card states each fact once", () => {
  test("where the scale line counts the views, the views line keeps its box and its count and leaves sight", () => {
    const element = renderCard(card({ scaleState: "unplaceable", unplaceableViews: 1, viewCount: 1 }));
    const scale = within(element).getByTestId(TESTIDS.sheet.cardScale);
    expect(text(scale), "the scale line says how many of how many").toBe(
      fill(copy("drawings_scale_unplaceable_count"), { count: formatUserFigure("1"), total: formatUserFigure("1") }),
    );
    const views = within(element).getByTestId(TESTIDS.sheet.cardViews);
    expect(views.getAttribute("data-said"), "so the views line is marked as already said").toBe("true");
    expect(views.getAttribute("data-views"), "and still publishes the count every reader of the hook reads").toBe("1");
    expect(views.hasAttribute("hidden"), "it is never taken out of the flow: the partition lands on the job runner's clock, and a line leaving the flow would re-flow the card").toBe(false);
  });

  test("where the scale line counts nothing, the views line stands", () => {
    for (const readings of [{ viewCount: 3, scaleState: "affirmed", unplaceableViews: 0 }, { viewCount: 0 }, { viewCount: null }] as const) {
      const views = within(renderCard(card(readings))).getByTestId(TESTIDS.sheet.cardViews);
      expect(views.getAttribute("data-said"), `a views line nothing above has said stands (${JSON.stringify(readings)})`).toBeNull();
      cleanup();
    }
  });

  test("'no scale' has one spelling: the unaffirmed state and the counted one both say 'no scale of record'", () => {
    const unaffirmed = copy("drawings_scale_unaffirmed");
    expect(copy("drawings_scale_unplaceable_count").startsWith(unaffirmed), "the counted sentence opens with the unaffirmed state's own words").toBe(true);
    expect(text(within(renderCard(card({ viewCount: 0 }))).getByTestId(TESTIDS.sheet.cardScale))).toBe(unaffirmed);
  });
});

describe("I-359: the cited keys are the evidence for a proposal, and stand only while it is one", () => {
  const cited = (element: HTMLElement): HTMLElement | null => element.querySelector<HTMLElement>(".cx-drawings-cited");

  test("an unconfirmed card shows three keys and counts the rest", () => {
    const element = renderCard(card());
    const row = cited(element);
    expect(row, "the proposal's evidence stands while the discipline is a proposal").not.toBeNull();
    expect(row?.querySelectorAll("[data-value]").length, "three keys, as IdChips").toBe(3);
    expect(text(within(element).getByTestId(TESTIDS.sheet.cardCitedMore))).toBe(fill(copy("drawings_cited_more"), { count: formatUserFigure(String(CITED.length - 3)) }));
  });

  test("a confirmed card carries no cited row: a person's confirmation is the basis now", () => {
    const element = renderCard(card({ confirmed: { discipline: DISCIPLINES[0], actId: "act-1" } }));
    expect(cited(element), "no row of handles under the title of a confirmed sheet").toBeNull();
    expect(within(element).queryByTestId(TESTIDS.sheet.cardCitedMore)).toBeNull();
    expect(within(element).getByTestId(TESTIDS.sheet.cardDiscipline).getAttribute("data-basis"), "and the discipline cell says who judged it").toBe("CONFIRMED");
  });
});

describe("I-359: the grid's rhythm and the page's width, as the stylesheet rules them", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "(app)", "t", "[tenant]", "p", "[project]", "drawings", "drawings.css"), "utf8");
  const rule = (selector: string): string => {
    const at = css.indexOf(`\n${selector} {`);
    expect(at, `drawings.css rules ${selector}`).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf("}", at));
  };

  test("the cards of a row stretch to the row, and each door stands at its card's foot", () => {
    expect(rule(".cx-drawings-grid")).toContain("align-items: stretch;");
    expect(rule(".cx-drawings-card-open")).toContain("margin-top: auto;");
  });

  test("the page column takes shell-main's width: no measure leaves an uneven gutter", () => {
    expect(rule(".cx-drawings")).not.toContain("max-width");
  });

  test("a line already said keeps its box", () => {
    expect(rule('.cx-drawings-line[data-said="true"]')).toContain("visibility: hidden;");
  });

  test("the door is the card's last child, so the foot is where it stands", () => {
    const element = renderCard(card());
    expect(element.lastElementChild?.getAttribute("data-testid")).toBe(TESTIDS.sheet.cardOpen);
  });
});
