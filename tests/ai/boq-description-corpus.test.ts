// @vitest-environment node
/**
 * The boq-line-description corpus, and the recorder that mints it (Q-08, L-AI-01, L-BD-01, I-298).
 *
 * The states are HAND-AUTHORED and COMMITTED beside the recorder: what a group's drawings state is
 * read off the committed BNBC fixture and written down once, because the recorder opens no database
 * and ingests no drawing. Two things must hold forever — the recorder asks exactly the question the
 * product asks (it composes through `boqDescriptionRequest` and nothing else, over the candidates
 * `candidateItemsFor` answers), and it refuses by name a pair the catalogue holds ONE description
 * for, because the product never asks that question and a corpus answering it would answer nobody.
 *
 * No network and no key: `subjectsOf` composes requests and posts nothing. Recording is a person's
 * own command (`scripts/model-corpus.ts record`), which no lane runs and none could.
 */
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MODEL_QUESTIONS, requestHash } from "../../src/core/model";
import { candidateItemsFor } from "../../src/core/catalogue/item-descriptions";
import { boqDescriptionRequest } from "../../src/modules/takeoff/boq/description-question";
import { subjectsOf } from "../../scripts/model-corpus/boq-line-description";
import type { RecorderContext } from "../../scripts/model-corpus/recorder";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const CORPUS_ROOT = join(REPO_ROOT, "fixtures", "model");
const STATES = join(REPO_ROOT, "scripts", "model-corpus", "boq-line-description-states");

/** A recorder context whose flags a case states, whose lines are collected and whose fail throws. */
function ctx(options: Readonly<Record<string, string>> = {}): RecorderContext & { said: string[] } {
  const said: string[] = [];
  return {
    said,
    option: (name) => options[name],
    fail: (message) => {
      throw new Error(message);
    },
    say: (line) => said.push(line),
    corpusRoot: CORPUS_ROOT,
  };
}

function stateFiles(): string[] {
  return readdirSync(STATES)
    .filter((name) => name.endsWith(".json"))
    .sort();
}

describe("the committed item-description states", () => {
  it("each name a pair the law divides, and say where their values came from", () => {
    const files = stateFiles();
    expect(files.length, "the corpus this question was designed over is hand-authored, and there is some of it").toBeGreaterThan(0);
    for (const name of files) {
      const state = JSON.parse(readFileSync(join(STATES, name), "utf8")) as {
        subject: string;
        note: string;
        artifact: string;
        line: { class: string; kind: string };
        attributes: { name: string; valueAsWritten: string; unitAsWritten: string }[];
        keys: string[];
      };
      expect(state.note, `${name} states where its values were read from — a corpus nobody can trace is not evidence (Q-08)`).toContain("fixtures/rcc6-bnbc");
      expect(state.artifact, `${name} names the committed file it was written from`).toContain("fixtures/rcc6-bnbc");
      expect(
        candidateItemsFor(state.line.class as never, state.line.kind as never).length,
        `${name} names ${state.line.class} × ${state.line.kind}, which the catalogue must hold more than one description for`,
      ).toBeGreaterThan(1);
      expect(state.attributes.length, `${name} states what the drawings say about the group`).toBeGreaterThan(0);
      for (const key of state.keys) expect(key, `${name}'s citations are source keys of the closed scheme set (L-CAD-02)`).toMatch(/^(DXF_HANDLE|PDF_OBJECT|RASTER_TRACE):\S+$/u);
    }
  });
});

describe("the recorder", () => {
  it("asks one subject per committed state, as the product's own builder composes it", () => {
    const asked = subjectsOf(ctx());
    expect(asked.length, "one subject per hand-authored state").toBe(stateFiles().length);
    for (const one of asked) {
      expect(one.request.question, "every subject is recorded under the question the ledger files it by").toBe(MODEL_QUESTIONS.boqLineDescription);
      expect(one.subject, "a reader can tell which group a recording was asked about, and how many options it had").toContain("candidates");
      expect(one.artifact, "the file the state was read out of travels beside the subject").toContain("fixtures/rcc6-bnbc");
    }
  });

  it("composes through `boqDescriptionRequest` and over `candidateItemsFor`, so a recording answers the product's own request", () => {
    const [first] = subjectsOf(ctx());
    const state = JSON.parse(readFileSync(join(STATES, stateFiles()[0] ?? ""), "utf8")) as {
      line: { class: string; kind: string };
      attributes: { name: string; valueAsWritten: string; unitAsWritten: string }[];
      keys: string[];
    };
    const rebuilt = boqDescriptionRequest({
      line: state.line as never,
      attributes: state.attributes,
      candidates: candidateItemsFor(state.line.class as never, state.line.kind as never),
      keys: state.keys,
    });
    expect(requestHash(first?.request ?? rebuilt), "the recorded request is the one the draft composes, hash for hash").toBe(requestHash(rebuilt));
  });

  it("refuses by name a state whose pair the catalogue holds one description for — the product never asks it", () => {
    const dir = mkdtempSync(join(tmpdir(), "cubit-boq-description-states-"));
    writeFileSync(
      join(dir, "column-concrete.json"),
      JSON.stringify({
        subject: "a group with nothing to select",
        note: "fixtures/rcc6-bnbc/model.json",
        artifact: "fixtures/rcc6-bnbc/model.json",
        line: { class: "column", kind: "rcc.concrete", unit: "m3", levels: ["GF"], bill: "SUPERSTRUCTURE", decidedBy: "OVERRIDE:column", quantityBasis: "DERIVED", selectionBasis: "DEFAULTED" },
        attributes: [{ name: "grade", valueAsWritten: "C3500PSI", unitAsWritten: "" }],
        keys: ["DXF_HANDLE:COL:A1@FDN"],
      }),
    );
    expect(() => subjectsOf(ctx({ "--states": dir })), "a selection with nothing to select is refused, not recorded").toThrow(/one description/u);
  });

  it("refuses a state that cites nothing, because nothing it answered could be sourced", () => {
    const dir = mkdtempSync(join(tmpdir(), "cubit-boq-description-states-"));
    writeFileSync(
      join(dir, "uncited.json"),
      JSON.stringify({
        subject: "a wall nobody can cite",
        note: "fixtures/rcc6-bnbc/model.json",
        artifact: "fixtures/rcc6-bnbc/model.json",
        line: { class: "brick_wall", kind: "masonry.brickwork", unit: "m3", levels: ["1F"], bill: "SUPERSTRUCTURE", decidedBy: "OVERRIDE:brick_wall", quantityBasis: "TRANSCRIBED", selectionBasis: "TRANSCRIBED" },
        attributes: [{ name: "thickness", valueAsWritten: "250", unitAsWritten: "mm" }],
        keys: [],
      }),
    );
    expect(() => subjectsOf(ctx({ "--states": dir })), "an uncited answer is UNSOURCED by construction (L-AI-02)").toThrow(/source key/u);
  });
});
