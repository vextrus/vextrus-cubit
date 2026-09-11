// The showreel's table of contents, judged where it is decidable: the pure part.
//
// A reporter is hard to run and easy to get wrong in exactly two places — the regex that reads
// criterion ids out of a title, and the arithmetic that turns epoch instants into offsets into a
// film. Both are pure functions here, so both are asserted here. The JSON shape itself is pinned in
// the last case, because the engine's B2 reads that file verbatim: a key renamed "nicely" is an
// engine that reads nothing.
import { describe, expect, test } from "vitest";
import { chaptersOf, criteriaIn, marksOf, CHAPTER_ANNOTATION, type Showreel } from "../e2e/support/showreel-reporter";

describe("criteriaIn: the ids a journey title names", () => {
  test.each([
    ["J-000: a new account names its workspace and creates its first project", ["J-000"]],
    ["J-021 (AC-6): ⌘K finds a project by name, Enter lands on it", ["J-021", "AC-6"]],
    ["J-003: the open ConsequenceDialog matches its committed baseline (AC-6, R-UI-021)", ["J-003", "AC-6", "R-UI-021"]],
    ["PERF-011: the viewer opens a 100k sheet within budget", ["PERF-011"]],
    ["J-000: a new account uploads F-RCC6, opens its foundation plan", ["J-000", "F-RCC6"]],
    ["S-AUTH-BREAKER: a fault the server really filed renders the fault card with its id", ["S-AUTH-BREAKER"]],
    ["J-003: the four owned shell design baselines were regenerated — their bytes changed (B-20)", ["J-003", "B-20"]],
    ["I-41 and V-E2E, at M3", ["I-41", "V-E2E", "M3"]],
  ])("%s", (title, expected) => {
    expect(criteriaIn(title)).toEqual(expected);
  });

  test("an id named twice is listed once", () => {
    expect(criteriaIn("J-000 — Golden Path: J-000 walks it")).toEqual(["J-000"]);
  });

  test("a title that names no criterion answers with nothing, never with a guess", () => {
    expect(criteriaIn("the shell renders")).toEqual([]);
  });
});

describe("marksOf: what checkpoint() filed", () => {
  test("only this reporter's annotations are read, and they come back in time order", () => {
    const marks = marksOf([
      { type: CHAPTER_ANNOTATION, description: JSON.stringify({ checkpoint: "b", atMs: 2_000 }) },
      { type: "skip", description: "not ours" },
      { type: CHAPTER_ANNOTATION, description: JSON.stringify({ checkpoint: "a", atMs: 1_000 }) },
    ]);
    expect(marks).toEqual([
      { checkpoint: "a", atMs: 1_000 },
      { checkpoint: "b", atMs: 2_000 },
    ]);
  });

  test("a mark missing either half is not a mark", () => {
    expect(marksOf([{ type: CHAPTER_ANNOTATION, description: JSON.stringify({ checkpoint: "a" }) }])).toEqual([]);
    expect(marksOf([{ type: CHAPTER_ANNOTATION, description: JSON.stringify({ atMs: 1 }) }])).toEqual([]);
    expect(marksOf([{ type: CHAPTER_ANNOTATION }])).toEqual([]);
  });
});

describe("chaptersOf: instants become offsets into the film", () => {
  const marks = [
    { checkpoint: "j-000/workspace-named", atMs: 1_700_000_005_000 },
    { checkpoint: "j-000/first-project-on-s-home", atMs: 1_700_000_012_000 },
  ];

  test("a chapter runs until the next one starts, and the last to the end of the test", () => {
    const chapters = chaptersOf("J-000: AC-5, end to end", 1_700_000_000_000, 20_000, marks);
    expect(chapters.map((chapter) => [chapter.startMs, chapter.endMs])).toEqual([
      [5_000, 12_000],
      [12_000, 20_000],
    ]);
  });

  test("every chapter carries the checkpoint it was taken at and the criteria its test names", () => {
    const chapters = chaptersOf("J-000: AC-5, end to end", 1_700_000_000_000, 20_000, marks);
    expect(chapters[0]?.checkpoint).toBe("j-000/workspace-named");
    expect(chapters[0]?.criteria).toEqual(["J-000", "AC-5"]);
    expect(chapters[0]?.title).toBe("J-000: AC-5, end to end — j-000/workspace-named");
  });

  test("a mark taken before the clock started is clamped rather than made negative", () => {
    const chapters = chaptersOf("J-000", 1_700_000_010_000, 5_000, [{ checkpoint: "early", atMs: 1_700_000_000_000 }]);
    expect(chapters[0]?.startMs).toBe(0);
    expect(chapters[0]?.endMs).toBe(5_000);
  });

  test("THE SHAPE THE ENGINE READS — every key, and nothing beside it", () => {
    const reel: Showreel = { chapters: chaptersOf("J-000: AC-5", 0, 10, marks.slice(0, 1)), video: "test-results/x/video.webm", trace: "test-results/x/trace.zip" };
    expect(Object.keys(reel).sort()).toEqual(["chapters", "trace", "video"]);
    expect(Object.keys(reel.chapters[0] ?? {}).sort()).toEqual(["checkpoint", "criteria", "endMs", "startMs", "title"]);
    expect(typeof reel.chapters[0]?.startMs).toBe("number");
    expect(typeof reel.chapters[0]?.endMs).toBe("number");
    expect(Array.isArray(reel.chapters[0]?.criteria)).toBe(true);
  });
});
