// @vitest-environment jsdom
/**
 * M4P-1 — what a vector PDF page's card reads (docs/design/s-drawings.md I-519, I-520):
 *
 *  1. one scheme badge per scheme the sheet's own keys are of, in the law's order, each publishing
 *     `data-scheme` and read in words — **PDF vector** for a page, and both words for a page that
 *     carries a pasted scan;
 *  2. a cited PDF key is a 64-character digest no card holds, so its chip shows IdChip's short form
 *     and carries the whole key in `data-value`; a DXF handle still shows whole;
 *  3. a page's collapsed duplicates are a fidelity fact, named and counted — and never notable, since a
 *     duplicate read once lost nothing (I-520);
 *  4. a page's images and shadings nobody read are a fidelity fact, notable when any, so a pasted scan
 *     on a vector page says so before the facts are opened (I-521).
 *
 * The copy is read from the route's own strings table by key (R-SPINE-060); every card is built here
 * from the facts the case names (B-19). `.ts` with `createElement`: the sheet-index precedent.
 */
import { createElement } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DISCIPLINES, FIDELITY_FACTS, UNFLAGGED_FACTS } from "@/core/sheets/law";
import { JobsProvider, type JobsFormat } from "@/ui/patterns/job-timeline";
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
const DIGEST = "A7407F04456BED03C1ED9F0495299CD57B2117B38564B8038DF0EDB22FB36E90";

function card(o: Partial<Pick<SheetCardData, "schemes" | "scans" | "facts">> & { cited?: readonly string[] } = {}): SheetCardData {
  return {
    sheetId: "ingest-1:Page 11",
    drawingId: "11111111-1111-4111-8111-111111111111",
    layoutName: "Page 11",
    kind: "paper",
    format: "pdf",
    schemes: o.schemes ?? ["PDF_OBJECT"],
    scans: o.scans ?? [],
    thumbnail: null,
    proposal: { number: "S-10", title: "COLUMN LAYOUT PLAN", discipline: DISCIPLINES[0], basis: "GRAMMAR", cited: o.cited ?? [`PDF_OBJECT:${DIGEST}`] },
    confirmed: null,
    scaleState: "unaffirmed",
    unplaceableViews: null,
    viewCount: null,
    facts: o.facts ?? {},
  };
}

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

afterEach(() => {
  cleanup();
});

describe("M4P-1: a PDF page's card", () => {
  test("shows one scheme badge per scheme its keys are of, in words, in the law's order (I-519)", () => {
    const badges = within(renderCard(card())).getAllByTestId(TESTIDS.sheet.cardScheme);
    expect(badges.map((badge) => badge.getAttribute("data-scheme"))).toEqual(["PDF_OBJECT"]);
    expect(badges[0]?.textContent).toContain(drawings.drawings_scheme_pdf_object);
    cleanup();

    const mixed = within(renderCard(card({ schemes: ["PDF_OBJECT", "RASTER_TRACE"] }))).getAllByTestId(TESTIDS.sheet.cardScheme);
    expect(mixed.map((badge) => badge.getAttribute("data-scheme")), "a page carrying a pasted scan reads both").toEqual(["PDF_OBJECT", "RASTER_TRACE"]);
    expect(mixed.map((badge) => badge.getAttribute("aria-label"))).toEqual([
      drawings.drawings_scheme_label.replace("{value}", drawings.drawings_scheme_pdf_object),
      drawings.drawings_scheme_label.replace("{value}", drawings.drawings_scheme_raster_trace),
    ]);
  });

  test("shows a cited digest by its short form, the whole key kept in the chip's value; a handle whole", () => {
    const chips = within(renderCard(card({ cited: [`PDF_OBJECT:${DIGEST}`, "DXF_HANDLE:1F37"] }))).getAllByTestId("id-chip");
    expect(chips.map((chip) => chip.getAttribute("data-value"))).toEqual([`PDF_OBJECT:${DIGEST}`, "DXF_HANDLE:1F37"]);
    const shown = chips.map((chip) => chip.querySelector(".cx-id-chip-value")?.textContent ?? "");
    expect(shown, "a 64-character digest shows its leading seven; a short handle shows whole").toEqual([DIGEST.slice(0, 7), "1F37"]);
  });

  test("names the page's collapsed duplicates as a fidelity fact, counted and never flagged (I-520)", () => {
    expect(FIDELITY_FACTS).toContain("collapsed");
    expect(UNFLAGGED_FACTS, "a collapse lost nothing, so the law counts it and never flags it").toEqual(["collapsed"]);
    const shown = renderCard(card({ facts: { collapsed: 19 } }));
    const facts = within(shown).getAllByTestId(TESTIDS.sheet.fact);
    expect(facts.map((fact) => fact.getAttribute("data-fact")), "every fact of the roster renders, in its order").toEqual([...FIDELITY_FACTS]);
    const collapsed = facts.find((fact) => fact.getAttribute("data-fact") === "collapsed");
    expect(collapsed?.getAttribute("data-value")).toBe("19");
    expect(collapsed?.getAttribute("data-notable"), "nineteen duplicates read once are not a loss").toBe("false");
    expect(collapsed?.textContent).toContain(drawings.drawings_fact_collapsed);
    expect(shown.querySelector(".cx-drawings-facts-notable")?.textContent, "the summary flags nothing for them").toBe(drawings.drawings_facts_notable_none);
  });

  test("names the images a page carries and nobody read, flagged before the facts are opened (I-521)", () => {
    expect(FIDELITY_FACTS).toContain("unread");
    const shown = renderCard(card({ facts: { collapsed: 3, unread: 1 } }));
    const unread = within(shown)
      .getAllByTestId(TESTIDS.sheet.fact)
      .find((fact) => fact.getAttribute("data-fact") === "unread");
    expect(unread?.getAttribute("data-value")).toBe("1");
    expect(unread?.getAttribute("data-notable"), "a picture nobody read is a loss the reader must see").toBe("true");
    expect(unread?.textContent).toContain(drawings.drawings_fact_unread);
    const summary = shown.querySelector(".cx-drawings-facts-summary");
    expect(summary?.getAttribute("data-notable")).toBe("true");
    expect(summary?.querySelector(".cx-drawings-facts-notable")?.textContent, "one notable fact — the image, never the collapses beside it").toBe(drawings.drawings_facts_notable.replace("{count}", "1"));
  });
});

describe("M4P-3: a traced sheet's card states its scan (I-584)", () => {
  test("says the DPI and the deskew it was traced at, one line a scan; a drawn sheet carries no such line", () => {
    const drawn = renderCard(card());
    expect(within(drawn).queryAllByTestId(TESTIDS.sheet.cardScan), "a drawn page's card is the card it always was").toEqual([]);
    cleanup();

    const traced = renderCard(card({ schemes: ["PDF_OBJECT", "RASTER_TRACE"], scans: [{ dpi: 152.4, deskewDegrees: -1.25 }] }));
    const [line, ...more] = within(traced).getAllByTestId(TESTIDS.sheet.cardScan);
    expect(more).toEqual([]);
    expect([line?.getAttribute("data-dpi"), line?.getAttribute("data-deskew")]).toEqual(["152.4", "-1.25"]);
    expect(line?.textContent, "the DPI and the turn, as figures through the format seam").toBe(
      drawings.drawings_scan_line.replace("{dpi}", drawings.drawings_scan_dpi.replace("{value}", "152.4")).replace("{deskew}", "1.25"),
    );
  });

  test("says so where the file stated no DPI, rather than print one nobody gave", () => {
    const line = within(renderCard(card({ scans: [{ dpi: null, deskewDegrees: 0 }] }))).getByTestId(TESTIDS.sheet.cardScan);
    expect(line.getAttribute("data-dpi")).toBe("");
    expect(line.textContent).toBe(drawings.drawings_scan_line.replace("{dpi}", drawings.drawings_scan_dpi_unstated).replace("{deskew}", "0"));
  });
});
