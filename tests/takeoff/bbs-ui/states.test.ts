/**
 * AC-2 (the parts a run can answer without a browser) — the screen's declared readings, its one
 * address, and the copy it says (S-BBS, R-UI-050, R-UI-020, AM-08, AM-09 §2, C-13).
 *
 * The rest of AC-2 — the sixth tab, the crumb, the two aside chips, the rendered `data-state` and
 * the asserted absences — is walked by J-032 in `tests/e2e/journeys/j-032-schedules-notes.spec.ts`,
 * where a customer clicks; and the state matrix's seven cells are graded by the tree's own
 * screen-states, copy-fidelity and route-scan suites the moment the route declares them.
 *
 * What stands here is what those cannot see: that the states are DERIVED in the Decision's own
 * precedence (a denial outranks an offline banner outranks a failed read), that the address has one
 * spelling, and that the words on the screen are the Design Decision's, both ways round.
 *
 * Nothing here opens a database and nothing here measures time (AM-10 §3).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { strings } from "../../../src/ui/strings";
import { goldenBbsDocument, routeAddressModule, statesModule, type BbsStandingShape, type BbsViewShape } from "./support/golden-document";

/** The eight readings `bbs-screen[data-state]` can wear, in the order they resolve (Decision §2). */
const DECLARED = ["loading", "denied", "offline", "error", "refused", "empty", "partial", "ready"];

/** The screen whose Design Decision fixes this copy. */
const DECISION = "docs/design/s-bbs.md";

const REPO_ROOT: string = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** A reading that has everything to show: a pinned campaign, its document, nothing partly declared. */
function wholeView(): BbsViewShape {
  return { campaignId: "campaign-1", setRevisionId: "revision-1", document: goldenBbsDocument(), partial: false };
}

/**
 * The copy table of the Design Decision, as it publishes it: every `key` **Value** pair of §3. The
 * keys are the DOCUMENT'S, so a Decision that re-words a sentence or adds one grows this expectation
 * with it rather than reddening it (B-19, C-13).
 */
function decisionCopy(): Map<string, string> {
  // white-box: AC-2 — the criterion is "docs/design/s-bbs.md carries every `bbs_…` string verbatim
  // in its copy table", which is a claim ABOUT THAT DOCUMENT'S TEXT. It is a design document, not
  // product source: no file under src/, scripts/ or db/ is read here.
  const text = readFileSync(resolve(REPO_ROOT, DECISION), "utf8").replace(/\s+/gu, " ");
  const pairs = new Map<string, string>();
  for (const match of text.matchAll(/`((?:bbs_|takeoff_nav_bbs)[a-z_]*)`\s*\*\*([^*]+)\*\*/gu)) {
    pairs.set(match[1] as string, (match[2] as string).trim());
  }
  return pairs;
}

/** The copy the product publishes for this screen, as its one registry holds it (AM-09 §2). */
function publishedCopy(): Map<string, string> {
  const table = strings as unknown as Record<string, string>;
  return new Map(Object.entries(table).filter(([key]) => key.startsWith("bbs_") || key === "takeoff_nav_bbs"));
}

describe("AC-2: S-BBS declares what it can stand in, where it stands, and what it says", () => {
  it("AC-2: the declared readings are the Decision's eight, in the order they resolve", async () => {
    const { BBS_STATES } = await statesModule();
    expect([...BBS_STATES], "BBS_STATES is the enumerable roster `bbs-screen[data-state]` is drawn from (R-UI-050, B-19)").toEqual(DECLARED);
  });

  it("AC-2: the state is derived in precedence — first holding wins", async () => {
    const { bbsStateOf } = await statesModule();

    // Every condition at once. Peeling the outermost one off must reveal exactly the next reading,
    // which is what "in that precedence" MEANS — a screen that checked emptiness first would answer
    // `empty` to a reader who is not allowed to see the schedule at all (I-bbs-1).
    const everything: BbsStandingShape = { view: null, permitted: false, offline: true, refused: "REQUEST_MALFORMED", state: null };
    expect(bbsStateOf({ ...everything, state: "loading" }), "a reading nobody has yet is `loading`, and the route states it").toBe("loading");
    expect(bbsStateOf(everything), "a reader without MEASURE meets the denial before anything else (I-bbs-1)").toBe("denied");
    expect(bbsStateOf({ ...everything, permitted: true }), "then the offline banner").toBe("offline");
    expect(bbsStateOf({ ...everything, permitted: true, offline: false }), "then the failed read, which has no reading at all").toBe("error");

    const empty: BbsViewShape = { campaignId: null, setRevisionId: null, document: null, partial: false };
    expect(bbsStateOf({ view: empty, permitted: true, offline: false, refused: "REQUEST_MALFORMED" }), "then the one refusal the door answered").toBe("refused");
    expect(bbsStateOf({ view: empty, permitted: true }), "a project with no campaign pinned has nothing to schedule").toBe("empty");

    const noRows: BbsViewShape = { ...wholeView(), document: { ...goldenBbsDocument(), rows: [] } };
    expect(bbsStateOf({ view: noRows, permitted: true }), "and neither has a campaign whose measurement wrote no bar row").toBe("empty");

    const partly: BbsViewShape = { ...wholeView(), partial: true };
    expect(bbsStateOf({ view: partly, permitted: true }), "a campaign with a partly declared rebar line stands PARTIAL, rendered and never hidden").toBe("partial");
    expect(bbsStateOf({ view: wholeView(), permitted: true }), "and a whole one is ready").toBe("ready");
  });

  it("AC-2: the screen has one address, and it is the takeoff lane's sixth tab", async () => {
    const { bbsRoute } = await routeAddressModule();
    expect(bbsRoute("tenant-1", "project-1"), "the one spelling of this screen's address (test contract)").toBe("/t/tenant-1/p/project-1/takeoff/bbs");
  });

  it("AC-2: the words on the screen are the Design Decision's, verbatim and both ways round (C-13)", () => {
    const decision = decisionCopy();
    const published = publishedCopy();
    expect(decision.size, `${DECISION} publishes a copy table for this screen`).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const [key, said] of decision) {
      const value = published.get(key);
      if (value === undefined) missing.push(`${key} is ruled by ${DECISION} and the product publishes no such string`);
      else if (value.replace(/\s+/gu, " ").trim() !== said) missing.push(`${key} reads "${value}" where ${DECISION} rules "${said}"`);
    }
    expect(missing.slice(0, 5), `every sentence the Decision fixes is the sentence the screen says — ${missing.length} disagree`).toEqual([]);

    const unruled: string[] = [];
    for (const [key, value] of published) {
      if (!decision.has(key)) unruled.push(`${key} ("${value}") is said by the screen and ruled by no line of ${DECISION} — copy has one home (C-13, AM-09 §2)`);
    }
    expect(unruled.slice(0, 5), `and no sentence is improvised beside it — ${unruled.length} are`).toEqual([]);

    expect(published.get("takeoff_nav_bbs"), "the sixth tab and the page crumb say the same word").toBe("Bar schedule");
  });
});
