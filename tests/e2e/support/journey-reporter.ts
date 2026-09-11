// One verdict line per journey the caller asked for (v22 Wave A). The journey runner can now put
// several journeys through ONE Playwright invocation (`pnpm e2e --journey J-001 --journey J-003`),
// which costs one browser start and one server instead of one each — but a single exit code cannot
// tell the caller WHICH journey was red, and the engine schedules on exactly that. So the journeys
// the run was asked for are named to this reporter (CUBIT_E2E_JOURNEYS), and it prints
//
//   JOURNEY J-001 green
//   JOURNEY J-003 red
//
// once per asked-for journey, whatever the reporters above it printed. A journey no test matched is
// RED, never green: a grep that selected nothing has proved nothing, and silence must not read as a
// pass (V-E2E — a journey the gate does not run is green by omission).
import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

/** The journeys this invocation was asked for, in the order the caller named them. */
const ASKED_FOR: string[] = (process.env["CUBIT_E2E_JOURNEYS"] ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter((name) => name !== "");

export default class JourneyReporter implements Reporter {
  /** journey → has every test of it that ran so far passed. Absent means nothing matched it. */
  private readonly verdicts = new Map<string, boolean>();

  onTestEnd(test: TestCase, result: TestResult): void {
    // A journey is named by its tag and by the file that walks it; both spellings are matched, so a
    // journey recognises its own tests whether the id sits in the title or only in the filename.
    const where = `${test.titlePath().join(" ")} ${test.location.file}`.toLowerCase();
    for (const journey of ASKED_FOR) {
      if (!where.includes(journey.toLowerCase())) continue;
      const green = result.status === "passed" || result.status === "skipped";
      this.verdicts.set(journey, (this.verdicts.get(journey) ?? true) && green);
    }
  }

  onEnd(): void {
    for (const journey of ASKED_FOR) {
      process.stdout.write(`JOURNEY ${journey} ${this.verdicts.get(journey) === true ? "green" : "red"}\n`);
    }
  }
}
