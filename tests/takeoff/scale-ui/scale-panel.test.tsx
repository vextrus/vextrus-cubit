// @vitest-environment jsdom
/**
 * AC-1, AC-2's screen half and AC-4 — the shipped `ViewerScreen` mounted over a supplied head and the
 * scale region's three doors supplied as stand-ins, driven the way a reader drives it: the scale tab
 * pressed, Alt+click picks taken on the sheet, a distance entered, a member checked and the one act
 * confirmed (R-TO-020, R-UI-021, L-MEA-05, docs/design/s-scale.md §1).
 *
 * What is judged is what a journey and an operator read: the test ids the contract closes, the `data-`
 * hooks it names and the copy this panel's own table carries. Nothing here reads product source, and
 * nothing freezes a roster: every row, proposal and figure expectation is derived from the door answer
 * under test and from the engine's own law, so a fixture carrying another view grows the expectation
 * with it (B-19).
 */
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import {
  AFFIRMED,
  AFFIRM_SCALE,
  FILE_UNITS,
  OBSERVED_METRES,
  OBSERVED_UNIT,
  PROJECT,
  RANK_COPY_KEY,
  TESTID,
  TOLERANCES,
  UNVERIFIED,
  VERIFIED,
  VIEW_P,
  affirmedView,
  cell,
  cells,
  choose,
  copy,
  doorsOver,
  fillIn,
  hook,
  keyPointOf,
  mountScaleScreen,
  openScalePanel,
  overlayOf,
  picksTaken,
  pick,
  press,
  productModule,
  readAnswer,
  refusalEntry,
  rowFor,
  scaleCore,
  stagedViews,
  unmountScale,
  viewRows,
  within,
  type Point,
  type ProposalLike,
  type ViewScaleLike,
} from "./support/scale-support";

/**
 * The viewer seam the screen reaches through reads a record before it builds, so its module graph
 * reaches the store. Nothing here opens a connection, but the address must be stated before the
 * import so the pool is constructed rather than refused as unconfigured.
 */
process.env["DATABASE_URL"] ??= "postgresql://cubit_app:cubit_app@127.0.0.1:5544/postgres";

/** The two ends of the horizontal calibration line of the staged plan — both inside one view. */
const FROM: Point = [0, 0];
const TO: Point = [100, 0];

afterEach(() => {
  unmountScale();
});

/** The mounted panel over one door answer, with the partition of the same sheet under it. */
async function panelOver(views: readonly ViewScaleLike[]) {
  const doors = doorsOver([readAnswer(views)]);
  const mount = await mountScaleScreen({ scale: doors, overlay: overlayOf(views) });
  await openScalePanel(mount);
  return { mount, doors };
}

describe("AC-1: the panel is one row per view the door answered, each at its own state and with its ranked proposals", () => {
  test("AC-1: pressing the scale tab shows a row per answered view, in the door's order, at the door's state", async () => {
    const views = await stagedViews();
    const { mount } = await panelOver(views);

    const rows = viewRows(mount);
    expect(rows.length, "one row per view the door answered — a sheet with views is never an empty panel (R-UI-020)").toBe(views.length);
    expect(rows.length, "and the staged sheet does hold views to answer for").toBeGreaterThan(0);
    expect(
      rows.map((row) => hook(row, "data-view-key")),
      "in the order the door answered them: this panel sorts nothing (Decision §1)",
    ).toEqual(views.map((view) => view.viewKey));

    for (const view of views) {
      const row = rowFor(mount, view.viewKey);
      const owed = view.affirmed === null ? (view.refusal as string) : AFFIRMED;
      expect(hook(row, "data-state"), `${view.viewKey} publishes the state the door answered — affirmed, or the absence code by name (L-MEA-05)`).toBe(owed);
      const entry = view.affirmed === null ? await refusalEntry(view.refusal as string) : null;
      if (entry !== null) {
        expect(row.textContent ?? "", `${view.viewKey} says what the register writes for ${entry.code} rather than falling silent (R-UI-020, I-154)`).toContain(entry.message);
        expect(row.textContent ?? "", "and the remedy that resolves it").toContain(entry.remedy);
      }
    }
  });

  test("AC-1: every unaffirmed row lists the door's proposals in its own order, whole", async () => {
    const views = await stagedViews();
    const { mount } = await panelOver(views);

    for (const view of views) {
      const row = rowFor(mount, view.viewKey);
      const rendered = within(row, TESTID.proposal);
      expect(rendered.length, `${view.viewKey} lists every proposal the door answered for it`).toBe(view.proposals.length);

      for (const [at, owed] of view.proposals.entries()) {
        const held = rendered[at] as HTMLElement;
        expect(
          [hook(held, "data-rank"), hook(held, "data-factor-x"), hook(held, "data-factor-y"), hook(held, "data-anisotropy"), hook(held, "data-placeable")],
          `${view.viewKey}'s proposal ${at} publishes the engine's own rank, factor pair, anisotropy and placeable flag (R-TO-020)`,
        ).toEqual([owed.rank, owed.factorX, owed.factorY, owed.anisotropy, String(owed.placeable)]);

        const text = held.textContent ?? "";
        expect(text, `and it reads as the rank's registered word for ${owed.rank}`).toContain(await copy(RANK_COPY_KEY[owed.rank] as string));
        for (const key of owed.evidence) expect(text, `every evidence source key stands whole in the proposal (${key}, I-26)`).toContain(key);
        expect(text, "and both 12-place factors render verbatim, unrounded (I-159)").toContain(owed.factorX);
        expect(text, "along the other axis too").toContain(owed.factorY);
        expect(text, "with the anisotropy readout the engine computed").toContain(owed.anisotropy);
      }

      const last = view.proposals[view.proposals.length - 1] as ProposalLike;
      expect(last.rank, "the sheet's header unit is mapped, so the weakest rank every view carries is the file's own units (L-MEA-05)").toBe(FILE_UNITS);
      expect(hook(rendered[rendered.length - 1] as HTMLElement, "data-rank"), "and the panel renders it last, in the precedence the door answered").toBe(FILE_UNITS);
    }
  });

  test("AC-1: a view an act of record names reads as affirmed, with its calibration whole", async () => {
    const core = await scaleCore();
    const base = await stagedViews();
    const header = core.metresPer("mm") as string;
    const affirmed = await affirmedView(base[0] as ViewScaleLike, { rank: FILE_UNITS, factorX: header, factorY: header });
    const views = [affirmed, base[1] as ViewScaleLike];
    const { mount } = await panelOver(views);

    const row = rowFor(mount, affirmed.viewKey);
    const standing = affirmed.affirmed as { calibrationKey: string; rank: string; factorX: string; factorY: string; anisotropy: string };
    expect(hook(row, "data-state"), "a view under a calibration of record is affirmed, never an absence").toBe(AFFIRMED);
    expect(
      [hook(row, "data-calibration-key"), hook(row, "data-rank"), hook(row, "data-factor-x"), hook(row, "data-factor-y"), hook(row, "data-anisotropy")],
      "and the row publishes the calibration it stands under, the rank it stood on and its factor pair (R-TO-020)",
    ).toEqual([standing.calibrationKey, standing.rank, standing.factorX, standing.factorY, standing.anisotropy]);
    expect(row.textContent ?? "", "the calibration key renders whole (I-159)").toContain(standing.calibrationKey);
    expect(row.textContent ?? "", "and so does the factor it is named over").toContain(standing.factorX);
  });
});

describe("AC-2: two picks, an entered distance and a unit are one observation row", () => {
  test("AC-2: Observe appends the axis, the lattice span, the 12-place factor and the verification, then clears the picks", async () => {
    const core = await scaleCore();
    const views = await stagedViews();
    const { mount } = await panelOver(views);

    await pick(mount, FROM);
    await pick(mount, TO);
    const taken = picksTaken(mount);
    expect(taken.length, "two picks stand on the sheet — the marks this tool consumes are the snap region's own (I-158)").toBe(2);
    const points = taken.map((mark) => keyPointOf(mark));

    await fillIn(cell(mount, TESTID.distance), OBSERVED_METRES);
    await choose(mount, TESTID.unit, OBSERVED_UNIT);
    await press(cell(mount, TESTID.observe));

    const rows = await waitFor(() => {
      const held = cells(mount, TESTID.observation);
      expect(held.length, "pressing Observe appends exactly one observation row").toBe(1);
      return held;
    });
    const row = rows[0] as HTMLElement;

    const owed = core.citeObservation({
      points: points.map(([x, y], at) => ({ sourceKey: (taken[at] as HTMLElement).getAttribute("data-source")?.split(" ")[0] ?? "", x, y })),
      distance: { value: OBSERVED_METRES, unit: OBSERVED_UNIT },
      distanceBasis: core.DISTANCE_BASIS_ENTERED,
    });

    expect(hook(row, "data-axis"), "the row speaks for the axis the two picks stand on, as core reads them").toBe(owed.axis);
    expect(hook(row, "data-drawn"), "and spans the lattice distance between the two key points").toBe(owed.drawn);
    expect(hook(row, "data-factor"), "and carries the entered distance in metres over that span, to 12 places half-even (L-MEA-05)").toBe(owed.factor);

    const corroborating = (views[0] as ViewScaleLike).proposals.filter((held) => held.placeable).map((held) => (owed.axis === "x" ? held.factorX : held.factorY));
    const verified = ((): boolean => {
      try {
        core.verifyAxis(owed.axis, [owed.factor], corroborating, TOLERANCES.verification);
        return true;
      } catch {
        // The single-observation check is the engine's own: an axis nothing corroborates within the
        // edition's tolerance is not verified, and that is a reading, never a fault (I-155).
        return false;
      }
    })();
    expect(hook(row, "data-verified"), "and says whether the drawing's own evidence agrees with it within the edition's verification tolerance").toBe(verified ? VERIFIED : UNVERIFIED);
    expect(row.textContent ?? "", "the factor renders whole beside the flag (I-159)").toContain(owed.factor);

    const check = cell(mount, TESTID.checkVerification);
    expect(cells(mount, TESTID.checkVerification).length, "exactly one verification line stands, always rendered (Decision §1)").toBe(1);
    expect(check.textContent ?? "", "and it names the tolerance the judgement was made at").toContain(TOLERANCES.verification);

    expect(hook(cell(mount, TESTID.statusDistance), "data-picks"), "a successful observation spends the marks it was taken from (I-158)").toBe("0");
  });
});

describe("AC-4: a member is checked, the act is previewed in the one dialog, and the commit re-reads the panel", () => {
  test("AC-4: affirming at FILE_UNITS opens the dialog over the checked member and the confirmed act leaves the row affirmed", async () => {
    const core = await scaleCore();
    const views = await stagedViews();
    const header = core.metresPer("mm") as string;
    const affirmed = await affirmedView(views[0] as ViewScaleLike, { rank: FILE_UNITS, factorX: header, factorY: header });
    const standing = affirmed.affirmed as { calibrationKey: string; rank: string; factorX: string; factorY: string; anisotropy: string };
    const after = [affirmed, views[1] as ViewScaleLike];

    const digest = "0".repeat(63) + "7";
    const actId = "99999999-8888-4777-8666-555555555555";
    const doors = doorsOver([readAnswer(views), readAnswer(after)], {
      preview: async () => ({
        previewed: true,
        consequenceDigest: digest,
        consequence: {
          actType: AFFIRM_SCALE,
          tenantId: "11111111-1111-4111-8111-111111111111",
          projectId: PROJECT,
          rendering: "SUBJECTS",
          subjects: [{ subjectId: VIEW_P, subjectLabel: null, before: [], after: [standing.calibrationKey] }],
          effects: { linesRederiving: [], signaturesVoiding: [] },
        },
      }),
      commit: async () => ({ committed: true, actId }),
    });

    const mount = await mountScaleScreen({ scale: doors, overlay: overlayOf(views) });
    await openScalePanel(mount);

    const member = within(rowFor(mount, VIEW_P), TESTID.member)[0] as HTMLElement;
    expect(member, `the row for ${VIEW_P} carries the checkbox a scale group is curated with (I-157)`).toBeTruthy();
    expect(hook(member, "data-view-key"), "and it names the view it would include").toBe(VIEW_P);
    await press(member);

    const affirmAt = cells(mount, TESTID.affirm).filter((button) => button.getAttribute("data-rank") === FILE_UNITS);
    expect(affirmAt.length, `one Affirm button stands for the rank every checked member can stand at (${FILE_UNITS}, I-157)`).toBe(1);
    await press(affirmAt[0] as HTMLElement);

    const dialog = await waitFor(() => {
      const held = cell(mount, TESTID.dialog);
      expect(held.getAttribute("data-act-type"), "the act opens the one ConsequenceDialog, named for what it would do (R-UI-021)").toBe(AFFIRM_SCALE);
      return held;
    });

    const subjects = within(dialog, TESTID.subjectRow);
    expect(subjects.length, "exactly one subject row per checked member — a scale group is the subject set of one act (L-MEA-05)").toBe(1);
    expect(hook(subjects[0] as HTMLElement, "data-subject"), "and that subject is the view that was checked").toBe(VIEW_P);
    expect((subjects[0] as HTMLElement).textContent ?? "", "the row names the calibration the view would come to stand under").toContain(standing.calibrationKey);

    const confirm = cell(mount, TESTID.confirm);
    const digestLine = cell(mount, TESTID.digestLine);
    expect(hook(confirm, "data-digest"), "confirm is the act button and carries the digest it was shown over (R-UI-021)").toBe((digestLine.textContent ?? "").trim());

    const asked = doors.asked.length;
    await press(confirm);

    await waitFor(() => {
      expect(mount.screen.querySelector(`[data-testid="${TESTID.dialog}"]`), "a committed act closes the dialog it was confirmed in").toBeNull();
    });
    const committed = doors.asked[asked] as { rank: string; viewKeys: readonly string[]; consequenceDigest?: string };
    expect(committed.rank, "the act was committed at the rank the pressed door named").toBe(FILE_UNITS);
    expect([...committed.viewKeys], "naming the views the reader checked, and no others (membership is positive, L-MEA-05)").toEqual([VIEW_P]);
    expect(committed.consequenceDigest, "carrying the digest the dialog showed").toBe(digest);

    await waitFor(() => {
      const row = rowFor(mount, VIEW_P);
      expect(row.getAttribute("data-state"), "and the panel re-reads, so the row's new state is the visible answer (Decision §1)").toBe(AFFIRMED);
    });
    const row = rowFor(mount, VIEW_P);
    expect(
      [hook(row, "data-calibration-key"), hook(row, "data-rank"), hook(row, "data-factor-x"), hook(row, "data-factor-y"), hook(row, "data-anisotropy")],
      "showing the calibration key, the rank, the factor pair and the anisotropy readout of the calibration now of record",
    ).toEqual([standing.calibrationKey, standing.rank, standing.factorX, standing.factorY, standing.anisotropy]);
    expect(doors.reads, "the panel read the door again rather than painting the act's answer itself").toBeGreaterThan(1);
  });

  test("AC-4: both effect slots stand in the dialog this act opens, each reading `none` when the seam names nothing", async () => {
    const core = await scaleCore();
    const views = await stagedViews();
    const header = core.metresPer("mm") as string;
    const affirmed = await affirmedView(views[0] as ViewScaleLike, { rank: FILE_UNITS, factorX: header, factorY: header });
    const standing = affirmed.affirmed as { calibrationKey: string };
    const { strings } = await productModule<{ strings: Record<string, string> }>("src/ui/strings/index.ts");
    const none = strings["consequence_dialog_none"] as string;
    expect(typeof none, "the one string table carries the word an empty slot is said with").toBe("string");

    const doors = doorsOver([readAnswer(views)], {
      preview: async () => ({
        previewed: true,
        consequenceDigest: "1".repeat(64),
        consequence: {
          actType: AFFIRM_SCALE,
          tenantId: "11111111-1111-4111-8111-111111111111",
          projectId: PROJECT,
          rendering: "SUBJECTS",
          subjects: [{ subjectId: VIEW_P, subjectLabel: null, before: [], after: [standing.calibrationKey] }],
          effects: { linesRederiving: [], signaturesVoiding: [] },
        },
      }),
    });

    const mount = await mountScaleScreen({ scale: doors, overlay: overlayOf(views) });
    await openScalePanel(mount);
    await press(within(rowFor(mount, VIEW_P), TESTID.member)[0] as HTMLElement);
    await press(cells(mount, TESTID.affirm).filter((button) => button.getAttribute("data-rank") === FILE_UNITS)[0] as HTMLElement);

    const dialog = await waitFor(() => cell(mount, TESTID.dialog));
    for (const slot of [TESTID.effectLines, TESTID.effectSignatures]) {
      const held = within(dialog, slot);
      expect(held.length, `the dialog mounts exactly one \`${slot}\` for an act whose preview carries effects (R-TO-020)`).toBe(1);
      expect((held[0] as HTMLElement).textContent ?? "", `and it says nothing re-derives rather than standing empty (R-UI-020)`).toContain(none);
    }
  });
});
