// The showreel's table of contents (v22 WS-4 B2). When a run is filmed (`CUBIT_SHOWREEL=1`), each
// checkpoint paints a titled chapter card over the video (`page.screencast.showChapter`) and files
// an annotation saying WHEN it did. Only a reporter knows when the recording started, so only a
// reporter can turn those instants into offsets into the film — that is this file.
//
// The output is read verbatim by the engine, so its shape is fixed and stated here rather than
// inferred from whatever the run happened to produce:
//
//   { "chapters": [ { "title", "startMs", "endMs", "checkpoint", "criteria": [] } ],
//     "video": string, "trace": string }
//
// A chapter runs until the next one starts; the last runs to the end of its test. `criteria` are
// the ids the test's own title names — the reel is evidence FOR something, and the something is
// written where a reader can check it.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

/** Where the engine looks for it. One path, stated once. */
export const SHOWREEL_PATH = "test-results/showreel.json";

/** The annotation `checkpoint()` files. Its description is JSON so the reporter parses, not scrapes. */
export const CHAPTER_ANNOTATION = "showreel-chapter";

/**
 * The id families this tree writes in a test title, as AM-13 declares them: a letter group, a
 * hyphen, then one or more segments of capitals and digits (`AC-6`, `B-20`, `J-000`, `R-UI-021`,
 * `PERF-011`, `F-RCC6`, `S-AUTH-BREAKER`, `V-E2E`, `I-41`), plus the bare milestone ids `M0`…`M10`.
 * Derived from the titles this suite actually carries, not from the whole family table: an id shape
 * no journey writes would be a regex with nothing behind it.
 */
export const CRITERION = /\b(?:[A-Z]{1,5}-[A-Z0-9]+(?:-[A-Z0-9]+)*|M(?:10|[0-9]))\b/g;

/** The criterion ids a title names, in the order it names them, each one once. */
export function criteriaIn(title: string): string[] {
  return [...new Set(title.match(CRITERION) ?? [])];
}

/** One chapter of the reel, exactly as the engine reads it. */
export interface ShowreelChapter {
  title: string;
  startMs: number;
  endMs: number;
  checkpoint: string;
  criteria: string[];
}

/** The whole file, exactly as the engine reads it. */
export interface Showreel {
  chapters: ShowreelChapter[];
  video: string;
  trace: string;
}

/** What `checkpoint()` writes into the annotation's description. */
interface ChapterMark {
  checkpoint: string;
  atMs: number;
}

/** @returns the marks this test filed, earliest first, ignoring anything that is not one of ours. */
export function marksOf(annotations: readonly { type: string; description?: string }[]): ChapterMark[] {
  const marks: ChapterMark[] = [];
  for (const annotation of annotations) {
    if (annotation.type !== CHAPTER_ANNOTATION || annotation.description === undefined) continue;
    const parsed: unknown = JSON.parse(annotation.description);
    const mark = parsed as Partial<ChapterMark>;
    if (typeof mark.checkpoint !== "string" || typeof mark.atMs !== "number") continue;
    marks.push({ checkpoint: mark.checkpoint, atMs: mark.atMs });
  }
  return marks.sort((left, right) => left.atMs - right.atMs);
}

/**
 * The chapters of one test. A mark's instant is epoch; the reel's clock starts when the recording
 * does, which is when the test did — so every offset is measured from `startTime`. A chapter ends
 * where the next begins, and the last ends where the test did.
 */
export function chaptersOf(title: string, startedAt: number, durationMs: number, marks: readonly ChapterMark[]): ShowreelChapter[] {
  const criteria = criteriaIn(title);
  return marks.map((mark, at) => {
    const startMs = Math.max(0, mark.atMs - startedAt);
    const next = marks[at + 1];
    const endMs = next === undefined ? Math.max(startMs, durationMs) : Math.max(startMs, next.atMs - startedAt);
    return { title: `${title} — ${mark.checkpoint}`, startMs, endMs, checkpoint: mark.checkpoint, criteria };
  });
}

/** The path of the run's video/trace, as Playwright attached it. Empty when the run was not filmed. */
function attachmentPath(result: TestResult, name: string): string {
  return result.attachments.find((attachment) => attachment.name === name)?.path ?? "";
}

export default class ShowreelReporter implements Reporter {
  private readonly chapters: ShowreelChapter[] = [];
  private video = "";
  private trace = "";

  onTestEnd(test: TestCase, result: TestResult): void {
    const marks = marksOf(result.annotations);
    if (marks.length === 0) return;
    this.chapters.push(...chaptersOf(test.titlePath().filter((part) => part !== "").join(" › "), result.startTime.getTime(), result.duration, marks));
    // The reel is one film of one run; the last test that carried a video and a trace names them.
    this.video = attachmentPath(result, "video") || this.video;
    this.trace = attachmentPath(result, "trace") || this.trace;
  }

  onEnd(): void {
    const reel: Showreel = { chapters: this.chapters, video: this.video, trace: this.trace };
    const path = resolve(process.cwd(), SHOWREEL_PATH);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(reel, null, 1)}\n`, "utf8");
    process.stdout.write(`SHOWREEL ${SHOWREEL_PATH} ${this.chapters.length} chapter(s)\n`);
  }
}
