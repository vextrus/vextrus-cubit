// @vitest-environment jsdom
/**
 * I-563 — a door that would change nothing is shut with its reason (docs/design/s-schedules.md
 * I-255 as amended, docs/design/consequence-dialog.md DLG-2; walk-1 N2).
 *
 * Walk-1 opened S-01's general notes where every proposal read "Already read at this figure", pressed
 * "Preview these readings", and was answered ACT_CHANGES_NOTHING with a link to the participants
 * screen — which has nothing to do with notes. The door is now shut, naming why, exactly when every
 * row says it; and a refusal at this door that is not a permission links the sheet, never the
 * participants screen.
 *
 * Asserted off the mount of the SHIPPED workspace over the shipped chrome (I-170), with a Tooltip that
 * publishes its content so the reason a shut door gives is readable without a pointer.
 * `.ts`, not `.tsx`: tsconfig typechecks `tests/**\/*.ts`, so the tree is built with `createElement`.
 */
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Fragment, createElement, type ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { REFUSALS } from "@/core/errors";
import { refusal } from "@/core/faults/refusal-marker";
import { SchedulesWorkspace, type SchedulesAddresses, type SchedulesChrome, type SchedulesDoors } from "@/modules/takeoff/schedules-ui";
import { SCHEDULES_COPY } from "@/modules/takeoff/schedules-ui/copy";
import type { ProposalView, ReadingView, SchedulesView, SheetView } from "@/modules/takeoff/schedules-ui/view";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { EvidenceLink } from "@/ui/patterns/evidence-link";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Button, EmptyState, EnumLabel, IdChip, NumberInput, Skeleton, UnitBadge } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { TESTIDS, testIdSelector } from "@/ui/testids";
import { installDomStubs } from "../primitives-overlay-data/support/render";

afterEach(cleanup);

const TENANT = "7c2f0b3c-1111-4111-8111-111111111111";
const PROJECT = "7c2f0b3c-2222-4222-8222-222222222222";
const DRAWING = "7c2f0b3c-3333-4333-8333-333333333333";
const REVISION = "7c2f0b3c-4444-4444-8444-444444444444";
const LAYOUT = "S-01 GENERAL NOTES";

/** Two figures S-01's notes offer: the steel grade and the concrete strength. */
const FY: ProposalView = {
  kind: "FY",
  sourceKey: "DXF_HANDLE:1F3F",
  text: "REINFORCEMENT: fy = 500 MPa",
  valueAsWritten: "500 MPa",
  unitAsWritten: "MPa",
  canonical: "500",
  proposedBy: "grammar",
  callId: null,
  governs: null,
};
const FC: ProposalView = { ...FY, kind: "FC", sourceKey: "DXF_HANDLE:1F40", text: "CONCRETE: f'c = 25 MPa", valueAsWritten: "25 MPa", canonical: "25" };

/** A reading committed at the proposal's own figure — what makes its row say "Already read at this figure". */
function readAt(proposal: ProposalView, at: number): ReadingView {
  return {
    readingKey: `reading-${proposal.kind}`,
    drawingId: DRAWING,
    layoutName: LAYOUT,
    kind: proposal.kind,
    actorId: "7c2f0b3c-5555-4555-8555-555555555555",
    sourceKey: proposal.sourceKey,
    valueAsWritten: proposal.valueAsWritten,
    unitAsWritten: proposal.unitAsWritten,
    canonical: proposal.canonical,
    basis: "TRANSCRIBED",
    acceptance: "ACCEPTED",
    actId: `7c2f0b3c-6666-4666-8666-66666666666${String(at)}`,
    superseded: false,
  };
}

function aReading(readings: ReadingView[]): SchedulesView {
  const sheet: SheetView = {
    drawingId: DRAWING,
    layoutName: LAYOUT,
    kind: "paper",
    schedules: [],
    deferrals: [],
    families: [],
    notes: { proposals: [FY, FC], readings, standings: [] },
  };
  return { projectId: PROJECT, setRevisionId: REVISION, sheets: [sheet] };
}

const ADDRESSES: SchedulesAddresses = {
  selection: (sheet, sourceKeys) => `/t/${TENANT}/p/${PROJECT}/viewer/${sheet.drawingId}/${sheet.layoutName}?s=${sourceKeys.join(",")}`,
  drawings: `/t/${TENANT}/p/${PROJECT}/drawings`,
  participants: `/t/${TENANT}/p/${PROJECT}/settings/participants`,
};

/** A Tooltip that publishes what it would say, so a shut door's reason is read without a pointer. */
function Tooltip({ content, children }: { content: ReactNode; children?: ReactNode }): ReactNode {
  return createElement("span", { "data-tooltip": typeof content === "string" ? content : "" }, children ?? null);
}

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
  Tooltip: Tooltip as SchedulesChrome["Tooltip"],
  TabsAside: () => null,
  InspectorMount: ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children ?? null),
};

/** The workspace over one reading, with the preview door answering as the caller says. */
function mount(view: SchedulesView, preview: SchedulesDoors["previewTranscribeSheetNotes"]): HTMLElement {
  installDomStubs();
  const doors: SchedulesDoors = {
    schedules: () => Promise.resolve(view),
    previewTranscribeSheetNotes: preview,
    commitTranscribeSheetNotes: () => Promise.reject(new Error("this suite commits nothing")),
  };
  const { container } = render(
    createElement(SchedulesWorkspace, { view, tenantId: TENANT, projectId: PROJECT, permitted: { MEASURE: true }, offline: false, chrome: CHROME, doors, addresses: ADDRESSES }),
  );
  return container;
}

function door(root: ParentNode): HTMLElement {
  const found = root.querySelector<HTMLElement>(testIdSelector(TESTIDS.schedules.transcribe));
  expect(found, "the notes panel offers its one door").not.toBeNull();
  return found as HTMLElement;
}

const neverAsked: SchedulesDoors["previewTranscribeSheetNotes"] = () => Promise.reject(new Error("a shut door asks the seam nothing"));

describe("I-563: the door that would record nothing is shut, naming why", () => {
  test("every row already read at its figure: the door is shut with its reason, and a press asks the seam nothing", () => {
    let asked = 0;
    const root = mount(aReading([readAt(FY, 1), readAt(FC, 2)]), () => {
      asked += 1;
      return neverAsked({ input: undefined as never });
    });
    const shut = door(root);
    expect(shut.getAttribute("aria-disabled")).toBe("true");
    expect(shut.getAttribute("data-shut")).toBe("moves-nothing");
    expect(shut.hasAttribute("data-permission"), "the reader holds MEASURE, so the door claims no missing permission").toBe(false);
    expect(shut.closest("[data-tooltip]")?.getAttribute("data-tooltip"), "the reason is the door's own words").toBe(SCHEDULES_COPY.schedules_transcribe_nothing);
    fireEvent.click(shut);
    expect(asked, "nothing is previewed").toBe(0);
  });

  test("one row not yet read: the door is open", () => {
    const root = mount(aReading([readAt(FY, 1)]), neverAsked);
    const open = door(root);
    expect(open.tagName).toBe("BUTTON");
    expect(open.hasAttribute("data-shut")).toBe(false);
  });

  test("a reader who changes a value opens the door again: another figure is a reading to record", () => {
    const root = mount(aReading([readAt(FY, 1), readAt(FC, 2)]), neverAsked);
    expect(door(root).getAttribute("data-shut")).toBe("moves-nothing");
    const [box] = Array.from(root.querySelectorAll<HTMLInputElement>(`${testIdSelector(TESTIDS.schedules.proposalValue)}, ${testIdSelector(TESTIDS.schedules.proposalValue)} input`)).filter(
      (element) => element.tagName === "INPUT",
    );
    expect(box, "the first proposal's value box").toBeDefined();
    fireEvent.change(box as HTMLInputElement, { target: { value: "415" } });
    expect(door(root).tagName, "the door opens on an edited figure").toBe("BUTTON");
  });
});

describe("I-563: a refusal at this door links where it is resolved", () => {
  test("ACT_CHANGES_NOTHING — the seam's word where the rows did not already say it — links the sheet, not the participants screen", async () => {
    const root = mount(aReading([readAt(FY, 1)]), () => Promise.reject(refusal("ACT_CHANGES_NOTHING", "the readings stand already")));
    fireEvent.click(door(root));
    const card = await waitFor(() => {
      const found = root.querySelector<HTMLElement>(testIdSelector(TESTIDS.refusal.state));
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    expect(card.textContent).toContain(REFUSALS.ACT_CHANGES_NOTHING.message);
    const link = card.querySelector<HTMLAnchorElement>(testIdSelector(TESTIDS.refusal.evidenceLink));
    expect(link?.textContent).toBe("Open the sheet");
    expect(link?.getAttribute("href")).toBe(ADDRESSES.selection({ drawingId: DRAWING, layoutName: LAYOUT }, [FY.sourceKey, FC.sourceKey]));
    expect(card.textContent, "the participants screen has nothing to do with notes").not.toContain("participants");
  });

  test("PERMISSION_NOT_HELD still links the participants screen, where a permission is granted", async () => {
    const root = mount(aReading([readAt(FY, 1)]), () => Promise.reject(refusal("PERMISSION_NOT_HELD", "no MEASURE")));
    fireEvent.click(door(root));
    const link = await waitFor(() => {
      const found = root.querySelector<HTMLAnchorElement>(`${testIdSelector(TESTIDS.refusal.state)} ${testIdSelector(TESTIDS.refusal.evidenceLink)}`);
      expect(found).not.toBeNull();
      return found as HTMLAnchorElement;
    });
    expect(link.getAttribute("href")).toBe(ADDRESSES.participants);
  });
});
