/**
 * THE GOLDEN PATH'S ROSTER (AM-09 §2): "a roster test that derives the leg list from the golden
 * path's own text in this file and fails when a named segment has no executed file".
 *
 * WHY IT EXISTS. J-000 is "extended each milestone and must stay green forever" (Q-03, C-09), and
 * the way that promise is quietly broken is not a red — it is a milestone that lands and never
 * extends the journey. The gate then runs a golden path that walks M0 and calls itself green while
 * the product has grown two more screens. So the required legs are not listed here: they are READ
 * out of the Bible's own J-000 text, and every segment it names must be claimed by a leg file that
 * actually runs. A milestone that lands without its leg is red by construction, in this file.
 *
 * HOW A SEGMENT FINDS ITS LEG. The Bible names the segments; each leg file names the segments it
 * walks, in a `J-000 SEGMENTS:` line of its own header. Nothing here maps one to the other by hand,
 * so a segment the Bible adds is unclaimed until a leg claims it, and a leg that claims a segment
 * the Bible does not name is a leg walking something the golden path does not own.
 *
 * THE TWO GRADES. A segment claimed by an m0..m3 leg is SHIPPED ground: its file must hold a real
 * `test(...)` that runs, or stand whole on a door the product owes. A segment claimed by an m4 leg is
 * ANNOUNCED ground: AM-09 §3 writes that leg into the golden path's text before the milestone exists,
 * and AM-17 keeps it "a declared test.fixme stub citing AM-09 and this amendment" until M4 lands —
 * declared, collected, and impossible to forget.
 *
 * WHAT A STUB SAYS (session 7). A stub at either grade stands on a NAMED door: every `test.fixme` title
 * in it opens `MISSING DOOR: J-000 <leg>:`, <leg> the file's own name, and goes on to say which door
 * — the one spelling `doorStubFaults` reads, so the fixme a runner lists is the door a reader finds.
 * An announced leg also claims ONE segment. The SHIPPED grade judges a door-owing file whole (nothing
 * in it may run), so a file claiming two owed segments could walk neither until both doors land; one
 * file per segment lets the first door to land turn its own file into a walk and move its milestone to
 * SHIPPED, where the files still waiting pass the door rule unchanged. That is why M4's leg is four
 * files, and why an anonymous stub claiming all four segments is refused here.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const BIBLE = join(REPO_ROOT, "docs", "specs", "cubit.bible.xml");
const LEGS_DIR = join(REPO_ROOT, "tests", "e2e", "journeys", "j-000");

/** The journey's id, and the milestone marker the Bible writes ahead of a not-yet-shipped segment. */
const JOURNEY_ID = "J-000";
const MILESTONE_MARKER = /^\[M(\d+)\]\s*/;
/** The rider that carries J-000's M3 and M4 segments, because a clause is never edited (L34, AM-15). */
const RIDER_ID = "AM-17";

/** The milestones whose legs must RUN today, in the order the directory names them (m3 since session 4, AM-17). */
const SHIPPED = ["m0", "m1", "m2", "m3"] as const;
/**
 * The milestones AM-09 §3 writes into the path ahead of the product, as declared stubs. M4 stays here
 * in session 7: the owner ruled "M3 breadth first", nothing of M4 is built, and a milestone none of
 * whose legs runs has not shipped (Q-03). The increment that walks M4's first segment moves it to
 * SHIPPED — and the "AM-09 §3's explicit legs" case below reads this list, so emptying it early would
 * leave that case comparing nothing to nothing.
 */
const ANNOUNCED = ["m4"] as const;

/** The words a stub's title opens with when the product owes its leg a door (AM-09 §2: "a missing screen"). */
const MISSING_DOOR = "MISSING DOOR:";
/** How much a named door must say after its prefix to be found again — the bar the SHIPPED grade set. */
const DOOR_WORDS = 40;

/** The Bible's own J-000 text — the one source of what the golden path walks. */
function journeyText(): string {
  const bible = readFileSync(BIBLE, "utf8");
  const found = new RegExp(`<journey id="${JOURNEY_ID}"[^>]*>([\\s\\S]*?)</journey>`).exec(bible);
  expect(found, `the Bible declares <journey id="${JOURNEY_ID}">, which is what this roster is derived from`).not.toBeNull();
  return (found as RegExpExecArray)[1] ?? "";
}

/**
 * AM-17's rider text. AM-09 §3 announced that the golden path's text would gain an M3 and an M4
 * leg; L34 forbids editing J-000's clause to put them there, so the segments arrive as an amendment
 * rider instead — "the current law for what it names from the moment it lands". The roster reads the
 * rider exactly as it reads the journey: a segment is a segment wherever the Bible writes it.
 */
function riderText(): string {
  const bible = readFileSync(BIBLE, "utf8");
  const found = new RegExp(`<amendment[^>]*id="${RIDER_ID}"[^>]*>([\\s\\S]*?)</amendment>`).exec(bible);
  expect(found, `the Bible carries <amendment id="${RIDER_ID}">, the rider that gives ${JOURNEY_ID} its M3 and M4 segments`).not.toBeNull();
  return (found as RegExpExecArray)[1] ?? "";
}

/** One segment of the golden path, as the Bible writes it, with the milestone it is marked for. */
interface Segment {
  /** The segment's words, with any `[Mn]` marker stripped. */
  readonly name: string;
  /** The milestone the Bible marks it for, or null for the unmarked run at the head of the text. */
  readonly milestone: number | null;
}

/**
 * The golden path's segments, derived. The text is one arrow-separated sentence; the tail carries
 * `[M5]`-style markers, and everything ahead of the first marker is the path as the shipped
 * milestones grew it. The trailing sentence about extension is not a segment and is cut.
 */
export function segmentsOf(text: string): Segment[] {
  return arrowPath(text.split(".")[0] ?? "");
}

/**
 * The rider's segments. AM-17 writes them on the one line under its `J-000 SEGMENTS ADDED` marker,
 * in the path's order and in the path's grammar, so nothing here re-spells what the Bible says.
 */
export function riderSegments(text: string): Segment[] {
  const line = /J-000 SEGMENTS ADDED[^\n]*\n([^\n]*)/.exec(text);
  expect(line, `${RIDER_ID} writes the segments it adds on the line under its "J-000 SEGMENTS ADDED" marker`).not.toBeNull();
  return arrowPath((line as RegExpExecArray)[1] ?? "");
}

/** One arrow-separated path of segments, as both the journey's text and the rider's line write it. */
function arrowPath(path: string): Segment[] {
  return path
    .split(/→|->/)
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map((part) => {
      const marked = MILESTONE_MARKER.exec(part);
      return { name: part.replace(MILESTONE_MARKER, "").trim(), milestone: marked === null ? null : Number(marked[1] ?? "0") };
    });
}

/** Every segment the Bible names, journey text and rider together, in the path's order. */
function allSegments(): Segment[] {
  return [...segmentsOf(journeyText()), ...riderSegments(riderText())];
}

/** The segments that must be claimed by a leg today: everything the Bible has not deferred past M4. */
function requiredSegments(): string[] {
  return allSegments()
    .filter((segment) => segment.milestone === null || segment.milestone <= 4)
    .map((segment) => segment.name);
}

/** One leg file, and what it says about itself. */
interface Leg {
  readonly file: string;
  readonly milestone: string;
  readonly source: string;
  readonly segments: string[];
}

/** One leg file read from its name and its text: its milestone, and the segments its header claims. */
export function legOf(file: string, source: string): Leg {
  const claimed = /J-000 SEGMENTS:([^\n]*)/.exec(source);
  return {
    file,
    milestone: (/^(m\d+)-/.exec(file)?.[1] ?? "").toString(),
    source,
    segments: (claimed?.[1] ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part !== ""),
  };
}

/** Every leg file in the golden path's directory, with the segments it claims. */
function legs(): Leg[] {
  return readdirSync(LEGS_DIR)
    .filter((name) => name.endsWith(".spec.ts"))
    .sort()
    .map((file) => legOf(file, readFileSync(join(LEGS_DIR, file), "utf8")));
}

/** Does this file hold a test that will actually RUN (rather than only a declared stub)? */
function runsATest(source: string): boolean {
  return /(^|\s)test\s*\(/m.test(source);
}

/**
 * WHAT IS WRONG WITH A STUB THAT STANDS ON A DOOR — the one reading of the rule, at either grade.
 *
 * A door-owing leg runs nothing, declares its walk as a `test.fixme`, and every fixme title opens
 * `MISSING DOOR: J-000 <leg>:` in the file's own leg name and then says which door, in more than
 * DOOR_WORDS characters. A title that opens with anything else is the stub this roster used to admit —
 * "J-000 m4-sheet-and-manual-measure: a PDF sheet ingested and corroborated, …", naming four segments
 * and no door — and a fixme whose title is not a literal is a door nobody can read, so it is counted
 * against the literals found. Exported so the rule is proved on payloads, not only on today's tree.
 */
export function doorStubFaults(leg: Pick<Leg, "file" | "source">): string[] {
  const faults: string[] = [];
  const prefix = `${MISSING_DOOR} ${JOURNEY_ID} ${leg.file.replace(/\.spec\.ts$/, "")}:`;
  const declared = (leg.source.match(/\btest\.fixme\s*\(/g) ?? []).length;
  const titles = [...leg.source.matchAll(/\btest\.fixme\s*\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g)].map((match) => match[1] ?? match[2] ?? match[3] ?? "");
  if (declared === 0) faults.push(`${leg.file} owes a door, so its walk stands as a test.fixme until the door lands`);
  if (titles.length !== declared) faults.push(`${leg.file} declares ${declared - titles.length} test.fixme whose title is not a literal — a door nobody can read is not named`);
  if (runsATest(leg.source)) faults.push(`${leg.file} cannot be walked yet, so nothing in it may run and report green`);
  for (const title of titles) {
    if (!title.startsWith(prefix)) faults.push(`${leg.file}: "${title}" does not open "${prefix}" — a stub on the golden path names the door it waits on, in its own leg's name`);
    else if (title.slice(prefix.length).trim().length <= DOOR_WORDS) faults.push(`${leg.file}: "${title}" says too little to name WHICH door the product owes`);
  }
  return faults;
}

/**
 * What is wrong with an ANNOUNCED leg: everything `doorStubFaults` refuses, plus a claim of other than
 * ONE segment (see the header: a door-owing file ships whole or not at all), and a text that does not
 * cite AM-09 and AM-17 — the rider's own words are "citing AM-09 and this amendment".
 */
export function announcedLegFaults(leg: Pick<Leg, "file" | "source" | "segments">): string[] {
  const faults = doorStubFaults(leg);
  if (leg.segments.length !== 1) {
    faults.push(`${leg.file} claims ${leg.segments.length} segments (${leg.segments.join("; ")}) — an announced leg claims ONE, so the door that lands first walks its own file and splits no other`);
  }
  for (const clause of ["AM-09", RIDER_ID]) if (!leg.source.includes(clause)) faults.push(`${leg.file} cites ${clause}, the clause that owes it`);
  return faults;
}

/** One runnable leg in a file: the title it declares and how much of the product it judges. */
export interface LegTest {
  readonly title: string;
  /** How many `expect(` calls stand in this test's body. Zero is a leg that walks and judges nothing. */
  readonly assertions: number;
}

/**
 * THE ASSERTIONS EACH RUNNABLE TEST MAKES (P4b §5).
 *
 * `runsATest` only proves the text `test(` occurs, so a leg gutted to `test("J-000 m1: …", async ()
 * => {})` is a shipped milestone's leg in good standing: collected, green, and judging nothing. The
 * roster therefore counts what the leg ASSERTS, per test rather than per file — a file whose first
 * leg asserts twenty and whose second asserts nothing is exactly the case a file-wide count hides.
 *
 * The body of a test runs to the next test declaration in the file, which is what a `test(` at the
 * top level means: they do not nest. `expect(` is counted wherever it stands in that span, including
 * inside a helper the leg declares for itself — a helper is where a leg's assertions often live.
 */
export function assertionsPerLeg(source: string): LegTest[] {
  const declaration = /\btest(?:\.fixme|\.skip|\.only)?\s*\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;
  const found = [...source.matchAll(declaration)];
  return found
    .map((match, at) => {
      const title = match[1] ?? match[2] ?? match[3] ?? "";
      const runnable = /\btest\s*\($/.test(source.slice(Math.max(0, match.index - 2), match.index + match[0].indexOf("(") + 1));
      const body = source.slice(match.index, found[at + 1]?.index ?? source.length);
      return { title, assertions: runnable ? (body.match(/\bexpect(?:\.soft)?\s*\(/g) ?? []).length : -1 };
    })
    .filter((leg) => leg.assertions >= 0);
}

describe("AM-09 §2: the golden path is a directory, and its legs are derived from the Bible", () => {
  it("every leg file names a milestone and is collected under the journey's own id", () => {
    const found = legs();
    expect(found.length, `tests/e2e/journeys/j-000/ holds the golden path's leg files`).toBeGreaterThan(0);
    for (const leg of found) {
      expect(leg.milestone, `${leg.file} is named <milestone>-<leg>.spec.ts, so the roster can read which milestone owes it`).toMatch(/^m\d+$/);
      const titles = [...leg.source.matchAll(/\btest(?:\.fixme|\.skip)?\s*\(\s*"([^"]+)"/g)].map((match) => match[1] ?? "");
      expect(titles.length, `${leg.file} declares at least one test`).toBeGreaterThan(0);
      for (const title of titles) {
        expect(title, `every title in ${leg.file} carries ${JOURNEY_ID} — the runner selects a journey by its title grep, and a leg it cannot collect is green by omission`).toContain(
          JOURNEY_ID,
        );
      }
    }
  });

  it("every segment the Bible's J-000 text names is claimed by exactly one leg file", () => {
    const claimed = new Map<string, string[]>();
    for (const leg of legs()) for (const segment of leg.segments) claimed.set(segment, [...(claimed.get(segment) ?? []), leg.file]);

    const required = requiredSegments();
    expect(required.length, "the Bible's J-000 text names the segments this roster is derived from").toBeGreaterThan(5);

    const unclaimed = required.filter((segment) => !claimed.has(segment));
    expect(
      unclaimed,
      `the Bible's golden path names these segments and no leg file under tests/e2e/journeys/j-000/ walks them — a milestone that lands without its leg is red here (AM-09 §2):\n  ${unclaimed.join("\n  ")}`,
    ).toEqual([]);

    const twice = [...claimed.entries()].filter(([, files]) => files.length > 1);
    expect(twice.map(([segment, files]) => `${segment} → ${files.join(", ")}`), "one segment, one leg — two legs walking one segment is two answers to one question (B-17)").toEqual([]);

    const invented = [...claimed.keys()].filter((segment) => !required.includes(segment));
    expect(invented, `these leg files claim segments the Bible's J-000 text does not name:\n  ${invented.join("\n  ")}`).toEqual([]);
  });

  it("a milestone's marked segments are claimed by that milestone's legs — dropping a leg's SEGMENTS line is RED here (AM-17)", () => {
    // WHY THIS CASE EXISTS. Until AM-17 the Bible marked no segment for M3 or M4, so the previous
    // assertion — "every segment is claimed" — could not notice that m4-sheet-and-manual-measure.spec.ts
    // carried no `J-000 SEGMENTS:` line at all. It passed by having nothing to claim. A leg that
    // drops its line must be red, and it must be red with the milestone's name on it, so this reads
    // the claim map per milestone rather than over the whole roster.
    const claimedBy = new Map<string, string>();
    for (const leg of legs()) for (const segment of leg.segments) claimedBy.set(segment, leg.milestone);

    const marked = allSegments().filter((segment) => segment.milestone !== null && segment.milestone <= 4);
    expect(marked.length, "AM-17 marks J-000's M3 and M4 segments, which is what binds a leg to its own milestone").toBeGreaterThan(0);

    const misfiled = marked
      .map((segment) => ({ segment, owner: `m${segment.milestone}`, claimant: claimedBy.get(segment.name) }))
      .filter((row) => row.claimant !== row.owner)
      .map((row) => `${row.owner} owes "${row.segment.name}" — claimed by ${row.claimant === undefined ? "NO leg file (its leg dropped its J-000 SEGMENTS line, or never wrote one)" : `an ${row.claimant} leg`}`);
    expect(
      misfiled,
      `the Bible marks these segments for a milestone whose leg does not claim them (AM-17):\n  ${misfiled.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every milestone the Bible marks has a leg that claims something — an empty claim set is the vacuum AM-17 closes", () => {
    const marked = allSegments().filter((segment) => segment.milestone !== null && segment.milestone <= 4);
    const owed = [...new Set(marked.map((segment) => `m${segment.milestone}`))].sort();
    const claiming = new Set(legs().filter((leg) => leg.segments.length > 0).map((leg) => leg.milestone));
    const silent = owed.filter((milestone) => !claiming.has(milestone));
    expect(silent, `these milestones are owed segments by the Bible and no leg file of theirs claims one:\n  ${silent.join("\n  ")}`).toEqual([]);
  });

  it("a shipped milestone's leg RUNS or stands on a named door, and an announced one is a named-door stub for ONE segment citing AM-09 and AM-17", () => {
    for (const leg of legs()) {
      if ((SHIPPED as readonly string[]).includes(leg.milestone)) {
        // A shipped milestone's leg RUNS — unless the product owes it a door. AM-09 §2 ends "a leg
        // that cannot be reached through the UI is a missing screen, not a licence to stage", so the
        // one lawful stub at a shipped milestone is one that NAMES the missing screen. Deleting that
        // line is what the increment landing the door does, and this assertion is what then demands
        // the walk. A stub with no named door is the old failure — a leg quietly not walked.
        if (leg.source.includes(MISSING_DOOR)) {
          expect(doorStubFaults(leg), `${leg.file} declares a MISSING DOOR, so it stands whole on that door, named in every stub's title`).toEqual([]);
          continue;
        }
        expect(runsATest(leg.source), `${leg.file} is a shipped milestone's leg, so it must hold a test that runs — not only a stub`).toBe(true);
        continue;
      }
      if (!(ANNOUNCED as readonly string[]).includes(leg.milestone)) continue;
      expect(
        announcedLegFaults(leg),
        `${leg.file} is an announced milestone's leg: a test.fixme stub, running nothing, claiming one segment, naming the door that segment waits on, and citing AM-09 and ${RIDER_ID}`,
      ).toEqual([]);
    }
  });

  it("AM-09 §3's explicit M3 and M4 legs are declared, because the amendment writes them into the path", () => {
    const amendment = readFileSync(BIBLE, "utf8");
    const explicit = /\(3\) EXPLICIT LEGS\.([\s\S]*?)\(4\)/.exec(amendment);
    expect(explicit, "AM-09 §3 names the two legs the golden path's text gained").not.toBeNull();
    const named = (explicit as RegExpExecArray)[1] ?? "";
    const owed = (ANNOUNCED as readonly string[]).filter((milestone) => new RegExp(`an ${milestone.toUpperCase()} leg`).test(named));
    expect(owed, "the amendment names an M3 leg and an M4 leg").toEqual([...ANNOUNCED]);

    const declared = legs().map((leg) => leg.milestone);
    for (const milestone of owed) {
      expect(declared, `AM-09 §3 writes ${milestone.toUpperCase()}'s leg into the golden path, so a ${milestone}-*.spec.ts must stand in the directory`).toContain(milestone);
    }
  });

  it("a leg that runs makes assertions — a gutted body is a shipped leg judging nothing (P4b §5)", () => {
    for (const leg of legs()) {
      if (!(SHIPPED as readonly string[]).includes(leg.milestone)) continue;
      if (leg.source.includes(MISSING_DOOR)) continue;
      const running = assertionsPerLeg(leg.source);
      expect(running.length, `${leg.file} is a shipped milestone's leg, so it holds at least one test that runs`).toBeGreaterThan(0);
      const silent = running.filter((one) => one.assertions === 0).map((one) => `${leg.file} — "${one.title}"`);
      expect(
        silent,
        `these legs walk the golden path and judge nothing: a \`test\` with no \`expect(\` in it is green by construction, and AM-09 §2's promise that the path "must stay green forever" is worth exactly what it asserts:\n  ${silent.join("\n  ")}`,
      ).toEqual([]);
    }
  });

  it("no leg is hand-staged: a leg file installs no product state outside the browser (AM-09 §2)", () => {
    for (const leg of legs()) {
      const imports = [...leg.source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1] ?? "");
      // The test-id REGISTRY is not product state: it declares the names a leg clicks, and AM-09 §1
      // requires a page object to read it rather than invent an id. Importing it stages nothing.
      const staged = imports
        .filter((specifier) => !/(^|\/)src\/ui\/testids$/.test(specifier))
        .filter((specifier) => /(^|\/)src\//.test(specifier) || /-stage(\.|$)/.test(specifier) || /db\/__tests__/.test(specifier));
      expect(
        staged,
        `${leg.file} reaches for product modules or a stage instead of clicking what a customer clicks — "a leg that cannot be reached through the UI is a missing screen, not a licence to stage" (AM-09 §2):\n  ${staged.join("\n  ")}`,
      ).toEqual([]);
    }
  });
});

describe("the roster's own counter, proved on payloads rather than on the tree (P4b §5)", () => {
  it("reads an emptied body as zero assertions, and a walked one as what it judges", () => {
    const source = [
      'test("J-000 m1: the discipline is confirmed", async () => {',
      "  await page.goto('/');",
      "});",
      'test("J-000 m1: and the offer is gone", async ({ page }) => {',
      '  await expect(page.getByTestId("offer")).toHaveCount(0);',
      '  expect(await steadyCount(rows, "rows")).toBe(3);',
      "});",
      "",
    ].join("\n");
    expect(assertionsPerLeg(source)).toEqual([
      { title: "J-000 m1: the discipline is confirmed", assertions: 0 },
      { title: "J-000 m1: and the offer is gone", assertions: 2 },
    ]);
  });

  it("does not count a declared stub's body — a fixme asserts nothing on purpose", () => {
    expect(assertionsPerLeg('test.fixme("J-000 m3: the bill is emitted", async () => {\n  await nothing();\n});\n')).toEqual([]);
  });
});

describe("the door rule, proved on payloads rather than on the tree (session 7)", () => {
  /** A leg's text as the roster reads it: a header claiming its segments, citing its clauses, then its declarations. */
  function legText(segments: string, declarations: readonly string[], header = "Declared before the milestone lands (AM-09 §3, AM-17)."): string {
    return ["/**", ` * J-000 SEGMENTS: ${segments}`, " *", ` * ${header}`, " */", 'import { test } from "@playwright/test";', "", ...declarations, ""].join("\n");
  }

  /** A door that says which door, as a stub's title must. */
  const DOOR = "cad has no PDF or raster extractor, and the gate has no AGREED exit for a corroborated INTERPRETED sighting";

  it("refuses an m4 fixme WITHOUT \"MISSING DOOR:\" — the anonymous stub that claimed all four M4 segments", () => {
    const anonymous = legText("ingest and corroborate a PDF sheet; measure a manual condition; take rooms and finishes; ask the drawings a question", [
      'test.fixme("J-000 m4-sheet-and-manual-measure: a PDF sheet ingested and corroborated, a manual condition measured, rooms and finishes taken, and a question asked of the drawings", () => {});',
    ]);
    expect(announcedLegFaults(legOf("m4-sheet-and-manual-measure.spec.ts", anonymous))).toEqual([
      expect.stringContaining('does not open "MISSING DOOR: J-000 m4-sheet-and-manual-measure:"'),
      expect.stringContaining("claims 4 segments"),
    ]);
  });

  it("refuses it even where the header names a door — the title is what the runner lists and the roster reads", () => {
    const headed = legText("ingest and corroborate a PDF sheet", ['test.fixme("J-000 m4-pdf-sheet: a PDF sheet ingested and corroborated", () => {});'], `MISSING DOOR: ${DOOR} (AM-09 §3, AM-17).`);
    expect(announcedLegFaults(legOf("m4-pdf-sheet.spec.ts", headed))).toEqual([expect.stringContaining('does not open "MISSING DOOR: J-000 m4-pdf-sheet:"')]);
    expect(doorStubFaults(legOf("m3-bar-schedule.spec.ts", headed.replaceAll("m4-pdf-sheet", "m3-bar-schedule"))), "and the SHIPPED grade reads the same rule").toEqual([
      expect.stringContaining('does not open "MISSING DOOR: J-000 m3-bar-schedule:"'),
    ]);
  });

  it("admits a stub that names its door in its own leg's name, for one segment, citing AM-09 and AM-17", () => {
    const named = legText("ingest and corroborate a PDF sheet", [`test.fixme("MISSING DOOR: J-000 m4-pdf-sheet: ${DOOR}", () => {});`]);
    expect(announcedLegFaults(legOf("m4-pdf-sheet.spec.ts", named))).toEqual([]);
  });

  it("refuses a door in another leg's name, a door that says nothing, and an announced leg that forgets its clauses", () => {
    const borrowed = legText("take rooms and finishes", [`test.fixme("MISSING DOOR: J-000 m4-pdf-sheet: ${DOOR}", () => {});`]);
    expect(announcedLegFaults(legOf("m4-rooms-and-finishes.spec.ts", borrowed))).toEqual([expect.stringContaining('does not open "MISSING DOOR: J-000 m4-rooms-and-finishes:"')]);

    const mute = legText("ingest and corroborate a PDF sheet", ['test.fixme("MISSING DOOR: J-000 m4-pdf-sheet: owed", () => {});']);
    expect(announcedLegFaults(legOf("m4-pdf-sheet.spec.ts", mute))).toEqual([expect.stringContaining("says too little")]);

    const uncited = legText("ingest and corroborate a PDF sheet", [`test.fixme("MISSING DOOR: J-000 m4-pdf-sheet: ${DOOR}", () => {});`], "Declared before the milestone lands.");
    expect(announcedLegFaults(legOf("m4-pdf-sheet.spec.ts", uncited))).toEqual([expect.stringContaining("cites AM-09"), expect.stringContaining(`cites ${RIDER_ID}`)]);
  });

  it("refuses a door stub beside a leg that runs, and a fixme whose title is not a literal", () => {
    const beside = legText("ingest and corroborate a PDF sheet", [
      `test.fixme("MISSING DOOR: J-000 m4-pdf-sheet: ${DOOR}", () => {});`,
      'test("J-000 m4-pdf-sheet: the sheet opens", async () => {\n  expect(1).toBe(1);\n});',
    ]);
    expect(announcedLegFaults(legOf("m4-pdf-sheet.spec.ts", beside))).toEqual([expect.stringContaining("nothing in it may run")]);

    const computed = legText("ingest and corroborate a PDF sheet", ["test.fixme(TITLE, () => {});"]);
    expect(announcedLegFaults(legOf("m4-pdf-sheet.spec.ts", computed))).toEqual([expect.stringContaining("title is not a literal")]);
  });
});
