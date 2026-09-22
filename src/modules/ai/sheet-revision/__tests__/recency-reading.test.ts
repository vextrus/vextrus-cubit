// @vitest-environment node
/**
 * How a model's answer about a sheet's issue state is read back, and what the door does with it
 * (L-AI-02, L-AI-03).
 *
 * What is graded: that a reading is the closed shape it says it is — a level OF the spectrum, a
 * position on it, and the words the reading rests on — and that anything else is a REFUSAL the
 * decoder states rather than a value it supplies or clamps; that the door resolves citations against
 * the candidates this sheet actually offered, so an answer citing another sheet's block is
 * SOURCE_UNRESOLVED; and that a sheet printing nothing about its issue is never asked at all,
 * because its only answer would cite nothing and a call spent on a certain refusal is a call nobody
 * should make (L-AI-01 attributes what it spends).
 */
import { describe, expect, it } from "vitest";
import { PROPOSAL_KIND, parseSourceKey, type ModelCallContext, type ModelRequest, type Proposal, type ProposalContract, type SourceKey } from "@/core/model";
import { entityGraphSchema, type EntityGraph } from "@/core/entitygraph/schema";
import { RECENCY_LEVELS, TOP_LEVEL, proposeSheetRevisionRecency, readRevisionRecency, type RevisionRecency } from "../index";

const CHANNELS = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" as const };
const BLOCK = "DXF_HANDLE:100";
const ROW = "DXF_HANDLE:101";
const ELSEWHERE = "DXF_HANDLE:900";

const CTX: ModelCallContext = { tenantId: "t", projectId: "p", actor: "user:qs", requestId: "r" };

/** One sheet stating a revision mark and printing one dated row, valid under the one mirror (L-CAD-05). */
function sheet(options: { marks?: boolean; rows?: boolean } = {}): EntityGraph {
  const entities: Record<string, unknown>[] = [{ key: BLOCK, type: "INSERT", space: "S-01", layer: "Title", colour: CHANNELS, points: [[0, 0]] }];
  if (options.rows !== false) {
    entities.push({ key: ROW, type: "TEXT", space: "S-01", layer: "Title", colour: CHANNELS, text: "B 12-08-2026 ISSUED FOR CONSTRUCTION", height: 1.6, points: [[1.5, 95]] });
  }
  return entityGraphSchema.parse({
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-unit", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [{ name: "S-01", kind: "paper", bbox: { min: [0, 0], max: [841, 594] }, strays_rejected: 0 }],
    dropped_layouts: [],
    entities,
    derived: [],
    block_attributes: options.marks === false ? [] : [{ src: BLOCK, tag: "REV", text: "B", height: 2 }],
    counters: [],
  });
}

/** A reading as the wire spells one. */
function reading(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { evidence: "B 12-08-2026 ISSUED FOR CONSTRUCTION", level: 4, score: 3.8, ...over };
}

/** A `propose` that answers the payload given, keeping what it was handed for the test to read. */
function portAnswering(payload: Record<string, unknown>) {
  const seen: { request: ModelRequest | null; contract: ProposalContract<RevisionRecency> | null } = { request: null, contract: null };
  const propose = async (_ctx: ModelCallContext, request: ModelRequest, contract: ProposalContract<RevisionRecency>): Promise<Proposal<RevisionRecency>> => {
    seen.request = request;
    seen.contract = contract;
    const decoded = contract.decode(payload as never);
    if (!decoded.ok) throw new Error(decoded.detail);
    return { kind: PROPOSAL_KIND, payload: decoded.value, sources: [ROW as SourceKey], model: "claude-sonnet-5", callId: "call" };
  };
  return { seen, port: { propose: propose as never } };
}

describe("a model's answer read as a recency reading", () => {
  it("is the closed shape it says it is: a level of the spectrum, a position on it, and the words it rests on", () => {
    const read = readRevisionRecency(reading() as never);
    expect(read.ok && read.value).toEqual({ evidence: "B 12-08-2026 ISSUED FOR CONSTRUCTION", level: 4, score: 3.8 });
    expect(RECENCY_LEVELS[TOP_LEVEL], "the level a caller shows a person is the spectrum's own sentence").toContain("revision mark matches");
  });

  it("refuses a level outside the spectrum rather than clamping it to one the model did not give", () => {
    const read = readRevisionRecency(reading({ level: TOP_LEVEL + 1 }) as never);
    expect(read.ok).toBe(false);
    expect(!read.ok && read.detail).toContain(`0 to ${TOP_LEVEL}`);
  });

  it("refuses a level between levels: a level is one of them, and the position between them is the score", () => {
    expect(readRevisionRecency(reading({ level: 2.5 }) as never).ok).toBe(false);
  });

  it("refuses a score that is no position on the spectrum", () => {
    expect(readRevisionRecency(reading({ score: null }) as never).ok).toBe(false);
    expect(readRevisionRecency(reading({ score: TOP_LEVEL + 0.5 }) as never).ok).toBe(false);
  });

  it("refuses a reading with a hole in it, and one answering a question nobody asked", () => {
    expect(readRevisionRecency({ level: 4, score: 4 } as never).ok, "a reading missing its evidence").toBe(false);
    expect(readRevisionRecency(reading({ mark: "B" }) as never).ok, "a reading naming a fifth field").toBe(false);
  });

  it("refuses a reading resting on nothing a reader could check", () => {
    expect(readRevisionRecency(reading({ evidence: "   " }) as never).ok).toBe(false);
  });
});

describe("the door a recency reading is proposed through", () => {
  it("puts the sheet's own question and resolves a citation against the candidates that sheet offered", async () => {
    const { seen, port } = portAnswering(reading());
    const proposal = await proposeSheetRevisionRecency(CTX, { graph: sheet(), layoutName: "S-01", artifactDigest: "sha256:abc" }, port);
    expect(proposal.payload.level).toBe(4);
    expect(seen.request?.question).toBe("sheet-revision-recency");
    const artifact = seen.contract?.artifact;
    expect(artifact?.has(parseSourceKey(ROW) as SourceKey), "the row the sheet prints is citable").toBe(true);
    expect(artifact?.has(parseSourceKey(BLOCK) as SourceKey), "the block its mark belongs to is citable").toBe(true);
    expect(artifact?.has(parseSourceKey(ELSEWHERE) as SourceKey), "an entity of another sheet is not").toBe(false);
    expect(artifact?.artifactDigest).toBe("sha256:abc");
  });

  it("decodes through this module's own reading, so a malformed answer is a refusal and never a stored value", async () => {
    const { seen, port } = portAnswering(reading());
    await proposeSheetRevisionRecency(CTX, { graph: sheet(), layoutName: "S-01", artifactDigest: "sha256:abc" }, port);
    expect(seen.contract?.decode({ level: 9, score: 9, evidence: "x" } as never).ok).toBe(false);
  });

  it("never asks about a sheet that prints nothing: its only answer would cite nothing", async () => {
    const { port } = portAnswering(reading());
    const bare = sheet({ marks: false, rows: false });
    await expect(proposeSheetRevisionRecency(CTX, { graph: bare, layoutName: "S-01", artifactDigest: "sha256:abc" }, port)).rejects.toThrow(/no model is asked/);
  });
});
