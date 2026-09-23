// @vitest-environment jsdom
/**
 * s-audit I-38 as amended (session 7): an act's cited subjects are read by what their keys name,
 * through ONE presenter shared with S-Project's subject column. The craft look found the evidence
 * column showing whole uuids, DXF handles and coordinates cut mid-glyph, INSERT_LEVEL as seven chips
 * "0 1 2 3 4 5 6", and a 27-column act with no count — identifiers as body text (R-UI-082) and silent
 * loss (R-UI-083).
 *
 * The keys below are the schemes the act seam records, spelled as the M3 journey's store holds them.
 */
import { createElement } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NO_SUBJECT_NAMES, namesAskedBy, parseSubject, type SubjectNames } from "../../../src/modules/spine/audit/subjects";
import { ACTOR_COLUMN_WIDTH, SUBJECT_CAP, SubjectChips, presentSubject, subjectAnswers } from "../../../src/app/(app)/t/[tenant]/p/[project]/audit/subject-chips";
import { ActLogExplorer } from "../../../src/app/(app)/t/[tenant]/p/[project]/audit/act-log-explorer";
import { auditStrings } from "../../../src/app/(app)/t/[tenant]/p/[project]/audit/strings";
import type { AuditAct } from "../../../src/modules/spine/audit";
import { TESTIDS } from "../../../src/ui/testids";
import { acts as stageActs, copy, homeData, homeStrings, mountHome, projectHome } from "../project-home/support/project-home-stage";

/** The chips mounted bare carry the evidence cell's own hook, as S-Audit mounts them. */
const CHIPS = TESTIDS.audit.actEvidence;

const GF = "65a04157-77d4-4626-9530-80f2fe00b541";
const ACTOR = "39c29698-7aaa-4bbb-8ccc-1234567890ab";
const DRAWING = "50cef7a1-1905-47b5-8560-59b84aff407a";
const INGEST = "9d8c7b6a-1111-4222-8333-444455556666";

const PLACEMENT_UNRESOLVED = "v:LAYOUT_PLAN:DXF_HANDLE:20B6|C1|1200000.0,-400000.0@UNRESOLVED";
const PLACEMENT_ON_GF = `v:LAYOUT_PLAN:DXF_HANDLE:20B6|C1|1200000.0,-400000.0@${GF}`;
const PLACEMENT_C10 = `v:LAYOUT_PLAN:DXF_HANDLE:20B6|C10|1500000.0,-400000.0@${GF}`;
/**
 * One view, in the two spellings an act cites a view by (s-audit I-347): L-REG-04's identity key, and
 * the partition's own key that `partitionViewKey` writes, the views stage stores a caption under and
 * AFFIRM_SCALE and CONFIRM_VIEW_TYPE cite. The identity key is the partition's key under `v:`.
 */
const VIEW_PARTITION = "LAYOUT_PLAN:DXF_HANDLE:1B04";
const VIEW = `v:${VIEW_PARTITION}`;
const DETAIL_VIEW = "DETAIL:DXF_HANDLE:2266";
const NOTE = `note:${DRAWING}|S-02 GENERAL NOTES|LAP|${ACTOR}|DXF_HANDLE:2A1`;
const STOREY = `h:${GF}|${ACTOR}|TRANSCRIBED|DXF_HANDLE:3C2`;
const SHEET = `${INGEST}:S-00 COVER, DRAWING INDEX & KEY PLAN`;
/** Model space, as CONFIRM_DISCIPLINE cites it: the artifact's name for the layout is `model`. */
const MODEL_SPACE_SHEET = `${INGEST}:model`;

/** The names as `getAuditSurfaces` answers them — a view's caption under the key the store holds it by. */
const NAMES: SubjectNames = {
  levels: { [GF]: "GF" },
  drawings: { [DRAWING]: "BASHUNDHARA-G+6.dwg" },
  views: { [VIEW_PARTITION]: "COLUMN LAYOUT PLAN", [DETAIL_VIEW]: "SEPTIC TANK DETAIL" },
  people: { [ACTOR]: "rafiq@cubit.test" },
};

afterEach(cleanup);

describe("the one presenter over the act log's key schemes", () => {
  test("a placement reads by its mark and the level it stands on; an unresolved level says nothing", () => {
    expect(presentSubject(PLACEMENT_ON_GF, NAMES)).toBe("C1 · GF");
    expect(presentSubject(PLACEMENT_UNRESOLVED, NAMES)).toBe("C1");
  });

  test("a note reading reads by its kind and the sheet number its layout leads with", () => {
    expect(presentSubject(NOTE, NAMES)).toBe("LAP · S-02");
  });

  test("a storey-height reading reads by its level, a view by its caption, a sheet by its number", () => {
    expect(presentSubject(STOREY, NAMES)).toBe("GF");
    expect(presentSubject(VIEW, NAMES)).toBe("COLUMN LAYOUT PLAN");
    expect(presentSubject(VIEW, NO_SUBJECT_NAMES), "with no caption known, the view's class in words").toBe("Layout plan");
    expect(presentSubject(SHEET, NAMES)).toBe("S-00");
  });

  test("a level INSERT_LEVEL proposed reads as the proposal it is — never as a bare ordinal", () => {
    expect(presentSubject("proposed:0", NAMES)).toBe("Proposed level 1");
    expect(presentSubject("proposed:6", NAMES)).toBe("Proposed level 7");
  });

  test("a bare surrogate reads by what the store names it; one it cannot name keeps the chip's own short form", () => {
    expect(presentSubject(GF, NAMES)).toBe("GF");
    expect(presentSubject(DRAWING, NAMES)).toBe("BASHUNDHARA-G+6.dwg");
    expect(presentSubject(ACTOR, NAMES)).toBe("rafiq@cubit.test");
    expect(presentSubject("aaaaaaaa-0000-4000-8000-000000000001", NAMES)).toBeUndefined();
    expect(parseSubject("SOMETHING_ELSE").scheme).toBe("opaque");
  });

  test("I-347: a view reads by its caption in either spelling an act cites it in, and both ask the store one key", () => {
    // The craft re-look: AFFIRM_SCALE's evidence read "DETAIL:" "DETAIL:" "LAYOUT_" +7 — the
    // partition's own key fell through to the chip's first seven characters.
    expect(parseSubject(DETAIL_VIEW)).toEqual({ scheme: "view", viewKey: DETAIL_VIEW, viewClass: "DETAIL" });
    expect(presentSubject(DETAIL_VIEW, NAMES), "the partition's spelling reads by its caption").toBe("SEPTIC TANK DETAIL");
    expect(presentSubject(DETAIL_VIEW, NO_SUBJECT_NAMES), "and with no caption known, by its class in words").toBe("Detail");
    expect(parseSubject(VIEW), "the identity spelling is the same view, keyed as the store keys it").toEqual(parseSubject(VIEW_PARTITION));
    expect(presentSubject(VIEW_PARTITION, NAMES)).toBe(presentSubject(VIEW, NAMES));
    expect(parseSubject(PLACEMENT_ON_GF), "a placement's view is keyed the same way").toMatchObject({ scheme: "placement", viewKey: "LAYOUT_PLAN:DXF_HANDLE:20B6" });

    const asked = namesAskedBy([VIEW, VIEW_PARTITION, DETAIL_VIEW, PLACEMENT_ON_GF]);
    expect([...asked.viewKeys].sort(), "the store is asked for each view once, by the key its captions are held under").toEqual([DETAIL_VIEW, VIEW_PARTITION].sort());
  });

  test("I-347: a bare source key, a lower-case head or a class with no anchor is no view", () => {
    expect(parseSubject("DXF_HANDLE:2A0").scheme, "a source key alone names an entity, not a view").toBe("opaque");
    expect(parseSubject("detail:DXF_HANDLE:2266").scheme).toBe("opaque");
    expect(parseSubject("v:").scheme).toBe("opaque");
    expect(parseSubject(`${INGEST}:S-03 FOUNDATION PLAN`).scheme, "a sheet key leads with a lower-case uuid, never a class").toBe("sheet");
  });

  test("I-347: model space reads as the space it is, never as its layout's name `model`", () => {
    expect(parseSubject(MODEL_SPACE_SHEET)).toMatchObject({ scheme: "sheet", modelSpace: true });
    expect(presentSubject(MODEL_SPACE_SHEET, NAMES)).toBe("Model space");
    expect(parseSubject(SHEET)).toMatchObject({ scheme: "sheet", modelSpace: false });
  });

  test("the subject filter finds a pasted key whole, or a presented fact whole — never a fragment", () => {
    expect(subjectAnswers(PLACEMENT_ON_GF, NAMES, PLACEMENT_ON_GF), "a pasted key matches itself (I-32)").toBe(true);
    expect(subjectAnswers(PLACEMENT_ON_GF, NAMES, "c1"), "a mark, whole and in any case").toBe(true);
    expect(subjectAnswers(PLACEMENT_C10, NAMES, "C1"), "C1 is not C10 — facts compare whole (I-26)").toBe(false);
    expect(subjectAnswers(NOTE, NAMES, "LAP")).toBe(true);
    expect(subjectAnswers(NOTE, NAMES, "LA"), "a fragment of a fact finds nothing").toBe(false);
  });
});

describe("the chips: at most three, then a count, and nothing lost", () => {
  test("27 cited subjects show three chips and +24, and every key stays in the DOM", () => {
    const subjects = Array.from({ length: 27 }, (_, at) => `v:LAYOUT_PLAN:DXF_HANDLE:20B6|C${String(at + 1)}|${String(at)}.0,0.0@${GF}`);
    render(createElement(SubjectChips, { subjects, names: NAMES, "data-testid": CHIPS }));

    const chips = screen.getByTestId(CHIPS);
    expect(within(chips).getAllByTestId(TESTIDS.idChip.root), `the row shows ${String(SUBJECT_CAP)} chips`).toHaveLength(SUBJECT_CAP);
    expect(chips.textContent ?? "", "the chips read by mark and level").toContain("C1 · GF");
    expect(chips.textContent ?? "", "and the rest are counted, never silently dropped (R-UI-083)").toContain("+24");
    const cited = [...chips.querySelectorAll("[data-value]")].map((element) => element.getAttribute("data-value"));
    for (const subject of subjects) expect(cited, "every cited key is still on the page").toContain(subject);
  });

  test("three or fewer subjects fold nothing", () => {
    render(createElement(SubjectChips, { subjects: [NOTE, STOREY], names: NAMES, "data-testid": CHIPS }));
    expect(screen.getByTestId(CHIPS).textContent ?? "").not.toMatch(/\+\d/);
  });

  test("I-347: subjects that read the same are ONE chip with a count, and every key stays in the DOM", () => {
    // The craft re-look: AUTHOR_TYPICAL_RANGE read "C1 · C1 · C1 +24" — its placeholders stand at the
    // unresolved slot, so each reads by its mark alone, and three chips of one word read as a bug.
    const at = (mark: string, x: number): string => `v:LAYOUT_PLAN:DXF_HANDLE:20B6|${mark}|${String(x)}.0,0.0@UNRESOLVED`;
    const subjects = [at("C1", 1), at("C1", 2), at("C2", 3), at("C1", 4), at("C3", 5), at("C4", 6), at("C4", 7), at("C5", 8)];
    render(createElement(SubjectChips, { subjects, names: NAMES, "data-testid": CHIPS }));

    const chips = screen.getByTestId(CHIPS);
    const shown = within(chips).getAllByTestId(TESTIDS.idChip.root);
    expect(shown.map((chip) => chip.querySelector(".cx-id-chip-value")?.textContent), "one chip per NAME, in the order each was first cited").toEqual(["C1 ×3", "C2", "C3"]);
    expect(shown[0]?.getAttribute("data-value"), "the folded chip's value is the first key it stands for").toBe(subjects[0]);
    expect(chips.textContent ?? "", "the +k counts the SUBJECTS past the cap — C4 twice and C5 once").toContain("+3");
    expect(chips.getAttribute("data-count"), "and the row still states every subject it cites").toBe(String(subjects.length));
    const cited = [...chips.querySelectorAll("[data-value]")].map((element) => element.getAttribute("data-value"));
    for (const subject of subjects) expect(cited, `every cited key is still on the page: ${subject}`).toContain(subject);
    expect(new Set(cited).size, "each key once — a folded key is not drawn twice").toBe(subjects.length);
  });

  test("I-427: every chip shown gives up width alike — none is singled out to be squeezed to a glyph", () => {
    // The re-look at 1280: the Affirm-scale row's LAST chip, the one I-347 let shrink, read "R…" — a
    // chip that says nothing — while the two before it kept their whole 24 characters.
    const proposed = Array.from({ length: 7 }, (_, index) => `proposed:${String(index)}`);
    render(createElement(SubjectChips, { subjects: proposed, names: NAMES, "data-testid": CHIPS }));
    const shown = within(screen.getByTestId(CHIPS)).getAllByTestId(TESTIDS.idChip.root);
    expect(
      shown.map((chip) => chip.className),
      "each chip is measured by the one rule every chip shares",
    ).toEqual(Array.from({ length: SUBJECT_CAP }, () => "cx-id-chip cx-subject-chip"));
  });

  test("I-427: the count stands OUTSIDE the one box that clips, so a short cell takes width from the chips and never the count", () => {
    // The re-look at 1280: the `+7` sat last inside the clipping chip row and was cut off the cell
    // whole — seven of ten subjects hidden with no sign they existed (s-audit I-347, R-UI-083).
    const subjects = Array.from({ length: 10 }, (_, at) => `v:LAYOUT_PLAN:DXF_HANDLE:20B6|C${String(at + 1)}|${String(at)}.0,0.0@${GF}`);
    render(createElement(SubjectChips, { subjects, names: NAMES, "data-testid": CHIPS }));
    const row = screen.getByTestId(CHIPS);
    const clipping = row.querySelector(".cx-subject-chips-shown");
    expect(clipping, "the chips stand in a box of their own").not.toBeNull();
    expect(clipping?.parentElement, "which is the row's own child").toBe(row);
    expect(within(clipping as HTMLElement).getAllByTestId(TESTIDS.idChip.root), "every chip shown is inside it").toHaveLength(SUBJECT_CAP);

    const count = row.querySelector(".cx-subject-chips-more");
    expect(count?.textContent ?? "", "the row counts the seven subjects it folds").toMatch(/^\+7/);
    expect(count?.closest(".cx-subject-chips-shown"), "the count is not inside the box that clips").toBeNull();
    expect(count?.parentElement, "it stands beside the chips, a child of the row itself").toBe(row);
    expect([...row.children].at(-1), "last in the row, after the chips").toBe(count);
  });
});

describe("the act log reads act types in words and actors by the roster (I-38 as amended)", () => {
  const acts: readonly AuditAct[] = [
    {
      actId: "act-1",
      actType: "AUTHOR_TYPICAL_RANGE",
      actorId: ACTOR,
      actorLabel: "rafiq@cubit.test",
      subjects: [PLACEMENT_ON_GF, PLACEMENT_C10],
      consequenceDigest: "a".repeat(64),
      occurredAt: new Date(2026, 8, 23, 14, 0, 0),
    },
    {
      actId: "act-2",
      actType: "TRANSCRIBE_SHEET_NOTES",
      actorId: ACTOR,
      actorLabel: "rafiq@cubit.test",
      subjects: [NOTE],
      consequenceDigest: "b".repeat(64),
      occurredAt: new Date(2026, 8, 23, 13, 0, 0),
    },
  ];

  test("the act type is its words, with the stored value kept on the row", () => {
    render(createElement(ActLogExplorer, { acts, names: NAMES }));
    const [first] = screen.getAllByTestId(TESTIDS.audit.actRow);
    expect(first?.getAttribute("data-act-type")).toBe("AUTHOR_TYPICAL_RANGE");
    expect(within(first as HTMLElement).getByText("Author typical range"), "the row says the act in words (R-UI-083)").toBeDefined();
    expect(within(first as HTMLElement).getByText("rafiq@cubit.test"), "and the actor by the roster's label").toBeDefined();
    expect(within(first as HTMLElement).getByTestId(TESTIDS.audit.actEvidence).textContent ?? "").toContain("C10 · GF");
  });

  test("the act-type filter offers the same words, and a typed mark filters by what the chips read", async () => {
    const user = userEvent.setup();
    render(createElement(ActLogExplorer, { acts, names: NAMES }));

    await user.click(screen.getByTestId(TESTIDS.audit.filterType));
    const options = within(screen.getByTestId(`${TESTIDS.audit.filterType}-listbox`)).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["All act types", "Author typical range", "Transcribe sheet notes"]);
    await user.keyboard("{Escape}");

    await user.type(screen.getByTestId(TESTIDS.audit.filterSubject), "LAP");
    expect(screen.getAllByTestId(TESTIDS.audit.actRow).map((row) => row.getAttribute("data-act-type"))).toEqual(["TRANSCRIBE_SHEET_NOTES"]);
  });

  test("I-428: one person, one width — the Actor column is as wide as S-Project's Who, where an address reads whole", async () => {
    // The re-look: Actor at 220 cut every row to "j000-legs-mudw5e1talb7@cubit.…" while S-Project's Who,
    // widened to 280 by its I-147 for exactly this, showed the same address whole (B-17).
    const columnWidth = (root: HTMLElement, header: string): string | undefined =>
      ([...root.querySelectorAll('[role="columnheader"]')] as HTMLElement[]).find((head) => (head.textContent ?? "").trim() === header)?.style.width;

    const audit = render(createElement(ActLogExplorer, { acts, names: NAMES }));
    const actor = columnWidth(audit.container, auditStrings.audit_col_actor);
    audit.unmount();

    const project = mountHome(await projectHome(), homeData({ recentActs: stageActs(1) }));
    const who = columnWidth(project, copy(await homeStrings(), "project_home_col_who"));

    expect(who, "S-Project's Who column, as its I-147 widened it").toBe(`${String(ACTOR_COLUMN_WIDTH)}px`);
    expect(actor, "S-Audit's Actor column is the same width").toBe(who);
  });

  test("I-428: at 1280 the log's column floors leave a classic scrollbar inside the band, so the grid never scrolls sideways past the count", async () => {
    // The wave's review: with Actor at 280 and Cited evidence's floor at 420 the floors summed to
    // 1,180 of 1,184 — 4 px of slack, which held only where scrollbars take no width (every headless
    // capture). A headed window at 1280 whose shell-main scrolls loses 15–17 px to a classic
    // scrollbar, and the log scrolled sideways by 11–13 px with its `+k` cut at the grid's edge.
    // The band is 1280 − the 48 px rail − shell-main's 24 + 24 padding; the widest classic scrollbar
    // (Chromium on Windows) is 17. S-Project's activity table shares the Who width, so it is held too.
    const BAND_AT_1280 = 1280 - 48 - 24 * 2;
    const CLASSIC_SCROLLBAR = 17;
    /** The widths the header row holding `header` draws its columns at, in px, as the DataTable states them. */
    const headerWidths = (root: HTMLElement, header: string): number[] => {
      const heads = [...root.querySelectorAll('[role="columnheader"]')] as HTMLElement[];
      const row = heads.find((head) => (head.textContent ?? "").trim() === header)?.closest('[role="row"]');
      expect(row, `a header row holds "${header}"`).toBeTruthy();
      return ([...(row as Element).querySelectorAll('[role="columnheader"]')] as HTMLElement[]).map((head) => {
        const width = /^(\d+)px$/.exec(head.style.width)?.[1];
        expect(width, `every column states its width in px ("${(head.textContent ?? "").trim()}")`).toBeDefined();
        return Number(width);
      });
    };
    const sum = (widths: readonly number[]): number => widths.reduce((total, width) => total + width, 0);

    const audit = render(createElement(ActLogExplorer, { acts, names: NAMES }));
    const log = headerWidths(audit.container, auditStrings.audit_col_actor);
    audit.unmount();
    expect(log, "the log's five columns").toHaveLength(5);
    expect(sum(log) + CLASSIC_SCROLLBAR, "the log's floors and a scrollbar fit the band at 1280").toBeLessThanOrEqual(BAND_AT_1280);

    const project = mountHome(await projectHome(), homeData({ recentActs: stageActs(1) }));
    const activity = headerWidths(project, copy(await homeStrings(), "project_home_col_who"));
    expect(activity, "S-Project's four activity columns").toHaveLength(4);
    expect(sum(activity) + CLASSIC_SCROLLBAR, "S-Project's activity floors and a scrollbar fit the band at 1280").toBeLessThanOrEqual(BAND_AT_1280);
  });
});
