// @vitest-environment jsdom
/**
 * I-510 — a declared quantity check stands beneath the tables it was read off
 * (docs/design/s-schedules.md §0 I-507/i, §1's schedules region, §2 Partial; R-UI-050, R-UI-020,
 * I-251).
 *
 * F-ARCH's typical door schedule prints D-2 as `08 NOS` against nine D2 tags on the typical plan
 * (T-OPENING-NOS): the partition declares it OPENING_QUANTITY_DISAGREES. What the QS must see is that
 * declaration by name, beside the mark and the cell the schedule prints, with one link that opens the
 * plan on the cell and the tags — and no figure the screen counted. Asserted off the mount of the
 * SHIPPED workspace over the shipped chrome (I-170), the way registry-rows.test.ts mounts it.
 *
 * `.ts`, not `.tsx`: tsconfig typechecks `tests/**\/*.ts`, so the tree is built with `createElement`.
 * Nothing here opens a database and nothing here measures time (AM-10 §3).
 */
import { cleanup, render } from "@testing-library/react";
import { Fragment, createElement, type ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { REFUSALS } from "@/core/errors";
import { SchedulesWorkspace, type SchedulesAddresses, type SchedulesChrome, type SchedulesDoors } from "@/modules/takeoff/schedules-ui";
import type { FamilyView, PrintedView, SchedulesView, SheetView } from "@/modules/takeoff/schedules-ui/view";
import { MODEL_SPACE } from "@/modules/takeoff/schedules-ui/view";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { EvidenceLink } from "@/ui/patterns/evidence-link";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Button, EmptyState, EnumLabel, IdChip, NumberInput, Skeleton, Tooltip, UnitBadge } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { TESTIDS, testIdSelector, type TestId } from "@/ui/testids";
import { installDomStubs } from "../primitives-overlay-data/support/render";

afterEach(cleanup);

const TENANT = "7c2f0b3c-1111-4111-8111-111111111111";
const PROJECT = "7c2f0b3c-2222-4222-8222-222222222222";
const DRAWING = "7c2f0b3c-3333-4333-8333-333333333333";
const REVISION = "7c2f0b3c-4444-4444-8444-444444444444";

/** The typical plan's nine D2 tags — evidence behind the declaration, never a figure on the screen. */
const TAGS = ["523", "529", "52F", "535", "53B", "541", "547", "54D", "553"].map((handle) => `DXF_HANDLE:${handle}`);

/** An opening family of the typical door schedule, carrying what the schedule printed for it. */
function anOpening(mark: string, markText: string, printed: PrintedView): FamilyView {
  return {
    family: mark,
    markText,
    sourceKeys: [`DXF_HANDLE:${mark}`],
    variants: [
      {
        variantKey: "1ST-6TH",
        bandText: "DOOR & WINDOW SCHEDULE (1ST TO 6TH FLOOR)  SCALE 1:50",
        banded: true,
        bandFace: { from: "1ST", to: "6TH" },
        sectionText: "3'-0\" X 7'-0\"",
        sourceKeys: ["DXF_HANDLE:6DD", "DXF_HANDLE:81C"],
        zones: [],
        printed,
      },
    ],
  };
}

/** F-ARCH's model space: D-2 declared against the plan, W-1 read as it stands, V-9 on no stated basis. */
function aReading(): SchedulesView {
  const model: SheetView = {
    drawingId: DRAWING,
    layoutName: MODEL_SPACE,
    kind: MODEL_SPACE,
    schedules: [],
    deferrals: [],
    families: [
      anOpening("D2", "D-2", { text: "08 NOS", sourceKeys: ["DXF_HANDLE:6DE"], refusal: "OPENING_QUANTITY_DISAGREES", planKey: "LAYOUT_PLAN:DXF_HANDLE:81B", tagKeys: TAGS }),
      anOpening("W1", "W-1", { text: "10 NOS", sourceKeys: ["DXF_HANDLE:70F"], refusal: null, planKey: "LAYOUT_PLAN:DXF_HANDLE:81B", tagKeys: ["DXF_HANDLE:5BA"] }),
      anOpening("V9", "V-9", { text: "04 NOS", sourceKeys: ["DXF_HANDLE:72F"], refusal: "OPENING_QUANTITY_BASIS_UNSTATED", planKey: null, tagKeys: [] }),
    ],
    notes: { proposals: [], readings: [], standings: [] },
  };
  return { projectId: PROJECT, setRevisionId: REVISION, sheets: [model] };
}

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

/** What an element SAYS, with raw enums under `data-technical` and the glyphs a reader is spared taken out. */
function said(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  for (const unsaid of Array.from(clone.querySelectorAll('[data-technical], [aria-hidden="true"]'))) unsaid.remove();
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("I-510: a declared quantity check stands beneath the tables", () => {
  test("each declared row stands once, by its mark, its floors and its code — a row read as it stands does not", () => {
    const checks = all(mount(aReading()), TESTIDS.schedules.quantityCheck);
    expect(checks.map((check) => [check.getAttribute("data-family"), check.getAttribute("data-variant"), check.getAttribute("data-code")])).toEqual([
      ["D2", "1ST-6TH", "OPENING_QUANTITY_DISAGREES"],
      ["V9", "1ST-6TH", "OPENING_QUANTITY_BASIS_UNSTATED"],
    ]);
  });

  test("T-OPENING-NOS: the mark and the printed cell as the schedule shows them, then the registered message — and no count the screen took (I-251)", () => {
    const [d2] = all(mount(aReading()), TESTIDS.schedules.quantityCheck);
    const words = said(d2 as HTMLElement);
    expect(words.startsWith("D-2 08 NOS"), `the mark and the cell lead, verbatim: "${words}"`).toBe(true);
    expect(words).toContain(REFUSALS.OPENING_QUANTITY_DISAGREES.message);
    expect(words).toContain(REFUSALS.OPENING_QUANTITY_DISAGREES.remedy);
    expect(words, "the plan's nine tags are evidence behind the link, never a figure beside it").not.toMatch(/\b9\b/u);
  });

  test("the evidence opens the plan on the schedule's cell and every tag of the mark; where no plan was checked it opens the sheet", () => {
    const [d2, v9] = all(mount(aReading()), TESTIDS.schedules.quantityCheck);
    const link = (d2 as HTMLElement).querySelector("a");
    expect(link?.textContent).toContain("Open the plan");
    expect(link?.getAttribute("href")).toBe(`/t/${TENANT}/p/${PROJECT}/viewer/${DRAWING}/${MODEL_SPACE}?s=${["DXF_HANDLE:6DE", ...TAGS].join(",")}`);
    expect((v9 as HTMLElement).querySelector("a")?.textContent).toContain("Open the sheet");
  });

  test("the sheet reads partial while a declared check stands, and ready when none does (§2)", () => {
    const root = mount(aReading());
    expect(root.getAttribute("data-state")).toBe("partial");
    cleanup();
    const settled = aReading();
    const sheet = settled.sheets[0] as SheetView;
    const agreeing = sheet.families.map((family) => ({
      ...family,
      variants: family.variants.map((variant) => (variant.printed === undefined ? variant : { ...variant, printed: { ...variant.printed, refusal: null } })),
    }));
    const quiet = mount({ ...settled, sheets: [{ ...sheet, families: agreeing }] });
    expect(all(quiet, TESTIDS.schedules.quantityCheck)).toEqual([]);
    expect(quiet.getAttribute("data-state")).toBe("ready");
  });
});
