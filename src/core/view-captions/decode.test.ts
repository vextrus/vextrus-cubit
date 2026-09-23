/**
 * How the silent-caption question reads an answer back (R-TO-030, L-AI-02, I-408).
 *
 * The decoder is pure, so it is judged here without a database or a model: a class of the caller's
 * set is read back out of that set; the member the caller names as the question's "none of these"
 * is a proposal of NO class; and anything else — a class the caller does not offer, the member
 * that stands for a view with no caption at all, a non-string, a payload of the wrong shape — is
 * no reading of a caption and is refused with a detail. The last case drives `proposeViewType`
 * through the shipped seam over a recorded answer and an in-memory ledger, because the point of
 * the change is what the ledger — the AI audit's source — says about such a call.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { VIEW_TYPE_SPELLINGS } from "../errors/transport-vocabulary";
import { JEV_MODEL, createModelSeam, requestHash, sourceKeyResolver, type ModelLedger, type ModelLedgerRow } from "../model";
import { proposeViewType, readViewTypeProposal, viewCaptionRequest } from ".";

/** View classes addressed through the vocabulary's one home, never spelled here (L-CAD-06). */
const [LAYOUT_PLAN, , , MEMBER_SECTION, DETAIL, , , , TITLE, UNTYPED, UNASSIGNED] = VIEW_TYPE_SPELLINGS;

/** A caller's contract of the shape the rebuild states: three classes, and the untyped member as "none of these". */
const decode = readViewTypeProposal([LAYOUT_PLAN, MEMBER_SECTION, DETAIL] as const, UNTYPED);

describe("a caption answer, as the question reads it", () => {
  test("a class the caller offers is read back out of the caller's set", () => {
    expect(decode({ type: DETAIL })).toEqual({ ok: true, value: { type: DETAIL } });
  });

  test("the question's own 'none of these' is a proposal of no class, not a refusal", () => {
    const read = decode({ type: UNTYPED });
    expect(read, "the no-match member decodes, and decodes to no class at all").toEqual({ ok: true, value: { type: null } });
    expect(read.ok && Object.isFrozen(read.value), "and what the caller holds cannot be edited into a class afterwards").toBe(true);
  });

  test("a class the caller does not offer is refused, naming the set and the no-match", () => {
    const read = decode({ type: TITLE });
    expect(read.ok).toBe(false);
    expect(!read.ok && read.detail).toContain(`the classifiable set is ${LAYOUT_PLAN}, ${MEMBER_SECTION}, ${DETAIL}`);
    expect(!read.ok && read.detail).toContain(`${UNTYPED} answers none of these`);
  });

  test("the member that stands for a view with NO caption is no answer about a caption, and is refused", () => {
    expect(decode({ type: UNASSIGNED }).ok, "only the member the caller names as the no-match reads as no class").toBe(false);
  });

  test("an answer that is no spelling at all is refused — a missing choice is not a 'none of these'", () => {
    expect(decode({ type: null }).ok).toBe(false);
    expect(decode({ type: 7 }).ok).toBe(false);
    expect(decode({ type: [UNTYPED] }).ok).toBe(false);
  });

  test("a payload of any other shape is refused before its class is looked at", () => {
    expect(decode(null).ok).toBe(false);
    expect(decode([UNTYPED]).ok).toBe(false);
    expect(decode({}).ok).toBe(false);
    expect(decode({ type: UNTYPED, reason: "none" }).ok).toBe(false);
  });

  test("the no-match is the caller's to name: a caller naming none has none (the set alone decides)", () => {
    const strict = readViewTypeProposal([LAYOUT_PLAN] as const, TITLE);
    expect(strict({ type: UNTYPED }).ok, "the untyped member means nothing special unless the caller says so").toBe(false);
    expect(strict({ type: TITLE }), "and the member the caller DID name reads as no class").toEqual({ ok: true, value: { type: null } });
  });
});

describe("a 'none of these' through the shipped seam", () => {
  const roots: string[] = [];
  afterAll(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  });

  test("is a proposed call in the ledger, cited to the caption — never a MALFORMED refusal", async () => {
    const root = mkdtempSync(join(tmpdir(), "cubit-caption-none-"));
    roots.push(root);
    const anchorKey = "DXF_HANDLE:2266";
    const request = viewCaptionRequest("XQZ 77", anchorKey);
    const hash = requestHash(request);
    writeFileSync(
      join(root, `${hash}.json`),
      JSON.stringify({ requestHash: hash, modelId: JEV_MODEL, payload: { payload: { type: UNTYPED }, sources: [anchorKey] }, inputTokens: 512, outputTokens: 118 }),
    );

    const rows: ModelLedgerRow[] = [];
    const ledger: ModelLedger = {
      async record(row) {
        rows.push(row);
        return { callId: `call-${rows.length}` };
      },
    };
    const seam = createModelSeam({ env: { CUBIT_MODEL_FIXTURE_ROOT: root }, fetch: globalThis.fetch, ledger });
    const ctx = { tenantId: "t-1", projectId: "p-1", actor: "user:test", requestId: "req-caption-none" };

    const proposal = await proposeViewType(
      ctx,
      { caption: "XQZ 77", anchorKey, classifiable: [LAYOUT_PLAN, MEMBER_SECTION, DETAIL] as const, noClass: UNTYPED, artifact: sourceKeyResolver("digest", [anchorKey]) },
      { propose: seam.propose },
    );
    expect(proposal.payload, "the caller hears a proposal of no class").toEqual({ type: null });
    expect(proposal.sources, "resting on the caption it was asked about").toEqual([anchorKey]);
    expect(
      rows.map((row) => ({ outcome: row.outcome, refusalCode: row.refusalCode, question: row.question, inputTokens: row.inputTokens })),
      "and the ledger — what the AI audit reads — holds one proposed call, refused by nothing",
    ).toEqual([{ outcome: "proposed", refusalCode: null, question: "view-caption", inputTokens: 512 }]);
    expect(proposal.callId, "the proposal names that very call").toBe("call-1");
  });
});
