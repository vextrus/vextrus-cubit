// @vitest-environment jsdom
/**
 * I-353 (b)(c) — the member-type registry reads as a registry: ONE grid headed once, every variant
 * one row whose cells stand under their column's name, and the rail says the model space in words
 * (docs/design/s-schedules.md §0 I-353, §1's registry region; R-UI-082, R-UI-084).
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
import { cleanup, render } from "@testing-library/react";
import { Fragment, createElement, type ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { SchedulesWorkspace, type SchedulesAddresses, type SchedulesChrome, type SchedulesDoors } from "@/modules/takeoff/schedules-ui";
import { SCHEDULES_COPY } from "@/modules/takeoff/schedules-ui/copy";
import type { FamilyView, SchedulesView, SheetView } from "@/modules/takeoff/schedules-ui/view";
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
      expect(wraps, `${selector} states no wrap (R-UI-084)`).toEqual([]);
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
