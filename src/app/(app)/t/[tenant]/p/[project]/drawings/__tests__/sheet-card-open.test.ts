// @vitest-environment jsdom
/**
 * AC-4's door — every sheet card on S-Drawings opens its sheet in the viewer (R-UI-031: a screen
 * reachable only by a typed URL is a failing acceptance criterion, and this pays s-viewer I-77).
 *
 * The index is rendered as a reader meets it, over cards supplied to the shipped component, and the
 * address each door points at is composed here from the card's own facts rather than transcribed —
 * a sheet whose layout name needs escaping is carried by the same rule (B-19). The copy is read from
 * the route's own strings table by key, so this file spells no sentence of its own (R-SPINE-060).
 *
 * `.ts` with `createElement` rather than `.tsx`: this path is inside `src/`, where the sheet-index
 * precedent (sheet-index-empty.test.ts) already mounts this screen.
 */
import { createElement } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DISCIPLINES } from "../../../../../../../../core/sheets/law";
import { SheetIndex } from "../sheet-index";
import { drawings } from "../strings";
import type { SheetCardData } from "../sheet-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined, prefetch: () => undefined }),
  usePathname: () => "/t/tenant-1/p/project-1/drawings",
  useSearchParams: () => new URLSearchParams(),
}));

/** The workspace and project the index is rendered for — the first two segments of every door. */
const TENANT = "3f1c2e10-8a44-4e2b-9f0a-1c2d3e4f5061";
const PROJECT = "9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d";

/** One card of the index, of a drawing and a layout named by the caller. */
function card(sheetId: string, drawingId: string, layoutName: string): SheetCardData {
  return {
    sheetId,
    drawingId,
    layoutName,
    format: "dxf",
    scheme: "DXF_HANDLE",
    thumbnail: null,
    proposal: { number: "S-101", title: `Title of ${layoutName}`, discipline: DISCIPLINES[0], basis: "GRAMMAR", cited: [] },
    confirmed: null,
    scaleState: "unaffirmed",
    viewCount: null,
    facts: {},
  };
}

/**
 * Two sheets of two drawings, one of them named so that its address must be escaped: a layout called
 * `FOUNDATION PLAN` is exactly what the Golden Path opens, and a raw space in an `href` is not the
 * address the viewer answers at.
 */
const CARDS: SheetCardData[] = [
  card("ingest-1:FOUNDATION PLAN", "11111111-1111-4111-8111-111111111111", "FOUNDATION PLAN"),
  card("ingest-1:model", "22222222-2222-4222-8222-222222222222", "model"),
];

/** The address the viewer answers a sheet at (the test contract's route). */
function viewerAddress(drawingId: string, layoutName: string): string {
  return `/t/${TENANT}/p/${PROJECT}/viewer/${drawingId}/${encodeURIComponent(layoutName)}`;
}

/** The route's own copy, read by key: this acceptance is written before the key exists. */
function copy(key: string): string {
  const held = (drawings as unknown as Record<string, string>)[key];
  expect(typeof held, `the drawings screen's strings table carries \`${key}\` (Design Decision §3)`).toBe("string");
  return held as string;
}

afterEach(() => {
  cleanup();
});

test("AC-4: every sheet card carries a visible door to its own sheet in the viewer", () => {
  render(
    createElement(SheetIndex, {
      tenantId: TENANT,
      projectId: PROJECT,
      cards: CARDS,
      groups: [],
      canConfirm: false,
      awaitingIngest: 0,
    }),
  );

  const rendered = screen.getAllByTestId("sheet-card");
  expect(rendered.length, "one card per sheet the index was given").toBe(CARDS.length);

  const bySheet = new Map(CARDS.map((entry) => [entry.sheetId, entry]));
  for (const element of rendered) {
    const sheetId = element.getAttribute("data-sheet") ?? "";
    const entry = bySheet.get(sheetId);
    expect(entry, `the rendered card ${sheetId} is one of the cards given`).toBeDefined();
    const held = entry as SheetCardData;

    const doors = within(element).getAllByTestId("sheet-card-open");
    expect(doors.length, `the card for ${held.layoutName} carries exactly one door to its sheet`).toBe(1);
    const door = doors[0] as HTMLElement;

    expect(door.getAttribute("href"), `the door of ${held.layoutName} points at that sheet of that drawing, escaped as an address`).toBe(
      viewerAddress(held.drawingId, held.layoutName),
    );
    expect(door.textContent ?? "", `the door of ${held.layoutName} reads as the route's strings table writes it`).toContain(copy("drawings_open_sheet"));
    expect(door.tagName.toLowerCase(), "it is a link, so it is navigation a browser can follow and open in a new tab (R-UI-031)").toBe("a");
    expect(door.className.split(/\s+/), "styled as the core secondary Button-as-link, from the one home a button's look lives in (B-17)").toContain("cx-btn");
    expect(door.getAttribute("data-variant"), "in the secondary variant the Design Decision names (§1)").toBe("secondary");
  }
});

test("AC-4: the card's door is announced inside the region its own sheet names", () => {
  render(
    createElement(SheetIndex, {
      tenantId: TENANT,
      projectId: PROJECT,
      cards: CARDS,
      groups: [],
      canConfirm: false,
      awaitingIngest: 0,
    }),
  );

  // N cards offering N doors with one label is a screen reader hears "Open sheet" N times with no
  // way to tell them apart: the card names itself, so each door is heard inside its own sheet.
  for (const element of screen.getAllByTestId("sheet-card")) {
    const labelledBy = element.getAttribute("aria-labelledby") ?? "";
    expect(labelledBy, `the card ${element.getAttribute("data-sheet")} names itself as a region (Design Decision §1)`).not.toBe("");
    const title = within(element).getByTestId("sheet-card-title");
    expect(labelledBy.split(/\s+/), "and what names it is its own title").toContain(title.id);
  }
});
