// @vitest-environment node
/**
 * The per-question calibration line (L-AI-01, L-AI-02), derived from ledger rows and outcome rows
 * and from nothing else: one line per question, the newest outcome per call standing, refusals
 * counted beside proposals, the awaiting count what nobody has judged yet, and the two mean
 * confidences read over the calls a person confirmed or affirmed against the calls a person
 * overruled or repudiated. A mean over nothing is null, never 0 — and `confidenceStated` says how
 * many judged calls stated a confidence at all, so a question asked as a Noul, which states none,
 * is counted and judged on the line rather than reading as a question nobody has judged.
 */
import { describe, expect, it } from "vitest";
import { UNNAMED_QUESTION } from "./db";
import { calibrationLinesOf, type CalibrationCall, type CalibrationOutcome } from "./model-calibration";

const call = (callId: string, question: string | null, outcome: "proposed" | "refused", confidence: number | null): CalibrationCall => ({
  callId,
  question,
  outcome,
  judgment: confidence === null ? null : { confidence },
});

describe("calibrationLinesOf", () => {
  it("answers one line per question in code-point order, counting proposals, refusals, each outcome and what still awaits a person", () => {
    const calls = [
      call("c1", "view-caption", "proposed", 0.9),
      call("c2", "view-caption", "proposed", 0.6),
      call("c3", "view-caption", "proposed", 0.8),
      call("c4", "view-caption", "refused", null),
      call("c5", "sheet-reading", "proposed", 0.7),
    ];
    const outcomes: CalibrationOutcome[] = [
      { callId: "c1", outcome: "CONFIRMED" },
      { callId: "c2", outcome: "OVERRULED" },
      { callId: "c5", outcome: "AFFIRMED" },
    ];
    expect(calibrationLinesOf(calls, outcomes)).toEqual([
      {
        question: "sheet-reading",
        proposed: 1,
        refused: 0,
        confirmed: 0,
        overruled: 0,
        repudiated: 0,
        affirmed: 1,
        awaiting: 0,
        confidenceStated: 1,
        meanConfidenceWhenRight: "0.700",
        meanConfidenceWhenWrong: null,
      },
      {
        question: "view-caption",
        proposed: 3,
        refused: 1,
        confirmed: 1,
        overruled: 1,
        repudiated: 0,
        affirmed: 0,
        awaiting: 1,
        confidenceStated: 2,
        meanConfidenceWhenRight: "0.900",
        meanConfidenceWhenWrong: "0.600",
      },
    ]);
  });

  it("reads the newest outcome per call — outcomes arrive newest first, and a later judgment supersedes an earlier one", () => {
    const calls = [call("c1", "view-caption", "proposed", 0.5)];
    const outcomes: CalibrationOutcome[] = [
      { callId: "c1", outcome: "REPUDIATED" },
      { callId: "c1", outcome: "CONFIRMED" },
    ];
    const [line] = calibrationLinesOf(calls, outcomes);
    expect(line).toMatchObject({ confirmed: 0, repudiated: 1, awaiting: 0, meanConfidenceWhenRight: null, meanConfidenceWhenWrong: "0.500" });
  });

  it("files a call recorded before questions were named under the one unnamed word, and reads no confidence where none was judged", () => {
    const calls = [call("c1", null, "proposed", null), call("c2", null, "proposed", 0.4)];
    const lines = calibrationLinesOf(calls, [{ callId: "c1", outcome: "CONFIRMED" }]);
    expect(lines).toEqual([
      {
        question: UNNAMED_QUESTION,
        proposed: 2,
        refused: 0,
        confirmed: 1,
        overruled: 0,
        repudiated: 0,
        affirmed: 0,
        awaiting: 1,
        confidenceStated: 0,
        meanConfidenceWhenRight: null,
        meanConfidenceWhenWrong: null,
      },
    ]);
  });

  it("answers no line at all over an empty ledger", () => {
    expect(calibrationLinesOf([], [])).toEqual([]);
  });

  it("tells a question whose answers state no confidence from a question nobody has judged", () => {
    // A Noul states a probability and no confidence, so its call carries a judgment whose
    // confidence is null — which is not the same fact as a call that recorded no judgment at all.
    const noul = (callId: string): CalibrationCall => ({ callId, question: "outline-corroboration", outcome: "proposed", judgment: { confidence: null } });
    const lines = calibrationLinesOf([noul("c1"), noul("c2"), call("c3", "view-caption", "proposed", 0.8)], [
      { callId: "c1", outcome: "AFFIRMED" },
      { callId: "c2", outcome: "OVERRULED" },
    ]);
    const [corroboration, caption] = lines;
    expect(corroboration, "judged twice, and nothing either mean can be taken over").toMatchObject({
      question: "outline-corroboration",
      proposed: 2,
      affirmed: 1,
      overruled: 1,
      awaiting: 0,
      confidenceStated: 0,
      meanConfidenceWhenRight: null,
      meanConfidenceWhenWrong: null,
    });
    expect(caption, "a question nobody has judged reads the same two nulls, and its own count tells them apart").toMatchObject({
      question: "view-caption",
      proposed: 1,
      awaiting: 1,
      confidenceStated: 0,
      meanConfidenceWhenRight: null,
      meanConfidenceWhenWrong: null,
    });
    expect([corroboration?.affirmed, corroboration?.overruled], "the one that was judged says so in its counts").not.toEqual([caption?.affirmed, caption?.overruled]);
  });
});
