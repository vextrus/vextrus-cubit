/*
 * Ticket step1live's acceptance tests (session 11's review of main on the real sets, D5 and D8):
 * Step 1 refreshes as files finish reading, says so while a file reads, and Coverage names each step.
 *
 * Authority, docs/design/m0-screens.md:
 * - §4.7 "States that do not depend on layout": "No files | Canvas empty state: "No sheets yet. Add the
 *   Drawing Set's files first."" and "Files still reading | Sheets from read files are workable; a row
 *   above the list: "Still reading KR-ELE-R0.dwg: sheet 2 of 3. Its sheets join the list when it is
 *   read."". §5's bar, "Nothing left, files reading": "Reading NT-ARCH-R1.dwg: sheet 14 of 28" · "Its
 *   sheets join the list as they are read."
 * - §6.11 Coverage: the panel's "Views by the step that will read them, proposed or assigned" (step and
 *   count); an MEP view's Part "is a row of its own ("Electrical, M3 onwards")". §4.1's rail names a
 *   step "Step 7, Beams". CONTEXT.md, "Takeoff Step", gives the fourteen in order.
 * - The keys the API sends in `by_step` (`vextrus/takeoff/services/step1.py`, `coverage`): each
 *   Takeoff Step's key from `vextrus/takeoff/library.py` `STEPS`, and a view's Part key (a Discipline's
 *   key) where no step of it already counts it.
 *
 * The fakes are the repo's: 22's Step 1 fake (../t22/step1.fixture.ts) over 20b's Drawing Set fake
 * (../t20b/drawings.fixture.ts), whose files list Step 1's files band reads. A file "finishes" when the
 * test moves the fake's file to `read` and puts its sheets in Step 1's answers, as the API does.
 *
 * Chosen by the acceptance writer (the report lists them): the refresh is awaited in fake time, at most
 * 10 s after the file is read on the server (five of the Drawing Set's 2 s polls); a step's name may be
 * the rail's short name ("Beams") or CONTEXT.md's / the Library's longer one, after its number.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { page } from "vitest/browser";
import { FakeApi, PEOPLE, mountApp } from "@/app/testing";
import { FakeDrawingSet, file, msg } from "../t20b/drawings.fixture";
import { FakeStep1 } from "../t22/step1.fixture";

beforeEach(async () => {
  await page.viewport(1440, 900);
});

afterEach(() => {
  vi.useRealTimers();
});

const clean = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/[⁦-⁩‎‏]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const bodyText = () => clean(document.body.textContent);
const PATH = "/p/KR-01/takeoff/1";
/** §4.7's "No files" words, up to the apostrophe (the product prints a typographic one). */
const NO_FILES = "No sheets yet. Add the Drawing Set";

/**
 * KR-01 (22's fake) with its electrical file KR-ELE-R0.dwg still reading, sheet 2 of 3: the structural
 * and architectural files are read and their 21 sheets listed; the electrical sheets are not yet in
 * Step 1's answers. `finish()` does what the server does when the file is read: the file's row moves to
 * read (3 sheets), its 3 sheets join the proposals and Coverage counts their views.
 */
function kr01ElectricalReading() {
  const api = new FakeApi();
  const set = new FakeDrawingSet(api, "KR-01");
  const step1 = new FakeStep1(api, "KR-01");
  // No held file here: its Question names a file this files list does not carry.
  step1.questions = step1.questions.filter((q) => q.kind !== "file_misread");
  const electrical = step1.proposals.filter(
    (p) => p.discipline === "electrical",
  );
  step1.proposals = step1.proposals.filter(
    (p) => p.discipline !== "electrical",
  );
  step1.coverage = {
    ...step1.coverage,
    views: 64,
    proposed: 62,
    unaccounted: 2,
  };
  const of = (discipline: string) =>
    step1.proposals.find((p) => p.discipline === discipline)!.file_id;
  const reading = file({
    id: electrical[0]!.file_id,
    name: "KR-ELE-R0.dwg",
    discipline: "electrical",
    state: "reading",
    status: msg("drawings.files.reading_sheet", { position: 2, total: 3 }),
  });
  set.files = [
    file({
      id: of("structural"),
      name: "KR-STR-R0.dwg",
      discipline: "structural",
      state: "read",
      status: msg("drawings.files.read", { sheets: 13 }),
      sheets_found: 13,
    }),
    file({
      id: of("architectural"),
      name: "KR-ARC-R0.dwg",
      discipline: "architectural",
      state: "read",
      status: msg("drawings.files.read", { sheets: 8 }),
      sheets_found: 8,
    }),
    reading,
  ];
  const finish = () => {
    Object.assign(reading, {
      state: "read",
      status: msg("drawings.files.read", { sheets: 3 }),
      sheets_found: 3,
    });
    step1.proposals = [...step1.proposals, ...electrical];
    step1.coverage = {
      ...step1.coverage,
      views: 70,
      proposed: 68,
      unaccounted: 2,
    };
  };
  return { api, set, step1, finish };
}

/**
 * Fake time only: advance the page's clock in small steps until `ok` holds, at most `limitMs` of fake
 * time. Never wall time: every timer the screen sets (its polls among them) runs on this clock.
 */
async function within_(limitMs: number, ok: () => boolean): Promise<boolean> {
  for (let spent = 0; spent <= limitMs; spent += 50) {
    if (ok()) return true;
    await vi.advanceTimersByTimeAsync(50);
  }
  return ok();
}

function fakeClock() {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
  vi.setSystemTime(new Date("2026-10-04T06:00:00Z"));
}

/** Mount Step 1 on the fake clock and let it load, in fake time. */
async function openOnFakeClock(api: FakeApi, loaded: () => boolean) {
  const mounting = mountApp(PATH, { as: PEOPLE.qs, api });
  let done = false;
  void mounting.then(() => (done = true));
  expect(await within_(5_000, () => done), "the app mounts").toBe(true);
  expect(
    await within_(5_000, loaded),
    `Step 1 loads; it shows: ${bodyText().slice(0, 400)}`,
  ).toBe(true);
}

describe('a file still reading (D5; m0-screens §4.7 "Files still reading")', () => {
  it('says the file is still reading, never "No sheets yet. Add the Drawing Set’s files first.", while the only file reads', async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T06:00:00Z"));
    const api = new FakeApi();
    const set = new FakeDrawingSet(api, "KR-01");
    new FakeStep1(api, "KR-01", true);
    set.files = [
      file({
        name: "KR-STR-R0.dwg",
        state: "reading",
        status: msg("drawings.files.reading_sheet", { position: 2, total: 3 }),
      }),
    ];
    await mountApp(PATH, { as: PEOPLE.qs, api });
    await waitFor(() =>
      expect(bodyText()).toMatch(/(Still reading|Reading) KR-STR-R0\.dwg/),
    );
    expect(bodyText()).toMatch(
      /Its sheets join the list (when it is read|as they are read)\./,
    );
    expect(bodyText()).not.toContain(NO_FILES);
  });

  it('shows the row "Still reading KR-ELE-R0.dwg: sheet 2 of 3. Its sheets join the list when it is read." above the read files’ sheets', async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T06:00:00Z"));
    const { api } = kr01ElectricalReading();
    await mountApp(PATH, { as: PEOPLE.qs, api });
    await waitFor(() => expect(bodyText()).toContain("Confirmed 0 / 21"));
    await waitFor(() =>
      expect(bodyText()).toContain(
        "Still reading KR-ELE-R0.dwg: sheet 2 of 3. Its sheets join the list when it is read.",
      ),
    );
    expect(bodyText()).toContain("S-01");
    expect(bodyText()).not.toContain(NO_FILES);
  });
});

describe("a file finishes reading while Step 1 is open (D5)", () => {
  it("lists the file’s sheets without a reload, once the file is read", async () => {
    fakeClock();
    const { api, finish } = kr01ElectricalReading();
    await openOnFakeClock(api, () => bodyText().includes("Confirmed 0 / 21"));
    expect(bodyText()).not.toContain("E-01");
    finish();
    expect(
      await within_(
        10_000,
        () => bodyText().includes("E-01") && bodyText().includes("E-03"),
      ),
      "E-01 to E-03 join the list",
    ).toBe(true);
  });

  it('moves the Count from "Confirmed 0 / 21" to "Confirmed 0 / 24" without a reload', async () => {
    fakeClock();
    const { api, finish } = kr01ElectricalReading();
    await openOnFakeClock(api, () => bodyText().includes("Confirmed 0 / 21"));
    finish();
    expect(
      await within_(10_000, () => bodyText().includes("Confirmed 0 / 24")),
      `the Count; it shows: ${bodyText().match(/Confirmed[^A-Za-z]*/)?.[0]}`,
    ).toBe(true);
  });

  it("moves Coverage on the status bar to the file’s views without a reload", async () => {
    fakeClock();
    const { api, finish } = kr01ElectricalReading();
    await openOnFakeClock(api, () =>
      bodyText().includes(
        "Coverage 64 views: 0 assigned, 0 excluded, 62 proposed, 2 unaccounted",
      ),
    );
    finish();
    expect(
      await within_(10_000, () =>
        bodyText().includes(
          "Coverage 70 views: 0 assigned, 0 excluded, 68 proposed, 2 unaccounted",
        ),
      ),
      "Coverage counts the new views",
    ).toBe(true);
  });

  it("stops saying the file is still reading once it is read", async () => {
    fakeClock();
    const { api, finish } = kr01ElectricalReading();
    await openOnFakeClock(api, () => bodyText().includes("Confirmed 0 / 21"));
    finish();
    expect(
      await within_(
        10_000,
        () =>
          bodyText().includes("E-01") &&
          !bodyText().includes("Still reading KR-ELE-R0.dwg"),
      ),
      "the reading row goes",
    ).toBe(true);
  });
});

/**
 * Every Takeoff Step key the API can send in `by_step` (library.py's STEPS, in order), with the names
 * the authorities give it: the rail's ("Step 7, Beams"), CONTEXT.md's and the Library's.
 */
const STEPS: [key: string, number: number, names: string[]][] = [
  ["sheets", 1, ["Sheets"]],
  ["general_notes", 2, ["Notes", "General notes and specifications?"]],
  ["storeys", 3, ["Levels", "Storeys and levels"]],
  ["grid", 4, ["Grid"]],
  ["foundations", 5, ["Foundations", "Foundations and substructure"]],
  ["columns", 6, ["Columns", "Columns, shear walls and (the lift )?core"]],
  ["beams", 7, ["Beams"]],
  ["slabs", 8, ["Slabs", "Slabs and slab-edge members"]],
  ["stairs", 9, ["Stairs", "Stairs, landing beams and the lift pit"]],
  ["tanks", 10, ["Tanks"]],
  ["walls", 11, ["Walls", "Walls and openings"]],
  ["rooms", 12, ["Rooms", "Rooms and finishes"]],
  ["roof", 13, ["Roof"]],
  ["site_mep", 14, ["Site", "Site works and (the )?MEP( allowances)?"]],
];

/** The MEP Discipline Parts the API may send as a key (m0-screens §6.11, §6.9's names). */
const MEP_PARTS: [key: string, name: string][] = [
  ["electrical", "Electrical"],
  ["plumbing", "Plumbing and sanitary"],
  ["fire", "Fire"],
  ["mechanical", "Mechanical (HVAC)"],
  ["lift", "Lift"],
  ["gas", "Gas"],
];

/** Step 1 at 22's KR-01 with Coverage's `by_step` as given; the Coverage panel opened from the status bar. */
async function coveragePanel(
  byStep: Record<string, number>,
): Promise<{ section: HTMLElement; labels: string[] }> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T06:00:00Z"));
  const api = new FakeApi();
  new FakeDrawingSet(api, "KR-01");
  const step1 = new FakeStep1(api, "KR-01");
  step1.coverage = { ...step1.coverage, by_step: byStep };
  await mountApp(PATH, { as: PEOPLE.qs, api });
  await waitFor(() => expect(bodyText()).toContain("Confirmed 0 / 24"));
  const button = screen
    .getAllByRole("button")
    .find((b) => clean(b.textContent).startsWith("Coverage 70 views"));
  expect(button, "the status bar’s Coverage").toBeDefined();
  await userEvent.click(button!);
  const heading = await screen.findByText(
    "Views by the step that will read them, proposed or assigned",
  );
  const section = (heading.closest("section") ?? heading.parentElement)!;
  const labels = [...section.querySelectorAll("*")].map((el) =>
    clean(el.textContent),
  );
  return { section, labels };
}

describe("Coverage names each step the API sends (D8; m0-screens §6.11)", () => {
  it.each(STEPS)(
    'names the key "%s" as Step %i by its name, never "Another Discipline" or "M3 onwards"',
    async (key, number, names) => {
      const { section, labels } = await coveragePanel({ [key]: 17 });
      const label = new RegExp(
        `^(Step )?${number},? (${names.join("|")})$`,
        "i",
      );
      expect(
        labels.some((l) => label.test(l)),
        `a row named "${number} ${names[0]}"; the panel shows: ${clean(section.textContent)}`,
      ).toBe(true);
      expect(clean(section.textContent)).not.toContain("Another Discipline");
      expect(clean(section.textContent)).not.toContain("M3 onwards");
    },
  );

  it("names every step at once, each on its own row, when the API sends them together", async () => {
    const { section, labels } = await coveragePanel(
      Object.fromEntries(STEPS.map(([key], i) => [key, 100 + i])),
    );
    for (const [key, number, names] of STEPS) {
      const label = new RegExp(
        `^(Step )?${number},? (${names.join("|")})$`,
        "i",
      );
      expect(
        labels.some((l) => label.test(l)),
        `${key}: a row named "${number} ${names[0]}"; the panel shows: ${clean(section.textContent)}`,
      ).toBe(true);
    }
    expect(clean(section.textContent)).not.toContain("Another Discipline");
    expect(clean(section.textContent)).not.toContain("M3 onwards");
  });

  it('never names a Structural or Architectural Part "Another Discipline" or "M3 onwards"', async () => {
    const { section } = await coveragePanel({
      structural: 3,
      architectural: 2,
      beams: 7,
    });
    expect(clean(section.textContent)).not.toContain("Another Discipline");
    expect(clean(section.textContent)).not.toContain("M3 onwards");
  });

  it.each(MEP_PARTS)(
    'names the MEP Part "%s" as "%s, M3 onwards"',
    async (key, name) => {
      const { section, labels } = await coveragePanel({ [key]: 4, beams: 7 });
      expect(
        labels,
        `the panel shows: ${clean(section.textContent)}`,
      ).toContain(`${name}, M3 onwards`);
      expect(clean(section.textContent)).not.toContain("Another Discipline");
    },
  );
});
