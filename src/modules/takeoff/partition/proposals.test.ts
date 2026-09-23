/**
 * The rebuild's decision on what a model answered about a silent caption (R-TO-030, L-AI-02,
 * I-408), proved without a store.
 *
 * L-AI-02 makes abstention the CALLER's decision, and the proposal pass is that caller: a class the
 * rebuild offers stands beside its view as a proposal; the question's own "none of these" is a
 * proposal of no class, which the rebuild excludes and says on the job with the ledger call that
 * answered it; an answer that is no reading of a caption at all is refused, and the refusal is said
 * on the job. The model is reached only through the shipped seam over recorded answers minted under
 * a scratch root, with the ledger in memory, so the ledger rows graded here are the ones the AI audit
 * would read.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { JEV_MODEL, createModelSeam, requestHash, type ModelLedger, type ModelLedgerRow } from "@/core/model";
import { proposeViewType, viewCaptionRequest } from "@/core/view-captions";
import { proposalsFor, type ViewCaptionSeam } from "./rebuild";
import type { ViewProposal } from "./store";
import type { PartitionedView } from "./views/assign";
import { VIEW_TYPE } from "./views/law";

/** A view the grammar could not read, anchored by its caption's own entity — the only kind a model is asked about. */
function silent(viewKey: string, caption: string, anchorKey: string): PartitionedView {
  return { viewKey, type: VIEW_TYPE.UNTYPED, reason: "CAPTION_UNCLASSIFIABLE", caption, anchorKey };
}

/** Three silent captions and the answer each was recorded with, and one view the grammar read. */
const ANSWERED = silent("untyped:DXF_HANDLE:A1", "SECTION THROUGH STAIR LANDING", "DXF_HANDLE:A1");
const NONE = silent("untyped:DXF_HANDLE:A2", "XQZ 77", "DXF_HANDLE:A2");
const UNREADABLE = silent("untyped:DXF_HANDLE:A3", "ZZ 9", "DXF_HANDLE:A3");
const READ: PartitionedView = { viewKey: "plan:DXF_HANDLE:A4", type: VIEW_TYPE.LAYOUT_PLAN, reason: null, caption: "GROUND FLOOR PLAN", anchorKey: "DXF_HANDLE:A4" };

/** What Jev was recorded answering for each silent caption: a class, "none of these", and the class that means "no caption at all". */
const RECORDED: ReadonlyArray<readonly [PartitionedView, string]> = [
  [ANSWERED, VIEW_TYPE.DETAIL],
  [NONE, VIEW_TYPE.UNTYPED],
  [UNREADABLE, VIEW_TYPE.UNASSIGNED],
];

type Step = { name: string; detail: Record<string, unknown> | undefined };

const scratch: string[] = [];
let proposals: Map<string, ViewProposal>;
let rows: ModelLedgerRow[];
let steps: Step[];

beforeAll(async () => {
  const root = mkdtempSync(join(tmpdir(), "cubit-caption-proposals-"));
  scratch.push(root);
  for (const [view, type] of RECORDED) {
    const hash = requestHash(viewCaptionRequest(view.caption, view.anchorKey ?? ""));
    writeFileSync(
      join(root, `${hash}.json`),
      JSON.stringify({ requestHash: hash, modelId: JEV_MODEL, payload: { payload: { type }, sources: [view.anchorKey] }, inputTokens: 480, outputTokens: 96 }),
    );
  }

  rows = [];
  const ledger: ModelLedger = {
    async record(row) {
      rows.push(row);
      return { callId: `call-${rows.length}` };
    },
  };
  const seam = createModelSeam({ env: { CUBIT_MODEL_FIXTURE_ROOT: root }, fetch: globalThis.fetch, ledger });
  const captions: ViewCaptionSeam = { proposeViewType: (ctx, question) => proposeViewType(ctx, question, { propose: seam.propose }) };

  steps = [];
  proposals = await proposalsFor([ANSWERED, NONE, UNREADABLE, READ], {
    ctx: { tenantId: "t-proposals", projectId: "p-proposals", actor: "user:test", requestId: "job-proposals" },
    artifactSha256: "digest-proposals",
    citable: [ANSWERED, NONE, UNREADABLE, READ].map((view) => view.anchorKey ?? ""),
    progress: {
      jobId: "job-proposals",
      tempDir: root,
      step: async (name, detail) => {
        steps.push({ name, detail });
      },
    },
    captions,
    held: [],
  });
});

afterAll(() => {
  for (const root of scratch) rmSync(root, { recursive: true, force: true });
});

describe("what the rebuild does with each answer about a silent caption", () => {
  test("only the views the grammar was silent on are asked, one call each", () => {
    expect(rows.map((row) => row.question), "three silent captions, three view-caption calls — the plan the grammar read asks nothing").toEqual(["view-caption", "view-caption", "view-caption"]);
  });

  test("a class the rebuild offers stands beside its view as a proposal naming its call", () => {
    expect(proposals.get(ANSWERED.viewKey)).toEqual({ viewKey: ANSWERED.viewKey, type: VIEW_TYPE.DETAIL, callId: "call-1" });
  });

  test("Jev's 'none of these' is a proposed call in the ledger — never refused MALFORMED — and the rebuild excludes it", () => {
    expect(
      { outcome: rows[1]?.outcome, refusalCode: rows[1]?.refusalCode },
      "the ledger — what the AI audit reads — books the answer the question offered as the proposal it is",
    ).toEqual({ outcome: "proposed", refusalCode: null });
    expect(proposals.has(NONE.viewKey), "nothing stands beside the view: a proposal of no class is nothing a person could confirm").toBe(false);
    expect(
      steps.filter((step) => step.name === "caption-proposal-no-class").map((step) => step.detail),
      "and the job says which view was asked and which ledger call answered none of these",
    ).toEqual([{ view_key: NONE.viewKey, call_id: "call-2" }]);
  });

  test("an answer that is no reading of a caption is still refused, and said on the job as a refusal", () => {
    expect({ outcome: rows[2]?.outcome, refusalCode: rows[2]?.refusalCode }).toEqual({ outcome: "refused", refusalCode: "MALFORMED" });
    expect(proposals.has(UNREADABLE.viewKey)).toBe(false);
    expect(steps.filter((step) => step.name === "caption-proposal-refused").map((step) => step.detail)).toEqual([{ refusal: "MALFORMED", view_key: UNREADABLE.viewKey }]);
  });

  test("the pass proposes exactly the one class it heard", () => {
    expect([...proposals.keys()]).toEqual([ANSWERED.viewKey]);
  });
});
