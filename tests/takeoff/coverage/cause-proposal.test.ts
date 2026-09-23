/**
 * The caller's half of R-TO-052's cause question (L-AI-01, L-AI-02, L-AI-03, s-coverage I-297).
 *
 * CODE decides which cell is asked about, which key an answer may cite, which causes an answer may
 * be read back out of, and what a low-confidence answer is worth. The model chooses one of two
 * causes and cites the key it was given — nothing more. Every one of those decisions is pure and is
 * judged here, with no database and no seam: `coverageCauseProposalOf` puts them together over a
 * real residue, and that is the db lane's (tests/takeoff/coverage/cause-outcome.db.test.ts).
 */
import { describe, expect, test } from "vitest";
import { REFUSALS, SCOPE_DECLARATION_CAUSES } from "@/core/errors";
import { requestHash, sourceKeyResolver, type Proposal } from "@/core/model";
import { placementKey, viewKey } from "@/core/identity";
import type { ResidueCell, Sighting } from "@/core/residue/law";
import {
  COVERAGE_CAUSE_CONFIDENCE_FLOOR,
  COVERAGE_CAUSE_MODEL,
  anchorSourceKeyOf,
  asksACause,
  citableKeyOf,
  coverageCauseRequest,
  coverageCauseStateOf,
  isCoverageCauseState,
  proposeCoverageCause,
  readCoverageCauseProposal,
  standsAboveFloor,
  type CoverageCauseState,
} from "@/modules/takeoff/coverage/cause-proposal";

const ANCHOR = "DXF_HANDLE:10A2";
const VIEW = viewKey({ viewClass: "PLAN", captionAnchorSourceKey: ANCHOR });

const STATE: CoverageCauseState = {
  cell: { kind: "rcc.concrete", class: "column", level: "2F", ordinal: 2 },
  key: ANCHOR,
  sightings: [{ channel: "PARTITION", layout: "S-10 COLUMN LAYOUT PLAN" }],
  observations: [{ rail: "column/rcc.concrete", reason: REFUSALS.PLAN_READING_ABSENT.message }],
};

/** One sighting, as a channel answers one. */
function sighting(over: Partial<Sighting> = {}): Sighting {
  return { class: "column", levelId: "level-1", channel: "PARTITION", drawingId: "drawing-1", layoutName: "S-10 COLUMN LAYOUT PLAN", sourceKey: VIEW, ...over };
}

/** One cell of the residue, as `resolveResidue` answers one — the fall-through reading by default. */
function cell(over: Partial<ResidueCell> = {}): ResidueCell {
  return {
    kind: "rcc.concrete",
    class: "column",
    levelId: "level-1",
    levelLabel: "2F",
    levelOrdinal: 2,
    grain: "CELL",
    measurement: "NOT_ESTABLISHED",
    bill: "IN_BILL",
    contradicted: false,
    lineIds: [],
    sightings: [sighting()],
    observations: [{ class: "column", kind: "rcc.concrete", levelId: "level-1", rail: "column/rcc.concrete", reason: REFUSALS.PLAN_READING_ABSENT.message }],
    measurementActId: null,
    billActId: null,
    ...over,
  };
}

describe("the request one unmeasured cell is asked about", () => {
  test("it is a pure function of the state: the same cell makes the same request, and the same hash, forever", () => {
    const once = coverageCauseRequest(STATE);
    const again = coverageCauseRequest({ ...STATE, cell: { ...STATE.cell }, sightings: [...STATE.sightings], observations: [...STATE.observations] });
    expect(requestHash(once)).toBe(requestHash(again));
    expect(once.question, "the ledger files the call under the question's own name").toBe("coverage-cause");
    expect(once.modelId, "AS-05 pins the id the call is billed under until the owner's amendment lands").toBe(COVERAGE_CAUSE_MODEL);
  });

  test("its content carries no uuid, so a recorded fixture replays in every lane (L-AI-01)", () => {
    const content = coverageCauseRequest(STATE).messages[0]?.content ?? "";
    expect(content, "no drawing id, level id, campaign id or call id is hashed into the request").not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu,
    );
    expect(JSON.parse(content), "the content is exactly the key set the adapter's arm recognises").toHaveProperty("observations");
    expect(Object.keys(JSON.parse(content) as object).sort()).toEqual(["cell", "key", "observations", "sightings"]);
  });

  test("the system prompt states the closed vocabulary it will accept an answer out of", () => {
    const system = coverageCauseRequest(STATE).system;
    for (const cause of SCOPE_DECLARATION_CAUSES) expect(system).toContain(cause);
  });

});

describe("the one key an answer may cite, recovered from what the campaign sighted", () => {
  test("a view key carries its caption anchor, and a placement key carries the same one", () => {
    expect(anchorSourceKeyOf(VIEW)).toBe(ANCHOR);
    expect(anchorSourceKeyOf(placementKey({ view: { viewClass: "PLAN", captionAnchorSourceKey: ANCHOR }, mark: "C9", x: 1, y: 2 }))).toBe(ANCHOR);
  });

  test("a key whose anchor is no source key answers null, and the cell is then never asked about", () => {
    expect(anchorSourceKeyOf("v:PLAN:S-101:t:12"), "a caption key of the wrong grammar is not a lawful citation (L-CAD-02)").toBeNull();
    expect(anchorSourceKeyOf("S-101:t:12")).toBeNull();
    expect(anchorSourceKeyOf("drawing-1")).toBeNull();
    expect(citableKeyOf(cell({ sightings: [sighting({ sourceKey: "v:PLAN:S-101:t:12" })] }))).toBeNull();
  });

  test("the key is the canonically FIRST anchor the cell's own sightings yield, never the query's order", () => {
    const early = "DXF_HANDLE:0A11";
    const late = "DXF_HANDLE:F002";
    const sighted = [
      sighting({ sourceKey: viewKey({ viewClass: "PLAN", captionAnchorSourceKey: late }) }),
      sighting({ channel: "LAYOUT", sourceKey: viewKey({ viewClass: "SECTION", captionAnchorSourceKey: early }) }),
    ];
    expect(citableKeyOf(cell({ sightings: sighted }))).toBe(early);
    expect(citableKeyOf(cell({ sightings: [...sighted].reverse() })), "the choice is a fact about the cell, not about the row order").toBe(early);
  });
});

describe("which cell is asked about at all — code's decision, never the model's (L-AI-03)", () => {
  test("the fall-through reading of an addressable, undeclared, citable cell is asked", () => {
    expect(asksACause(cell())).toBe(true);
    expect(coverageCauseStateOf(cell())).toEqual(STATE);
  });

  test("a caption's declaration of the class never enters the state, so no recorded question is re-keyed by it (s-coverage I-479)", () => {
    const declared = sighting({ levelId: null, channel: "LAYOUT", sourceKey: "DXF_HANDLE:C0L", declared: true, caption: "COLUMN SCHEDULE" });
    expect(coverageCauseStateOf(cell({ sightings: [sighting(), declared] })), "the same state, and so the same request hash, as the cell without it").toEqual(STATE);
  });

  test("every other cell is not: a reading already explained, a grain nobody may declare over, a boundary already drawn", () => {
    expect(asksACause(cell({ measurement: "QUANTITY_BEARING" })), "a measured cell explains itself").toBe(false);
    expect(asksACause(cell({ measurement: "INGESTION_TRUNCATED" })), "the machine's own causes win before the fall-through ever stands").toBe(false);
    expect(asksACause(cell({ measurement: "NO_BEARER_SIGHTED" }))).toBe(false);
    expect(asksACause(cell({ grain: "KIND", class: null, levelId: null })), "a kind-grain row names no cell a person could declare over (I-194)").toBe(false);
    expect(asksACause(cell({ levelId: null })), "a cell naming no level is a cell no declaration can address").toBe(false);
    expect(asksACause(cell({ bill: "NOT_IN_THIS_BILL", billActId: "act-1" })), "a person has already drawn this boundary").toBe(false);
    expect(asksACause(cell({ measurementActId: "act-2" }))).toBe(false);
    expect(asksACause(cell({ sightings: [] })), "a cell with nothing citable is never asked — no question, no ledger row").toBe(false);
    for (const refused of [{ measurement: "QUANTITY_BEARING" as const }, { levelId: null }, { sightings: [] }]) {
      expect(coverageCauseStateOf(cell(refused)), "the gate and the reading are one function").toBeNull();
    }
  });

  test("the state a gate admits is one the recorder's own guard reads back", () => {
    expect(isCoverageCauseState(coverageCauseStateOf(cell()))).toBe(true);
    expect(isCoverageCauseState({ ...STATE, key: "S-101:t:12" }), "a state citing no lawful source key is no state").toBe(false);
    expect(isCoverageCauseState({ ...STATE, cell: { ...STATE.cell, ordinal: "2" } })).toBe(false);
    expect(isCoverageCauseState({ ...STATE, observations: [{ rail: "column/rcc.concrete" }] })).toBe(false);
    expect(isCoverageCauseState(null)).toBe(false);
  });
});

describe("what an answer is read back as — the declarable set, and nothing wider (L-AI-02)", () => {
  const decode = readCoverageCauseProposal(SCOPE_DECLARATION_CAUSES);

  test("the two causes a person may declare are accepted, read back OUT of the caller's own set", () => {
    for (const cause of SCOPE_DECLARATION_CAUSES) expect(decode({ cause })).toEqual({ ok: true, value: { cause } });
  });

  test("the honest abstention is a refusal, not a stored cause", () => {
    const refused = decode({ cause: "NOTHING_TO_DECLARE" });
    expect(refused.ok).toBe(false);
    expect(refused.ok ? "" : refused.detail, "the detail names the set an answer is read out of").toContain("NOT_IN_PROJECT_SCOPE");
  });

  test("a cause nobody may declare, a null choice and a payload naming anything else are all refused", () => {
    expect(decode({ cause: "INGESTION_TRUNCATED" }).ok, "a machine cause is no boundary a person draws").toBe(false);
    expect(decode({ cause: null }).ok).toBe(false);
    expect(decode({ type: "NOT_IN_THIS_BILL" }).ok, "a proposed cause names exactly `cause`").toBe(false);
    expect(decode({ cause: "NOT_IN_THIS_BILL", why: "the drawings say so" }).ok).toBe(false);
    expect(decode("NOT_IN_THIS_BILL").ok).toBe(false);
    expect(decode(null).ok).toBe(false);
  });
});

describe("what a proposal is worth to the caller — the threshold is the caller's policy, never the seam's", () => {
  test("a confidence at the floor stands; below it, and with none at all, no proposal is shown", () => {
    expect(standsAboveFloor(COVERAGE_CAUSE_CONFIDENCE_FLOOR)).toBe(true);
    expect(standsAboveFloor(0.999)).toBe(true);
    expect(standsAboveFloor(COVERAGE_CAUSE_CONFIDENCE_FLOOR - 0.0001)).toBe(false);
    expect(standsAboveFloor(null), "an unjudged proposal is one nobody can calibrate").toBe(false);
  });

  test("the floor is a number a recorded corpus is read against, stated once and in range", () => {
    expect(COVERAGE_CAUSE_CONFIDENCE_FLOOR).toBeGreaterThan(0);
    expect(COVERAGE_CAUSE_CONFIDENCE_FLOOR).toBeLessThanOrEqual(1);
  });
});

describe("the certificate's sentence for a proposed cause is the register's own (I-191, R-SPINE-062)", () => {
  test("each declarable cause carries the very sentence the statement row prints", () => {
    for (const cause of SCOPE_DECLARATION_CAUSES) {
      expect(REFUSALS[cause].message.length, `${cause} states its own sentence`).toBeGreaterThan(20);
      expect(REFUSALS[cause].code).toBe(cause);
    }
  });
});

describe("the call itself goes through the seam's one path, and a refusal reaches the caller intact", () => {
  test("the port is handed a request this state composes, and answers the caller's typed proposal", async () => {
    let asked = "";
    const proposal = await proposeCoverageCause(
      { tenantId: "t", projectId: "p", actor: "user:test", requestId: "req-1" },
      { state: STATE, declarable: SCOPE_DECLARATION_CAUSES, artifact: sourceKeyResolver("rev-1", [STATE.key]) },
      {
        propose: async (_ctx, request, contract) => {
          asked = requestHash(request);
          const decoded = contract.decode({ cause: "NOT_IN_THIS_BILL" } as never);
          expect(decoded.ok, "the caller's own decoder reads the payload").toBe(true);
          return { payload: decoded.ok ? decoded.value : null, sources: [STATE.key], model: request.modelId, callId: "call-1" } as unknown as Proposal<never>;
        },
      },
    );
    expect(asked).toBe(requestHash(coverageCauseRequest(STATE)));
    expect(proposal.payload).toEqual({ cause: "NOT_IN_THIS_BILL" });
    expect(proposal.callId, "the call id is what the act later judges the proposal by").toBe("call-1");
  });

  test("a refusal is never caught here: abstention is the caller's decision, not the seam's", async () => {
    await expect(
      proposeCoverageCause(
        { tenantId: "t", projectId: "p", actor: "user:test", requestId: "req-2" },
        { state: STATE, declarable: SCOPE_DECLARATION_CAUSES, artifact: sourceKeyResolver("rev-1", [STATE.key]) },
        {
          propose: async () => {
            throw Object.assign(new Error("FIXTURE_MISSING"), { refusalCode: "FIXTURE_MISSING" });
          },
        },
      ),
    ).rejects.toThrow("FIXTURE_MISSING");
  });
});
