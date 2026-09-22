// @vitest-environment node
/**
 * What the arms POST, pinned byte for byte (L-AI-01, AM-11).
 *
 * A recorded answer is filed under the hash of the REQUEST, and the request's hash says nothing
 * about the body an arm composes out of it: the vocabulary a criterion is drawn from, the wording of
 * an instruction and the order of the keys could all move while every hash in `fixtures/model/`
 * stayed as it is — and the corpus would then be answering a question nobody asks any more. So the
 * two bodies the corpus was recorded over are written down here as they were posted on 2026-09-21,
 * derived from nothing: a golden, like the recordings themselves. An arm added beside these must
 * leave them exactly as they stand.
 *
 * The subjects are the corpus's own two (`fixtures/model/corpus.json`):
 *   50f7c93811fa4d2da6f49d189d4736e9f8e2dcac7e20bacc016e78e607bc2932  sheet-reading  silent-title-block.graph.json · SHEET-01
 *   20850cd27ecd8db4febb39668b6307d7f3f860c25b9323f20929374e2a5b3e1e  view-caption   rcc6-bnbc.dxf · DXF_HANDLE:10C1 · ROOF BEAM LAYOUT (AT ROOF LEVEL)
 *
 * The caption's whole request is composed here, because its builder is core's own, and its hash is
 * asserted against the roster's. The sheet's is composed by `@/modules/ai/sheet-understanding`,
 * which core may not import (ARCH-01), so what is pinned for it is the user message that request
 * carries — the canonical evidence the hash above is taken over — read off the committed artifact
 * before this file's refactor. That the module still composes exactly this is what
 * `tests/ai/typesafe-jev.acceptance.test.ts` drives, over the same committed artifact.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { viewCaptionRequest } from "../../view-captions";
import { canonicalJson, requestHash } from "../canonical";
import { structuredTaskOf } from "../typesafe";
import type { ModelRequest } from "../types";
import { sheetReadingArm } from "./sheet-reading";
import { viewCaptionArm } from "./view-caption";

/** The hashes `fixtures/model/corpus.json` files the two recordings under, quoted. */
const SHEET_REQUEST_HASH = "50f7c93811fa4d2da6f49d189d4736e9f8e2dcac7e20bacc016e78e607bc2932";
const CAPTION_REQUEST_HASH = "20850cd27ecd8db4febb39668b6307d7f3f860c25b9323f20929374e2a5b3e1e";

/** The user message of request 50f7c938…: the silent sheet's evidence, canonically spelled. */
const SILENT_SHEET_CONTENT = `{"blockAttributes":[{"height":6,"src":"DXF_HANDLE:2A0","tag":"SHEET_NO","text":"C-402"},{"height":10,"src":"DXF_HANDLE:2A0","tag":"SHEET_TITLE","text":"SITE GRADING PLAN"},{"height":3.5,"src":"DXF_HANDLE:2A0","tag":"SCALE","text":"1:100"},{"height":3.5,"src":"DXF_HANDLE:2A0","tag":"REV","text":"B"},{"height":3.5,"src":"DXF_HANDLE:2A0","tag":"ISSUE_DATE","text":"2026-04-12"}],"census":{"INSERT":3,"LINE":1,"LWPOLYLINE":1,"TEXT":1},"derived":[{"height":5,"key":"DXF_HANDLE:2A2","layer":"ANNO-VIEW","text":"SECTION A-A","type":"MTEXT"},{"height":5,"key":"DXF_HANDLE:2A5","layer":"ANNO-VIEW","text":"DETAIL 3 - KERB RETURN","type":"MTEXT"}],"entities":[],"layout":{"kind":"paper","name":"SHEET-01"}}`;

/** The caption of view DXF_HANDLE:10C1 on the M3/M4 yardstick drawing, as the corpus names it. */
const CAPTION = "ROOF BEAM LAYOUT (AT ROOF LEVEL)";
const CAPTION_KEY = "DXF_HANDLE:10C1";

/**
 * The sheet request as the wire sees it. Only the user message reaches an arm — it is the canonical
 * content the arm recognises and composes from — so the pinned message is carried on a request whose
 * other fields are the module's, unread here and never restated.
 */
function sheetRequest(): ModelRequest {
  return { modelId: "claude-opus-5", system: "(the module's own system prompt — not read by any arm)", messages: [{ role: "user", content: SILENT_SHEET_CONTENT }] };
}

describe("the bodies the arms post, as the corpus was recorded over them", () => {
  test("the pinned sheet evidence is canonical, and the sheet arm is the one that recognises it", () => {
    expect(canonicalJson(JSON.parse(SILENT_SHEET_CONTENT)), "the pinned message is the canonical spelling of its own evidence").toBe(SILENT_SHEET_CONTENT);
    const task = structuredTaskOf(sheetRequest());
    expect(task?.kind, "the registry routes this key set to the sheet-reading arm").toBe("sheet");
  });

  test("the silent sheet is posted as three choices over its seven texts, exactly as recorded", () => {
    const task = sheetReadingArm.recognise(JSON.parse(SILENT_SHEET_CONTENT) as Record<string, unknown>);
    const candidates = {
      cand_1: "C-402",
      cand_2: "SITE GRADING PLAN",
      cand_3: "1:100",
      cand_4: "B",
      cand_5: "2026-04-12",
      cand_6: "SECTION A-A",
      cand_7: "DETAIL 3 - KERB RETURN",
    };
    expect(sheetReadingArm.compose(task!).body).toEqual({
      model: "jev-latest",
      state: { layout: "SHEET-01", candidates },
      questions: {
        discipline: {
          type: "choice",
          instructions:
            "`candidates` holds the texts found on one construction drawing sheet, keyed by candidate id, and `layout` is the sheet's layout name. Which engineering discipline is this drawing sheet?",
          criteria: {
            STRUCTURAL: "Structural plans, framing, reinforcement, foundations, columns, beams, slabs",
            ARCHITECTURAL: "Architectural plans, elevations, finishes, partitions, openings",
            MEP: "Mechanical, electrical, plumbing, fire or HVAC services",
            CIVIL: "Civil, site, drainage or infrastructure works",
            OTHER: "General, cover, index or a discipline not listed",
          },
        },
        title_candidate: {
          type: "choice",
          instructions:
            "`candidates` holds the texts found on one construction drawing sheet, keyed by candidate id. Which candidate is the sheet's title — the name of what the sheet shows, as its title block states it?",
          criteria: candidates,
        },
        number_candidate: {
          type: "choice",
          instructions:
            "`candidates` holds the texts found on one construction drawing sheet, keyed by candidate id. Which candidate is the sheet's number or identifier — the short code its title block files it under, such as S-02 or C-402? Choose NONE if no candidate states one.",
          criteria: { ...candidates, NONE: "The sheet states no number" },
        },
      },
    });
  });

  test("the roof-beam caption hashes to the corpus's own request, and is posted as one choice, exactly as recorded", () => {
    const request = viewCaptionRequest(CAPTION, CAPTION_KEY);
    expect(requestHash(request), "the recording in fixtures/model answers this request and no other").toBe(CAPTION_REQUEST_HASH);
    const task = structuredTaskOf(request);
    expect(task?.kind, "the registry routes this key set to the view-caption arm").toBe("caption");
    expect(viewCaptionArm.compose(task as { kind: "caption"; caption: string; key: string }).body).toEqual({
      model: "jev-latest",
      state: { caption: CAPTION },
      questions: {
        view_type: {
          type: "choice",
          instructions:
            "`caption` is the text captioning one view on a structural construction drawing, which the deterministic caption grammar could not classify. Which class of view does this caption name? Choose UNTYPED if the caption names no class of view a reader could tell.",
          criteria: {
            LAYOUT_PLAN: "layout plan",
            SCHEDULE: "schedule",
            LONG_SECTION_STRIP: "long section strip",
            MEMBER_SECTION: "member section",
            DETAIL: "detail",
            STAIR_PLAN: "stair plan",
            STAIR_SECTION: "stair section",
            LEGEND_NOTES: "legend notes",
            TITLE: "title",
            UNTYPED: "untyped",
            UNASSIGNED: "unassigned",
          },
        },
      },
    });
  });

  test("both hashes are the ones the corpus roster files its recordings under, subject for subject", () => {
    // The sheet's request is the module's to compose (ARCH-01), so the tie for it is made here: the
    // hash this file pins is the hash the roster carries, under the subject the recorder prints.
    const roster = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../..", "fixtures", "model", "corpus.json"), "utf8")) as {
      fixtures: { requestHash: string; question: string; subject: string }[];
    };
    const filed = (hash: string): { question: string; subject: string } | undefined => roster.fixtures.find((line) => line.requestHash === hash);
    expect(filed(SHEET_REQUEST_HASH), "the silent sheet's recording is rostered under the hash pinned here").toMatchObject({
      question: "sheet-reading",
      subject: "silent-title-block.graph.json · SHEET-01",
    });
    expect(filed(CAPTION_REQUEST_HASH), "the roof-beam caption's recording is rostered under the hash this file hashes the request to").toMatchObject({
      question: "view-caption",
      subject: `rcc6-bnbc.dxf · ${CAPTION_KEY} · ${CAPTION}`,
    });
  });
});
