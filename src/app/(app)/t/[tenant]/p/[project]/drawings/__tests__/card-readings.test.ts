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
 *     column carries no measure (the stylesheet's own rules, read as text — jsdom lays nothing out);
 *  6. (I-429) model space is named as model space wherever the card is named — its title, its
 *     picture's alt, the search and the confirmation dialog's row — states no sheet number, and
 *     stands after its drawing's sheets; every count counts it as the one card it is.
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
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DISCIPLINES } from "@/core/sheets/law";
import { formatUserFigure } from "@/core/format";
import { JobsProvider, type JobsFormat } from "@/ui/patterns/job-timeline";
import { fill } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { SheetIndex } from "../sheet-index";
import { drawings } from "../strings";
import type { OfferedGroupData, SheetIndexProps } from "../sheet-index";
import type { SheetCardData } from "../sheet-card";
import type { PreviewAnswer } from "../actions";

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
    kind: "paper",
    format: "dxf",
    schemes: ["DXF_HANDLE"],
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

describe("I-429: model space is said as model space, after its drawing's sheets", () => {
  const BNBC = "11111111-1111-4111-8111-111111111111";
  const OTHER_DRAWING = "22222222-2222-4222-8222-222222222222";

  /** A card of `drawing`, at `layoutName`, of the space `kind`, proposing `title` and `number`. */
  function laid(drawing: string, layoutName: string, kind: SheetCardData["kind"], title: string, number: string | null): SheetCardData {
    const base = card();
    return { ...base, sheetId: `ingest-${drawing.slice(0, 1)}:${layoutName}`, drawingId: drawing, layoutName, kind, proposal: { ...base.proposal, title, number } };
  }

  /** F-RCC6-BNBC as the module answers it: the inventory opens on model space, whose tallest text is
      one of the sheets' own titles (I-364: "its model space keeps COLUMN SCHEDULE and no number"). */
  const MODEL = laid(BNBC, "model", "model", "COLUMN SCHEDULE", null);
  const COVER = laid(BNBC, "S-00 COVER", "paper", "COVER", "S-00");
  const SCHEDULE = laid(BNBC, "S-11 COLUMN SCHEDULE", "paper", "COLUMN SCHEDULE", "S-11");

  function renderIndex(cards: readonly SheetCardData[], extra: Partial<SheetIndexProps> = {}): HTMLElement {
    const { container } = render(
      createElement(
        JobsProvider,
        { format: JOBS_FORMAT },
        createElement(SheetIndex, { tenantId: TENANT, projectId: PROJECT, cards, groups: [], canConfirm: false, awaitingIngest: 0, ...extra }),
      ),
    );
    return container;
  }

  /** The cards the fold stands, in its order, by the sheet each is a reading of. */
  const order = (): string[] => screen.getAllByTestId(TESTIDS.sheet.card).map((element) => element.getAttribute("data-sheet") ?? "");

  test("the model-space card is titled 'Model space', never by the tallest text the grammar read in it, and states no sheet number", () => {
    const element = renderCard(MODEL);
    const title = within(element).getByTestId(TESTIDS.sheet.cardTitle);
    expect(text(title)).toBe(copy("drawings_model_space"));
    expect(text(title), "the grammar's reading of model space is one of the sheets' own titles, and never names this card").not.toContain(MODEL.proposal.title);
    expect(within(element).queryByTestId(TESTIDS.sheet.cardNumber), "model space is numbered by no set: its card has no number slot, not a stated lack").toBeNull();
    expect(element.textContent ?? "", "so it never says 'No sheet number'").not.toContain(copy("drawings_number_none"));
    expect(element.getAttribute("data-discipline"), "the proposal still decides its discipline — only its name moves").toBe(MODEL.proposal.discipline);
  });

  test("a paper sheet keeps the title and the number its block proposes", () => {
    const element = renderCard(SCHEDULE);
    expect(text(within(element).getByTestId(TESTIDS.sheet.cardTitle))).toBe(SCHEDULE.proposal.title);
    expect(text(within(element).getByTestId(TESTIDS.sheet.cardNumber))).toBe(SCHEDULE.proposal.number);
  });

  test("the picture's alt names model space as its title does", () => {
    const element = renderCard({ ...MODEL, thumbnail: { url: "/raster/model.png", width: 256, height: 192 } });
    expect(within(element).getByTestId(TESTIDS.sheet.cardThumbnail).getAttribute("alt")).toBe(fill(copy("drawings_thumbnail_alt"), { sheet: copy("drawings_model_space") }));
  });

  test("the fold opens on the drawing's first sheet, and each drawing's model space closes its own run of sheets", () => {
    const otherModel = laid(OTHER_DRAWING, "model", "model", "GROUND FLOOR PLAN", null);
    const otherSheet = laid(OTHER_DRAWING, "A-01 GROUND FLOOR PLAN", "paper", "GROUND FLOOR PLAN", "A-01");
    // The module's order: each drawing's layout inventory, which opens on model space.
    renderIndex([MODEL, COVER, SCHEDULE, otherModel, otherSheet]);
    expect(order()).toEqual([COVER.sheetId, SCHEDULE.sheetId, MODEL.sheetId, otherSheet.sheetId, otherModel.sheetId]);
    expect(text(screen.getAllByTestId(TESTIDS.sheet.cardTitle)[0] as HTMLElement), "the fold opens on the cover").toBe(COVER.proposal.title);
  });

  test("the search reads the card's own words: 'model' finds model space, and the grammar's title for it finds only the sheet that wears it", async () => {
    renderIndex([MODEL, COVER, SCHEDULE]);
    const search = screen.getByTestId(TESTIDS.sheet.search);
    const user = userEvent.setup();
    await user.type(search, "column schedule");
    expect(order(), "model space no longer shows that text, so that text does not find it").toEqual([SCHEDULE.sheetId]);
    await user.clear(search);
    await user.type(search, "model");
    expect(order()).toEqual([MODEL.sheetId]);
  });

  test("model space counts as the one card it is, on the chips and on the count line alike", () => {
    const root = renderIndex([MODEL, COVER, SCHEDULE]);
    const chip = (value: string): string =>
      text(screen.getAllByTestId(TESTIDS.sheet.filterOption).find((option) => option.getAttribute("data-value") === value)?.querySelector(".cx-drawings-chip-count") as HTMLElement);
    expect(chip("ALL")).toBe(formatUserFigure("3"));
    expect(chip(MODEL.proposal.discipline), "a chip counts the cards pressing it leaves standing").toBe(formatUserFigure("3"));
    expect(text(root.querySelector(".cx-drawings-count") as HTMLElement)).toBe(fill(copy("drawings_sheet_count"), { shown: formatUserFigure("3"), total: formatUserFigure("3") }));
  });

  test("the confirmation dialog lists model space as 'Model space', not as the sheet whose title the grammar gave it", async () => {
    const group: OfferedGroupData = { key: { kind: "PROPOSED_DISCIPLINE", drawingId: BNBC, discipline: MODEL.proposal.discipline }, label: "bnbc.dxf", members: [MODEL.sheetId, SCHEDULE.sheetId] };
    // The seam's own labels: every subject by its proposed title, model space's being the tallest text.
    const answer: PreviewAnswer = {
      previewed: true,
      consequence: {
        actType: "CONFIRM_DISCIPLINE",
        tenantId: TENANT,
        projectId: PROJECT,
        rendering: "SUBJECTS",
        subjects: [MODEL, SCHEDULE].map((held) => ({ subjectId: held.sheetId, subjectLabel: held.proposal.title, before: [], after: [held.proposal.discipline] })),
      },
      consequenceDigest: "digest-1",
    };
    const preview = vi.fn(async () => answer);
    renderIndex([MODEL, COVER, SCHEDULE], { groups: [group], canConfirm: true, preview });

    await userEvent.setup().click(screen.getByTestId(TESTIDS.offered.groupConfirm));
    const rows = await screen.findAllByTestId(TESTIDS.consequence.subjectRow);
    const label = (sheetId: string): string => text(rows.find((row) => row.getAttribute("data-subject") === sheetId)?.querySelector(".cx-consequence-subject-label") as HTMLElement);
    expect(label(MODEL.sheetId)).toBe(copy("drawings_model_space"));
    expect(label(SCHEDULE.sheetId), "a paper sheet keeps the title the seam named it by").toBe(SCHEDULE.proposal.title);
    expect(preview, "the seam is asked with the group's key and nothing else — the label is presentation").toHaveBeenCalledWith({ projectId: PROJECT, group: group.key });
  });
});
