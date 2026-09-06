// @vitest-environment jsdom
/**
 * AC-6(b) — the sheet index's empty state takes the discipline union it is given, not a string.
 *
 * The caller holds a `Discipline`; the component's prop widens it to `string | null`, so the enum
 * the whole sheets lane is closed over is thrown away at the last hop and a typo reaches the
 * rendered sentence as data. The cure is a prop typed at the union, and the proof of a type is the
 * compiler: the aliases below are `tsc`'s to judge (`pnpm verify`), gathered into one exported type
 * so nothing here is an unused local (the `model-ledger.types` precedent).
 *
 * The runtime half stands beside it, because a type that compiles and a screen that says the wrong
 * thing is still a defect: a `no-match` emptiness reached by a discipline chip still names that
 * discipline in its own sentence.
 *
 * `.ts` rather than `.tsx`: tsconfig includes `src/**\/*.ts`, so the compile-time half is actually
 * reached, and elements are built with `createElement`.
 */
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { DISCIPLINES } from "../../../../../../../../core/sheets/law";
import { JobsProvider, type JobsFormat } from "../../../../../../../../ui/patterns/job-timeline";
import { fill } from "../../../../../../../../ui/strings";
import { SheetIndex } from "../sheet-index";
import { drawings } from "../strings";
import type { SheetCardData } from "../sheet-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined, prefetch: () => undefined }),
  usePathname: () => "/t/tenant-1/p/project-1/drawings",
  useSearchParams: () => new URLSearchParams(),
}));

/* ------------------------------------------------------------------ *
 * Compile-time acceptance. `tsc` is the runner for these.
 * ------------------------------------------------------------------ */

type Expect<T extends true> = T;
type Not<T extends boolean> = T extends true ? false : true;
type Assignable<From, To> = [From] extends [To] ? true : false;

type Discipline = import("../../../../../../../../core/sheets/law").Discipline;
type EmptyProps = import("../sheet-index").EmptyProps;

/** The union the caller holds is exactly what the empty state admits. */
type DisciplineIsAdmitted = Expect<Assignable<Discipline | null, EmptyProps["discipline"]>>;
/** And an arbitrary string is not: a closed enum nothing is checked against is not closed (B-17). */
type StringIsRefused = Expect<Not<Assignable<string, EmptyProps["discipline"]>>>;
/** The three causes stay the closed set the state renders one of (I-91). */
type CauseIsClosed = Expect<Not<Assignable<string, EmptyProps["cause"]>>>;

export type CompileTimeAcceptance = [DisciplineIsAdmitted, StringIsRefused, CauseIsClosed];

/* ------------------------------------------------------------------ *
 * The rendered half.
 * ------------------------------------------------------------------ */

/** The two disciplines these cases need: one a card stands as, one it does not. */
const STANDS_AS = DISCIPLINES[0];
const FILTERED_TO = DISCIPLINES[1];

/** One card of the index, standing as a discipline the filter below will exclude. */
const card: SheetCardData = {
  sheetId: "sheet-1",
  drawingId: "drawing-1",
  layoutName: "Sheet 1",
  format: "DWG",
  scheme: "DXF_HANDLE",
  thumbnail: null,
  proposal: { number: "A-101", title: "Ground floor plan", discipline: STANDS_AS, basis: "title block", cited: [] },
  confirmed: null,
  scaleState: "stated",
  viewCount: null,
  facts: {},
};

afterEach(() => {
  cleanup();
});

/**
 * The screen's timeline is the shared job pattern, which reads its register from the tenant frame
 * (R-UI-024, docs/design/job-timeline.md I-113): mounted for a test the screen stands inside the same
 * provider, with the whole-seconds and registry lookups the frame binds standing in as arithmetic.
 * Nothing in this file tracks a job, so neither is ever asked for.
 */
const JOBS_FORMAT: JobsFormat = { seconds: (elapsedMs: number) => String(elapsedMs), refusal: () => null };

test("AC-6(b): a no-match emptiness reached by a discipline chip names that discipline", async () => {
  const person = userEvent.setup();
  render(
    createElement(
      JobsProvider,
      { format: JOBS_FORMAT },
      createElement(SheetIndex, {
        tenantId: "3f1c2e10-8a44-4e2b-9f0a-1c2d3e4f5061",
        projectId: "9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d",
        cards: [card],
        groups: [],
        canConfirm: false,
        awaitingIngest: 0,
      }),
    ),
  );

  const chip = screen.getAllByTestId("sheet-filter-option").find((option) => option.getAttribute("data-value") === FILTERED_TO);
  expect(chip, `the index offers a chip for ${FILTERED_TO}`).toBeDefined();
  await person.click(chip as HTMLElement);

  const empty = screen.getByTestId("sheets-empty");
  expect(empty.getAttribute("data-cause"), "the index is not empty — nothing answers to this filter").toBe("no-match");
  expect(empty.textContent, "the emptiness names the filter in force, so it does not read as 'there are no sheets'").toContain(
    fill(drawings.drawings_empty_no_match_discipline, { discipline: FILTERED_TO }),
  );
});
