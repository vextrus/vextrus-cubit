// One verdict line per journey the caller asked for (v22 Wave A). The journey runner can now put
// several journeys through ONE Playwright invocation (`pnpm e2e --journey J-001 --journey J-003`),
// which costs one browser start and one server instead of one each — but a single exit code cannot
// tell the caller WHICH journey was red, and the engine schedules on exactly that. So the journeys
// the run was asked for are named to this reporter (CUBIT_E2E_JOURNEYS), and it prints
//
//   JOURNEY J-001 green workers=2
//   JOURNEY J-003 red workers=2
//
// The worker count is part of the verdict because it is part of what was measured (P4b §6): two
// workers walk two journeys at once, against one served product and one database, and a red found
// at two is not reproducible from a verdict that did not say so. It is read from the config the run
// actually ran with, never from a number this file restates.
//
// once per asked-for journey, whatever the reporters above it printed. A journey no test matched is
// RED, never green: a grep that selected nothing has proved nothing, and silence must not read as a
// pass (V-E2E — a journey the gate does not run is green by omission).
import type { FullConfig, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

/** The journeys an invocation was asked for, in the order the caller named them. */
function askedFor(): string[] {
  return (process.env["CUBIT_E2E_JOURNEYS"] ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
}

/**
 * A journey's id, matched as a WHOLE TOKEN. `where.includes("j-001")` also matched `j-0010`, so a
 * sibling journey's red was recorded against the journey that was asked for — and the gate schedules
 * on exactly that line. A digit or a letter behind the id means it is a different journey's id; a
 * hyphen behind it does not, because the file that walks a journey is named `j-001-auth.spec.ts`.
 */
function mentions(where: string, journey: string): boolean {
  const name = journey.toLowerCase();
  const id = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A name the caller ended on a separator is a prefix ask (`--journey PERF-`) and has no end.
  const end = /[a-z0-9]$/.test(name) ? "(?![a-z0-9])" : "";
  return new RegExp(`(?:^|[^a-z0-9])${id}${end}`).test(where);
}

export default class JourneyReporter implements Reporter {
  /** journey → has every test of it that ran so far passed. Absent means nothing matched it. */
  private readonly verdicts = new Map<string, boolean>();

  /** Read per instance, not per module: a reporter answers for the run it was made for. */
  private readonly asked: string[] = askedFor();

  /** How many workers this run walked with, as the runner resolved it (scripts/e2e.mjs). */
  private workers = Math.max(1, Number(process.env["CUBIT_E2E_WORKERS"] ?? "1") || 1);

  onBegin(config: FullConfig): void {
    this.workers = config.workers;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // A journey is named by its tag and by the file that walks it; both spellings are matched, so a
    // journey recognises its own tests whether the id sits in the title or only in the filename.
    const where = `${test.titlePath().join(" ")} ${test.location.file}`.toLowerCase();
    for (const journey of this.asked) {
      if (!mentions(where, journey)) continue;
      const green = result.status === "passed" || result.status === "skipped";
      this.verdicts.set(journey, (this.verdicts.get(journey) ?? true) && green);
    }
  }

  onEnd(): void {
    for (const journey of this.asked) {
      process.stdout.write(`JOURNEY ${journey} ${this.verdicts.get(journey) === true ? "green" : "red"} workers=${this.workers}\n`);
    }
  }
}
