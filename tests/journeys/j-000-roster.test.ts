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
 * THE TWO GRADES. A segment claimed by an m0/m1/m2 leg is SHIPPED ground: its file must hold a real
 * `test(...)` that runs. A segment claimed by an m3/m4 leg is ANNOUNCED ground: AM-09 §3 writes those
 * two legs into the golden path's text before the milestones exist, so the file must stand as a
 * `test.fixme` stub citing the clause that owes it — declared, collected, and impossible to forget.
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

/** The milestones whose legs must RUN today, in the order the directory names them. */
const SHIPPED = ["m0", "m1", "m2"] as const;
/** The milestones AM-09 §3 writes into the path ahead of the product, as declared stubs. */
const ANNOUNCED = ["m3", "m4"] as const;

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

/** Every leg file in the golden path's directory, with the segments it claims. */
function legs(): Leg[] {
  return readdirSync(LEGS_DIR)
    .filter((name) => name.endsWith(".spec.ts"))
    .sort()
    .map((file) => {
      const source = readFileSync(join(LEGS_DIR, file), "utf8");
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
    });
}

/** Does this file hold a test that will actually RUN (rather than only a declared stub)? */
function runsATest(source: string): boolean {
  return /(^|\s)test\s*\(/m.test(source);
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

  it("a shipped milestone's leg RUNS, and an announced one is a declared stub citing its clause", () => {
    for (const leg of legs()) {
      if ((SHIPPED as readonly string[]).includes(leg.milestone)) {
        // A shipped milestone's leg RUNS — unless the product owes it a door. AM-09 §2 ends "a leg
        // that cannot be reached through the UI is a missing screen, not a licence to stage", so the
        // one lawful stub at a shipped milestone is one that NAMES the missing screen. Deleting that
        // line is what the increment landing the door does, and this assertion is what then demands
        // the walk. A stub with no named door is the old failure — a leg quietly not walked.
        const owed = /MISSING DOOR:([^\n]*)/.exec(leg.source);
        if (owed !== null) {
          expect((owed[1] ?? "").trim().length, `${leg.file} declares a MISSING DOOR, so it must say WHICH door the product owes`).toBeGreaterThan(40);
          expect(/test\.fixme\s*\(/.test(leg.source), `${leg.file} names a missing door, so its walk stands as a test.fixme until the door lands`).toBe(true);
          expect(runsATest(leg.source), `${leg.file} cannot be walked yet, so nothing in it may run and report green`).toBe(false);
          continue;
        }
        expect(runsATest(leg.source), `${leg.file} is a shipped milestone's leg, so it must hold a test that runs — not only a stub`).toBe(true);
        continue;
      }
      if (!(ANNOUNCED as readonly string[]).includes(leg.milestone)) continue;
      expect(/test\.fixme\s*\(/.test(leg.source), `${leg.file} is an announced milestone's leg, so it stands as a test.fixme stub until the milestone lands`).toBe(true);
      expect(runsATest(leg.source), `${leg.file}'s milestone has not shipped, so nothing in it may run yet`).toBe(false);
      expect(leg.source, `${leg.file} cites the Bible clause that owes it`).toMatch(/AM-09/);
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

  it("no leg is hand-staged: a leg file installs no product state outside the browser (AM-09 §2)", () => {
    for (const leg of legs()) {
      const imports = [...leg.source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1] ?? "");
      const staged = imports.filter((specifier) => /(^|\/)src\//.test(specifier) || /-stage(\.|$)/.test(specifier) || /db\/__tests__/.test(specifier));
      expect(
        staged,
        `${leg.file} reaches for product modules or a stage instead of clicking what a customer clicks — "a leg that cannot be reached through the UI is a missing screen, not a licence to stage" (AM-09 §2):\n  ${staged.join("\n  ")}`,
      ).toEqual([]);
    }
  });
});
