/**
 * AC-2(e) [debt-src-core-bmoj8b] — a Proposal's mark survives two loaded copies of its own module.
 *
 * L-AI-02 has a model answer a Proposal or a Refusal, and the mark that makes one a Proposal is a
 * symbol precisely so no JSON payload can carry one. `Symbol("cubit.proposal")` mints a NEW symbol
 * per module instance: the unit lane, the Next server bundle and the worker each load their own copy,
 * and a Proposal minted under one fails the kind check of another — a value that IS a proposal
 * answering that it is not. The global registry is the one home the mark can have (B-17):
 * `Symbol.for` answers one symbol for one description, whoever asks.
 *
 * Judged as the property the clause needs — the mark is registered, and a value marked by a SECOND
 * reader of the registry passes the first reader's check — rather than by importing the module twice,
 * which is exactly the thing the defect makes indistinguishable.
 */
import { describe, expect, test } from "vitest";
import { PROPOSAL_KIND } from "./proposal";

/** The registered description the mark stands under, spelled as L-AI-02's namespace writes it. */
const DESCRIPTION = "cubit.proposal";

describe("the Proposal mark is registered, not per-instance", () => {
  test("AC-2(e): the mark is the registry's symbol for its description", () => {
    expect(
      PROPOSAL_KIND,
      "a per-module symbol makes one Proposal fail another copy's kind check, and a value that is a proposal must never answer that it is not (L-AI-02, B-17)",
    ).toBe(Symbol.for(DESCRIPTION));
  });

  test("AC-2(e): a Proposal marked by another reader of the registry passes this copy's kind check", () => {
    // What a second loaded copy of the module would do, without loading one: mint the mark the way
    // the module mints it and check the value against the mark this copy holds.
    const asAnotherCopyWouldMark = { kind: Symbol.for(DESCRIPTION), payload: null, sources: ["DXF_HANDLE:1"], model: "probe", callId: "c1" };
    expect(asAnotherCopyWouldMark.kind === PROPOSAL_KIND, "one mark, whoever minted it — that is what crossing a module boundary needs (L-AI-02)").toBe(true);
  });

  test("AC-2(e): the mark is still a symbol, so no JSON payload can carry one", () => {
    expect(typeof PROPOSAL_KIND, "a string brand would serialise into a jsonb column unnoticed; a symbol is nothing JSON can spell (L-AI-02)").toBe("symbol");
    expect(JSON.stringify({ kind: PROPOSAL_KIND }), "a symbol-valued key is dropped by JSON, which is the whole point of the mark").toBe("{}");
  });
});
