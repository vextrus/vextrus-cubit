// @vitest-environment jsdom
/**
 * I-353 (b)(c) — the member-type registry reads as a registry: ONE grid headed once, every variant
 * one row whose cells stand under their column's name, and the rail says the model space in words
 * (docs/design/s-schedules.md §0 I-353, §1's registry region; R-UI-082, R-UI-083).
 *
 * I-436, I-437 and I-sch-1(b) as amended — a strip family's Band says its floors (`1ST`,
 * `2ND TO 6TH`) and never its sheet's title; a committed reading says its unit once; and the rail's
 * name keeps its width while what the sheet holds yields first.
 *
 * What the vision re-look found: `Band`, `Section` and `Zone` printed on every row, a variant row
 * that wrapped onto a second line at 1280, and the rail's first sheet named `model`. The structure is
 * asserted here off the mount of the SHIPPED workspace over the shipped chrome (I-170), and the
 * geometry that keeps a row on one line off the screen's own stylesheet, because jsdom performs no
 * layout (the craft rubric reads the pixels; this reads what the sheet states).
 *
 * `.ts`, not `.tsx`: tsconfig typechecks `tests/**\/*.ts`, so the tree is built with `createElement`.
 * Nothing here opens a database and nothing here measures time (AM-10 §3).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Fragment, createElement, type ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { SchedulesWorkspace, type SchedulesAddresses, type SchedulesChrome, type SchedulesDoors } from "@/modules/takeoff/schedules-ui";
import { SCHEDULES_COPY } from "@/modules/takeoff/schedules-ui/copy";
import type { BandFace, FamilyView, ReadingView, SchedulesView, SheetView } from "@/modules/takeoff/schedules-ui/view";
import { MODEL_SPACE } from "@/modules/takeoff/schedules-ui/view";
import { REBAR_ZONES } from "@/core/db/schema-takeoff-schedules";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { EvidenceLink } from "@/ui/patterns/evidence-link";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Button, EmptyState, EnumLabel, IdChip, NumberInput, Skeleton, Tooltip, UnitBadge } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { TESTIDS, testIdSelector, type TestId } from "@/ui/testids";
import { declaredValue, ruleBody } from "../../support/stylesheet";
import { installDomStubs } from "../primitives-overlay-data/support/render";

afterEach(cleanup);

// jsdom answers `import.meta.url` as a page address, not a file: the lane runs from the repo root.
const REPO_ROOT = process.cwd();
const SHEET = readFileSync(join(REPO_ROOT, "src/app/(app)/t/[tenant]/p/[project]/takeoff/schedules/schedules.css"), "utf8");

const TENANT = "7c2f0b3c-1111-4111-8111-111111111111";
const PROJECT = "7c2f0b3c-2222-4222-8222-222222222222";
const DRAWING = "7c2f0b3c-3333-4333-8333-333333333333";
const REVISION = "7c2f0b3c-4444-4444-8444-444444444444";

/* --------------------------------------------------------------------------- the reading, staged */

/** A column family the way F-RCC6-BNBC's S-11 states one: four bands, each with its three zones. */
function aColumnFamily(mark: string, bands: readonly string[]): FamilyView {
  return {
    family: mark,
    markText: mark,
    sourceKeys: [`DXF_HANDLE:${mark}`],
    variants: bands.map((band, at) => ({
      variantKey: `${mark}:${at}`,
      bandText: band,
      banded: true,
      sectionText: "350x350+8-16%%C+10%%C@100/150 (TIES)",
      sourceKeys: [`DXF_HANDLE:${mark}:${at}`],
      zones: [
        { zone: "main", text: "8-16%%C", sourceKeys: [] },
        { zone: "ties-end", text: "10%%C@100/150 (TIES)", sourceKeys: [] },
        { zone: "ties-mid", text: "10%%C@100/150 (TIES)", sourceKeys: [] },
      ],
    })),
  };
}

/** The model space of one drawing, holding the registry, and a paper sheet beside it. */
function aReading(): SchedulesView {
  const model: SheetView = {
    drawingId: DRAWING,
    layoutName: MODEL_SPACE,
    kind: MODEL_SPACE,
    schedules: [],
    deferrals: [],
    families: [aColumnFamily("C1", ["GF TO 2ND", "3RD & 4TH", "5TH TO 6TH", "ROOF-SRR"]), aColumnFamily("C2", ["GF TO 2ND"])],
    notes: { proposals: [], readings: [], standings: [] },
  };
  const paper: SheetView = { ...model, layoutName: "S-11 COLUMN SCHEDULE", kind: "paper", families: [] };
  return { projectId: PROJECT, setRevisionId: REVISION, sheets: [model, paper] };
}

/* ------------------------------------------------------------------------------------ the mount */

const ADDRESSES: SchedulesAddresses = {
  selection: (sheet, sourceKeys) => `/t/${TENANT}/p/${PROJECT}/viewer/${sheet.drawingId}/${sheet.layoutName}?s=${sourceKeys.join(",")}`,
  drawings: `/t/${TENANT}/p/${PROJECT}/drawings`,
  participants: `/t/${TENANT}/p/${PROJECT}/settings/participants`,
};

const DOORS: SchedulesDoors = {
  schedules: () => Promise.reject(new Error("this suite presses no door")),
  previewTranscribeSheetNotes: () => Promise.reject(new Error("this suite presses no door")),
  commitTranscribeSheetNotes: () => Promise.reject(new Error("this suite presses no door")),
};

/** The shipped chrome, bound as `schedules-screen.tsx` binds it — every id from the one registry. */
const CHROME: SchedulesChrome = {
  testIds: {
    screen: TESTIDS.schedules.screen,
    empty: TESTIDS.schedules.empty,
    sheets: TESTIDS.schedules.sheets,
    sheetRow: TESTIDS.schedules.sheetRow,
    grid: TESTIDS.schedules.grid,
    table: TESTIDS.schedules.table,
    cell: TESTIDS.schedules.cell,
    deferral: TESTIDS.schedules.deferral,
    quantityCheck: TESTIDS.schedules.quantityCheck,
    registry: TESTIDS.schedules.registry,
    family: TESTIDS.schedules.family,
    variant: TESTIDS.schedules.variant,
    zone: TESTIDS.schedules.zone,
    notes: TESTIDS.schedules.notes,
    standing: TESTIDS.schedules.standing,
    reading: TESTIDS.schedules.reading,
    proposal: TESTIDS.schedules.proposal,
    proposalValue: TESTIDS.schedules.proposalValue,
    transcribe: TESTIDS.schedules.transcribe,
    inspector: TESTIDS.schedules.inspector,
  },
  navTestId: TESTIDS.takeoff.navSchedules,
  DataTable,
  RefusalState,
  ConsequenceDialog,
  EmptyState,
  Button,
  NumberInput,
  Skeleton,
  IdChip,
  EnumLabel,
  UnitBadge,
  EvidenceLink,
  Tooltip,
  TabsAside: () => null,
  InspectorMount: ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children ?? null),
};

function mount(view: SchedulesView): HTMLElement {
  installDomStubs();
  const { container } = render(
    createElement(SchedulesWorkspace, { view, tenantId: TENANT, projectId: PROJECT, permitted: { MEASURE: true }, offline: false, chrome: CHROME, doors: DOORS, addresses: ADDRESSES }),
  );
  const root = container.querySelector<HTMLElement>(testIdSelector(TESTIDS.schedules.screen));
  expect(root, "the workspace renders its own root (§7)").not.toBeNull();
  return root as HTMLElement;
}

function all(root: ParentNode, id: TestId): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(testIdSelector(id))];
}

/**
 * What an element SAYS: its words, with every raw enum kept under `data-technical` and every glyph a
 * reader is spared (`aria-hidden`, the evidence link's basis mark) taken out (R-UI-082).
 */
function said(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  for (const unsaid of Array.from(clone.querySelectorAll('[data-technical], [aria-hidden="true"]'))) unsaid.remove();
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------------------------------- the assertions */

describe("I-353: the registry is one grid, headed once", () => {
  test("the column names stand ONCE, as a heading row above the families, in §1's order", () => {
    const root = mount(aReading());
    const registry = all(root, TESTIDS.schedules.registry)[0] as HTMLElement;
    const heads = [...registry.querySelectorAll(".cx-schedules-registry-head")];
    expect(heads.length, "one heading row for the whole registry").toBe(1);
    expect(said(heads[0] as Element)).toBe(
      [SCHEDULES_COPY.schedules_registry_mark, SCHEDULES_COPY.schedules_registry_band, SCHEDULES_COPY.schedules_registry_section, SCHEDULES_COPY.schedules_registry_zone].join(" "),
    );
    for (const family of all(registry, TESTIDS.schedules.family)) {
      expect(family.contains(heads[0] as Element), "the heading stands beside the families, never inside one").toBe(false);
    }
  });

  test("no row says a column's name — every variant row says its band and its section, and its zones say their own words", () => {
    const root = mount(aReading());
    const names = new Set<string>([SCHEDULES_COPY.schedules_registry_mark, SCHEDULES_COPY.schedules_registry_band, SCHEDULES_COPY.schedules_registry_section, SCHEDULES_COPY.schedules_registry_zone]);
    const variants = all(root, TESTIDS.schedules.variant);
    expect(variants.length, "one row per stored variant").toBe(5);
    for (const variant of variants) {
      const words = said(variant).split(" ");
      expect(words.filter((word) => names.has(word)), `a variant row names no column: "${said(variant)}"`).toEqual([]);
      const zones = all(variant, TESTIDS.schedules.zone);
      expect(zones.map((zone) => zone.getAttribute("data-zone"))).toEqual(["main", "ties-end", "ties-mid"]);
      expect(zones.map((zone) => said(zone)), "each zone leads with its word and then the drawing's own text, control codes resolved (I-sch-1)").toEqual([
        "Main 8-16Ø",
        "End ties 10Ø@100/150 (TIES)",
        "Mid ties 10Ø@100/150 (TIES)",
      ]);
    }
  });

  test("a family's mark stands beside its variants and never inside one of them", () => {
    const root = mount(aReading());
    const family = root.querySelector<HTMLElement>(`${testIdSelector(TESTIDS.schedules.family)}[data-family="C1"]`) as HTMLElement;
    const mark = family.querySelector(".cx-schedules-family-mark") as Element;
    expect(said(mark), "the mark, once, as the trace to the entities that named it").toBe("C1");
    for (const variant of all(family, TESTIDS.schedules.variant)) expect(variant.contains(mark)).toBe(false);
    expect(all(family, TESTIDS.schedules.variant).map((variant) => said(variant).split(" Main ")[0]), "and each variant row starts with its band").toEqual([
      "GF TO 2ND 350x350+8-16Ø+10Ø@100/150 (TIES)",
      "3RD & 4TH 350x350+8-16Ø+10Ø@100/150 (TIES)",
      "5TH TO 6TH 350x350+8-16Ø+10Ø@100/150 (TIES)",
      "ROOF-SRR 350x350+8-16Ø+10Ø@100/150 (TIES)",
    ]);
  });
});

describe("I-353: the sheet stated in the geometry — one row, fixed tracks, nothing wraps", () => {
  test("the registry is a grid of named tracks, and a family and a variant are subgrids of it", () => {
    const tracks = declaredValue(SHEET, ".cx-schedules-registry-grid", "grid-template-columns") ?? "";
    for (const name of ["mark", "band", "section", ...REBAR_ZONES, "end"]) expect(tracks, `the grid names a track line [${name}]`).toContain(`[${name}]`);
    for (const selector of [".cx-schedules-registry-head", ".cx-schedules-family", ".cx-schedules-variant"]) {
      expect(declaredValue(SHEET, selector, "grid-template-columns"), `${selector} lays its cells on the registry's own tracks`).toBe("subgrid");
    }
  });

  test("every rebar zone the store can hold has a track of its own, so a zone stands under the same zone on every row", () => {
    for (const zone of REBAR_ZONES) {
      expect(declaredValue(SHEET, `.cx-schedules-zone[data-zone="${zone}"]`, "grid-column"), `the ${zone} zone`).toBe(`${zone} / span 1`);
    }
  });

  test("no rule of the registry wraps, and a cell that is too long ellipsises", () => {
    for (const selector of [".cx-schedules-registry-grid", ".cx-schedules-registry-head", ".cx-schedules-family", ".cx-schedules-variant", ".cx-schedules-zone"]) {
      const wraps = (ruleBody(SHEET, selector) ?? []).filter((decl) => decl.prop === "flex-wrap" && decl.value !== "nowrap");
      expect(wraps, `${selector} states no wrap (R-UI-083)`).toEqual([]);
    }
    expect(declaredValue(SHEET, ".cx-schedules-registry-cell", "white-space")).toBe("nowrap");
    expect(declaredValue(SHEET, ".cx-schedules-registry-cell", "text-overflow")).toBe("ellipsis");
    expect(declaredValue(SHEET, ".cx-schedules-variant", "min-height"), "a variant row is a --row-h row").toBe("var(--row-h)");
  });
});

describe("I-353: the rail says the model space in words", () => {
  test("the model layout reads Model space — its name stays on data-layout and the tooltip — and a paper sheet reads its own title", () => {
    const root = mount(aReading());
    const rows = all(root, TESTIDS.schedules.sheetRow);
    const model = rows.find((row) => row.getAttribute("data-layout") === MODEL_SPACE) as HTMLElement;
    const name = model.querySelector(".cx-schedules-sheet-name") as HTMLElement;
    expect(said(name)).toBe("Model space");
    expect(name.getAttribute("title"), "the layout's own name, a hover away").toBe(MODEL_SPACE);
    expect(model.querySelector(`[data-technical]`)?.textContent, "and the raw kind kept beside the words").toBe(MODEL_SPACE);
    const paper = rows.find((row) => row.getAttribute("data-layout") === "S-11 COLUMN SCHEDULE") as HTMLElement;
    expect(said(paper.querySelector(".cx-schedules-sheet-name") as Element)).toBe("S-11 COLUMN SCHEDULE");
  });

  test("a sheet whose kind the store was not asked for keeps its layout name, as it always did", () => {
    const reading = aReading();
    const model = reading.sheets[0] as SheetView;
    const unasked: SheetView = {
      drawingId: model.drawingId,
      layoutName: model.layoutName,
      schedules: model.schedules,
      deferrals: model.deferrals,
      families: model.families,
      notes: model.notes,
    };
    expect("kind" in unasked, "this sheet was read without asking the store its space").toBe(false);
    const root = mount({ ...reading, sheets: [unasked] });
    const name = all(root, TESTIDS.schedules.sheetRow)[0]?.querySelector(".cx-schedules-sheet-name") as Element;
    expect(said(name)).toBe(MODEL_SPACE);
  });
});

/* ------------------------------------------------------- I-436: a Band says floors, not a title */

/** The two strip sheets' titles F-RCC6-BNBC stores as its strip families' band text (I-343). */
const FIRST_FLOOR_TITLE = "1ST FLOOR BEAM LONG SECTIONS - TOP, BOTTOM AND EXTRA BARS";
const TYPICAL_TITLE = "TYPICAL FLOOR BEAM LONG SECTIONS (2ND TO 6TH FLOOR)";

/** One family of one variant, handed the band text the store holds and the face the reading gave it. */
function aBandedFamily(mark: string, bandText: string, bandFace: BandFace | null): FamilyView {
  return {
    family: mark,
    markText: mark,
    sourceKeys: [`DXF_HANDLE:${mark}`],
    variants: [{ variantKey: `${mark}:0`, bandText, banded: bandFace !== null, bandFace, sectionText: "300x600", sourceKeys: [`DXF_HANDLE:${mark}:0`], zones: [] }],
  };
}

/** The model space holding a strip family of each sheet, a column family and a beam schedule's family. */
function aStripReading(): SchedulesView {
  const reading = aReading();
  const model: SheetView = {
    ...(reading.sheets[0] as SheetView),
    families: [
      aBandedFamily("1B1", FIRST_FLOOR_TITLE, { from: "1ST", to: "1ST" }),
      aBandedFamily("B1", TYPICAL_TITLE, { from: "2ND", to: "6TH" }),
      aBandedFamily("C1", "GF TO 2ND", { written: "GF TO 2ND" }),
      aBandedFamily("RB1", "SIZE", null),
    ],
  };
  return { ...reading, sheets: [model] };
}

/** The Band cell of one family's first variant row. */
function bandCellOf(root: HTMLElement, family: string): HTMLElement {
  const row = root.querySelector<HTMLElement>(`${testIdSelector(TESTIDS.schedules.family)}[data-family="${family}"] ${testIdSelector(TESTIDS.schedules.variant)}`);
  return row?.querySelector<HTMLElement>(".cx-schedules-at-band") as HTMLElement;
}

describe("I-436: a strip family's Band says the floors its sheet names, never the sheet's title", () => {
  test("the first floor's strips say 1ST and the typical floors' say 2ND TO 6TH, in the string table's own words", () => {
    const root = mount(aStripReading());
    expect(said(bandCellOf(root, "1B1")), "one floor is said once").toBe("1ST");
    expect(said(bandCellOf(root, "B1"))).toBe(SCHEDULES_COPY.schedules_registry_band_span.replace("{from}", "2ND").replace("{to}", "6TH"));
    expect(said(bandCellOf(root, "B1")), "which reads as the drawing's own convention").toBe("2ND TO 6TH");
    for (const family of ["1B1", "B1"]) {
      const row = root.querySelector(`${testIdSelector(TESTIDS.schedules.family)}[data-family="${family}"]`) as Element;
      expect(said(row), `the ${family} row says no word of its sheet's title`).not.toMatch(/LONG SECTIONS/);
    }
  });

  test("a band the schedule wrote as a band is said verbatim, and a beam schedule's header is no band", () => {
    const root = mount(aStripReading());
    expect(said(bandCellOf(root, "C1"))).toBe("GF TO 2ND");
    expect(said(bandCellOf(root, "RB1")), "a Band is a band of floors (I-sch-1(c))").toBe("—");
  });

  test("the title the band was read at stands a hover — or a focus — away, as the drawing shows it", async () => {
    const root = mount(aStripReading());
    const typical = bandCellOf(root, "B1");
    expect(typical.hasAttribute("data-state"), "the composed band is the shipped Tooltip's trigger").toBe(true);
    fireEvent.focus(typical);
    const hint = await screen.findByTestId(TESTIDS.tooltip.content);
    expect(hint.textContent, "and the tooltip says the stored text whole").toContain(TYPICAL_TITLE);
    fireEvent.blur(typical);
    expect(bandCellOf(root, "C1").hasAttribute("data-state"), "a band said as written needs no second telling").toBe(false);
  });
});

/* ------------------------------------------------- I-437: a committed reading says its unit once */

/** A reading the transcribe act keeps as proposed: the grammar's value as written carries its unit. */
const FY_READING: ReadingView = {
  readingKey: "reading-fy",
  drawingId: DRAWING,
  layoutName: "S-01 GENERAL NOTES",
  kind: "FY",
  actorId: "7c2f0b3c-5555-4555-8555-555555555555",
  sourceKey: "DXF_HANDLE:1F3F",
  valueAsWritten: "500 MPa",
  unitAsWritten: "MPa",
  canonical: "500",
  basis: "TRANSCRIBED",
  acceptance: "ACCEPTED",
  scopeClass: null,
  actId: "7c2f0b3c-6666-4666-8666-666666666666",
  superseded: false,
};

describe("I-437: a committed reading says its figure once and its unit once", () => {
  test("the reading row and the inspector say 500 MPa, never 500 MPa MPa", () => {
    const reading = aReading();
    const notes: SheetView = { ...(reading.sheets[1] as SheetView), layoutName: FY_READING.layoutName, notes: { proposals: [], readings: [FY_READING], standings: [] } };
    const root = mount({ ...reading, sheets: [notes] });
    const row = all(root, TESTIDS.schedules.reading)[0] as HTMLElement;
    const figure = row.querySelector(".cx-schedules-mono") as Element;
    expect(said(figure), "canonical + unit (§1's reading row)").toBe("500 MPa");

    fireEvent.click(row);
    const inspector = document.querySelector(testIdSelector(TESTIDS.schedules.inspector)) as HTMLElement;
    expect(inspector, "choosing the reading opens its inspector").not.toBeNull();
    expect(said(inspector.querySelector(".cx-schedules-mono") as Element)).toBe("500 MPa");
  });

  test("a figure the reader kept in the box is said through the format seam, with the unit it was written in", () => {
    const reading = aReading();
    const edited: ReadingView = { ...FY_READING, kind: "HOOK_MIN", valueAsWritten: "1250", unitAsWritten: "mm", canonical: "1250", acceptance: "EDITED" };
    const notes: SheetView = { ...(reading.sheets[1] as SheetView), layoutName: FY_READING.layoutName, notes: { proposals: [], readings: [edited], standings: [] } };
    const root = mount({ ...reading, sheets: [notes] });
    const row = all(root, TESTIDS.schedules.reading)[0] as HTMLElement;
    expect(said(row.querySelector(".cx-schedules-mono") as Element)).toBe("1,250 mm");
  });

  test("a value that stated no figure canonicalises to its own words, and is said as written rather than refused by the format seam", () => {
    const reading = aReading();
    const wordy: ReadingView = { ...FY_READING, kind: "LAP", valueAsWritten: "AS PER CODE", unitAsWritten: "d", canonical: "AS PER CODE", acceptance: "EDITED" };
    const notes: SheetView = { ...(reading.sheets[1] as SheetView), layoutName: FY_READING.layoutName, notes: { proposals: [], readings: [wordy], standings: [] } };
    const root = mount({ ...reading, sheets: [notes] });
    const row = all(root, TESTIDS.schedules.reading)[0] as HTMLElement;
    expect(said(row.querySelector(".cx-schedules-mono") as Element)).toBe("AS PER CODE d");
  });
});

/* ---------------------------------------- I-sch-1(b) as amended: the name keeps its width first */

/** One flex item as the rail row lays it out: its declared `flex`, what its content asks, its floor. */
type FlexItem = { readonly flex: string; readonly content: number; readonly min: number };

/**
 * One line of a flex row, no wrap, resolved as CSS Flexbox's "resolve the flexible lengths" does:
 * each item's base size is its basis (`auto` is its content), free space is shared out by grow
 * factors or taken back by shrink factor × base size, and an item held at its min-width is frozen
 * while the rest are resolved again. jsdom lays nothing out, so the rule is read off the sheet and
 * resolved here — the browser's own paint is the product-review walk's to look at.
 */
function laidOut(container: number, gap: number, items: readonly FlexItem[]): number[] {
  const parsed = items.map((item) => {
    const [grow = "0", shrink = "1", basis = "auto"] = item.flex.trim().split(/\s+/);
    const base = basis === "auto" ? item.content : Number.parseFloat(basis);
    return { grow: Number(grow), shrink: Number(shrink), base, min: item.min };
  });
  const inner = container - gap * (items.length - 1);
  const growing = parsed.reduce((sum, item) => sum + Math.max(item.base, item.min), 0) < inner;
  const size = parsed.map((item) => item.base);
  const frozen = parsed.map((item) => (growing ? item.grow === 0 : item.shrink === 0));
  for (;;) {
    const open = parsed.map((_, at) => at).filter((at) => !frozen[at]);
    if (open.length === 0) break;
    const free = inner - parsed.reduce((sum, item, at) => sum + (frozen[at] ? (size[at] as number) : item.base), 0);
    const weight = (at: number): number => (growing ? (parsed[at]?.grow ?? 0) : (parsed[at]?.shrink ?? 0) * (parsed[at]?.base ?? 0));
    const total = open.reduce((sum, at) => sum + weight(at), 0);
    for (const at of open) size[at] = (parsed[at]?.base ?? 0) + (total === 0 ? 0 : (free * weight(at)) / total);
    const held = open.filter((at) => (size[at] as number) < (parsed[at]?.min ?? 0));
    if (held.length === 0) break;
    for (const at of held) {
      size[at] = parsed[at]?.min ?? 0;
      frozen[at] = true;
    }
  }
  return size;
}

/** A glyph of the rail's caption face, reckoned; the rule is proved over widths, not over a font. */
const CH = 7;

/** A length the sheet states for a rail item's floor, in the reckoned px. */
function floorOf(selector: string): number {
  const value = declaredValue(SHEET, selector, "min-width") ?? "0";
  return value.endsWith("ch") ? Number.parseFloat(value) * CH : Number.parseFloat(value);
}

/** The name and the holdings of one rail row, laid out in the control that chooses the sheet. */
function railRow(control: number, name: string, holds: string): { name: number; holds: number } {
  const [nameWidth = 0, holdsWidth = 0] = laidOut(control, CH, [
    { flex: declaredValue(SHEET, ".cx-schedules-sheet-name", "flex") ?? "", content: name.length * CH, min: floorOf(".cx-schedules-sheet-name") },
    { flex: declaredValue(SHEET, ".cx-schedules-sheet-holds", "flex") ?? "", content: holds.length * CH, min: floorOf(".cx-schedules-sheet-holds") },
  ]);
  return { name: nameWidth, holds: holdsWidth };
}

/** The control's width in the 200 px rail, reckoned: what the rail and the row pad leave of it. */
const CONTROL = 24 * CH;

describe("I-sch-1(b) as amended: the sheet's name gives way last, and what it holds yields first", () => {
  test("the chosen model row keeps Model space whole beside Schedule · Notes · Deferred", () => {
    const row = railRow(CONTROL, "Model space", "Schedule · Notes · Deferred");
    expect(row.name, "the name keeps the width its words ask for").toBe("Model space".length * CH);
    expect(row.holds, "and the holdings take what is left, ellipsised").toBe(CONTROL - CH - "Model space".length * CH);
  });

  test("a name longer than the row takes the row, down to its sheet number, and the holdings yield to nothing", () => {
    const long = railRow(CONTROL, "S-01 GENERAL NOTES (1 OF 2) — SHEET ONE", "Notes");
    expect(long.holds, "the holdings yield their width first").toBe(0);
    expect(long.name, "and the name ellipsises in what the row has").toBe(CONTROL - CH);
    const narrow = railRow(4 * CH, "S-01 GENERAL NOTES (1 OF 2)", "Notes");
    expect(narrow.name, "never below its sheet number (6ch)").toBe(6 * CH);
  });

  test("a short name beside short holdings leaves the holdings their words, at the row's end", () => {
    const row = railRow(CONTROL, "S-11", "Notes");
    expect(row.name).toBe("S-11".length * CH);
    expect(row.holds, "the holdings take the leftover rather than a share of the name").toBeGreaterThanOrEqual("Notes".length * CH);
    expect(declaredValue(SHEET, ".cx-schedules-sheet-holds", "text-align"), "and stand at the row's end").toBe("end");
  });
});

describe("I-551: the page opens on the first sheet holding a schedule, its cells as the drawing shows them", () => {
  /** A notes sheet first in the rail, then S-11 holding a column schedule whose cell writes `%%C`. */
  function aRailOfSheets(): SchedulesView {
    const notes: SheetView = {
      drawingId: DRAWING,
      layoutName: "S-01 GENERAL NOTES (1 OF 2)",
      kind: "paper",
      schedules: [],
      deferrals: [],
      families: [],
      notes: { proposals: [], readings: [], standings: [] },
    };
    const band = (rowIndex: number, text: string) => ({ rowIndex, cells: [{ columnIndex: 0, text, sourceKeys: [`DXF_HANDLE:${String(rowIndex)}`] }] });
    const s11: SheetView = {
      ...notes,
      layoutName: "S-11 COLUMN SCHEDULE",
      schedules: [{ scheduleKey: "DXF_HANDLE:9C6", viewKey: "SCHEDULE:DXF_HANDLE:9C6", title: "COLUMN SCHEDULE", header: band(0, "MARK"), rows: [band(1, "8-16%%C")] }],
    };
    return { projectId: PROJECT, setRevisionId: REVISION, sheets: [notes, s11] };
  }

  test("the rail's first sheet holds only notes, so the page stands on S-11 and shows its column schedule", () => {
    const root = mount(aRailOfSheets());
    const current = all(root, TESTIDS.schedules.sheetRow).filter((row) => row.getAttribute("aria-current") === "true");
    expect(
      current.map((row) => row.getAttribute("data-layout")),
      "the sheet a reader came for is the one chosen",
    ).toEqual(["S-11 COLUMN SCHEDULE"]);
    expect(all(root, TESTIDS.schedules.table).map((table) => table.getAttribute("data-schedule"))).toEqual(["DXF_HANDLE:9C6"]);
    const cells = all(root, TESTIDS.schedules.cell).filter((one) => one.getAttribute("data-row") === "1");
    expect(
      cells.map((one) => said(one)),
      "the diameter sign drawn as Ø, never the DXF's %%C (I-sch-1(a))",
    ).toEqual(["8-16Ø"]);
  });
});
