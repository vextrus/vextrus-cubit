// A journey selects its own tests and answers for its own tests (v22 Wave A, P2b finding 5).
//
// `pnpm e2e --journey J-001` passed the id to Playwright as a bare `--grep J-001` — a JS regex with
// no boundary, so it also selected J-0010 — and the reporter attributed a test to a journey by
// `where.includes(journey)`, so J-0010's red was recorded against J-001 as well. Either way round,
// the gate reads a verdict about a journey that was never run: a green J-001 reddened by a sibling,
// or a J-0010 that nobody asked for costing the run its wall time.
//
// Both ends are token-matched now, and both are proved here against the two titles that differ only
// by the digit: the grep decides what Playwright would collect, and the reporter is given exactly
// what that grep selected.
import { describe, expect, test } from "vitest";
import { grepFor } from "../../scripts/e2e.mjs";
import JourneyReporter from "../../tests/e2e/support/journey-reporter";

/** The two journeys a bare substring cannot tell apart. */
const TITLES = ["J-001 the auth journey walks", "J-0010 a much later journey walks"] as const;

/** A TestCase as much as this reporter reads of one. */
function fakeTest(title: string, file: string): { titlePath: () => string[]; location: { file: string } } {
  return { titlePath: () => ["chromium", file, title], location: { file } };
}

/** Run the reporter over the tests a grep selected, and collect the JOURNEY lines it prints. */
function verdictsFor(asked: string[], ran: { title: string; file: string; status: "passed" | "failed" }[]): string[] {
  const named = process.env["CUBIT_E2E_JOURNEYS"];
  const said: string[] = [];
  const wrote = process.stdout.write.bind(process.stdout);
  try {
    process.env["CUBIT_E2E_JOURNEYS"] = asked.join(",");
    process.stdout.write = ((chunk: string) => { said.push(String(chunk)); return true; }) as typeof process.stdout.write;
    const reporter = new JourneyReporter();
    for (const one of ran) reporter.onTestEnd(fakeTest(one.title, one.file) as never, { status: one.status } as never);
    reporter.onEnd();
  } finally {
    process.stdout.write = wrote;
    if (named === undefined) delete process.env["CUBIT_E2E_JOURNEYS"];
    else process.env["CUBIT_E2E_JOURNEYS"] = named;
  }
  return said.join("").split("\n").filter((line) => line.startsWith("JOURNEY "));
}

describe("a journey id is a whole token, at both ends of the run", () => {
  test("--grep J-001 selects J-001 and not J-0010", () => {
    const grep = grepFor(["J-001"]);
    expect(grep, "the runner named no grep for one journey").not.toBeNull();
    const selects = new RegExp(String(grep));

    expect(selects.test(TITLES[0]), "the journey asked for was not selected by its own grep").toBe(true);
    expect(selects.test(TITLES[1]), "the grep for J-001 also selected J-0010 — the gate pays for a journey nobody asked for").toBe(false);
    // The id is still found where it really is: after the runner's separator, and at a title's start.
    expect(selects.test("chromium > tests/e2e/journeys/x.spec.ts > J-001 walks")).toBe(true);
    expect(selects.test("J-001")).toBe(true);
    expect(selects.test("J-001a the split-out core journey"), "J-001a is its own journey and is asked for by name").toBe(false);
  });

  test("several journeys in one invocation are a union of whole tokens", () => {
    const selects = new RegExp(String(grepFor(["J-001", "J-003"])));
    expect(selects.test(TITLES[0])).toBe(true);
    expect(selects.test("J-003 the third journey")).toBe(true);
    expect(selects.test(TITLES[1])).toBe(false);
    expect(selects.test("J-0030 a much later journey")).toBe(false);
  });

  test("a name ending on a separator is a prefix ask, and keeps its open end", () => {
    // `pnpm test:perf` is `--journey PERF-`: every performance journey, not one called exactly PERF-.
    const selects = new RegExp(String(grepFor(["PERF-"])));
    expect(selects.test("PERF-J-000 the shell renders inside budget"), "the prefix ask stopped selecting the journeys it names").toBe(true);
    expect(verdictsFor(["PERF-"], [{ title: "PERF-J-000 the shell renders inside budget", file: "tests/e2e/journeys/perf-j-000.spec.ts", status: "passed" }])).toEqual(["JOURNEY PERF- green"]);
  });

  test("a sibling's red is not J-001's red", () => {
    // What the fixed grep would have collected: only the journey asked for.
    expect(verdictsFor(["J-001"], [{ title: TITLES[0], file: "tests/e2e/journeys/j-001-auth.spec.ts", status: "passed" }])).toEqual(["JOURNEY J-001 green"]);

    // And even handed the sibling's failure — a stray selection, a shared file — the reporter does
    // not record it against the journey whose id is a prefix of it.
    const bothRan = verdictsFor(["J-001"], [
      { title: TITLES[0], file: "tests/e2e/journeys/j-001-auth.spec.ts", status: "passed" },
      { title: TITLES[1], file: "tests/e2e/journeys/j-0010-later.spec.ts", status: "failed" },
    ]);
    expect(bothRan, "J-0010's red was attributed to J-001 by a substring match").toEqual(["JOURNEY J-001 green"]);
  });

  test("a journey still recognises its own tests by the file that walks them", () => {
    expect(verdictsFor(["J-001"], [{ title: "the sign-in page refuses a bad password", file: "tests/e2e/journeys/j-001-auth.spec.ts", status: "failed" }])).toEqual(["JOURNEY J-001 red"]);
    // And a sibling's GREEN is not a pass for a journey nothing ran: silence stays red (V-E2E).
    expect(verdictsFor(["J-001"], [{ title: "a much later journey", file: "tests/e2e/journeys/j-0010-later.spec.ts", status: "passed" }])).toEqual(["JOURNEY J-001 red"]);
  });
});
