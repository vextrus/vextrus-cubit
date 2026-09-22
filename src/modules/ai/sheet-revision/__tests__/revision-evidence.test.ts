// @vitest-environment node
/**
 * What CODE finds on a sheet before any model is asked (R-TO-004, L-AI-03): the revision marks the
 * title block states, the rows the revision table prints, and the same two things for every other
 * sheet of the set. The model selects among them; it never finds them, and it never spells a key.
 *
 * What is graded here: that the marks are read off the block's own tags and not off a layer name;
 * that a printed row is the LINE the paper prints — texts sharing a baseline, split where the white
 * between them is a gutter — and that a line carrying no date is no revision row; that the set's
 * evidence is words and never keys, because a sheet's evidence is citable on its own reading and
 * nowhere else; and that the request is a pure function of the artifact, which is what lets a
 * recorded answer replay in every lane (L-AI-01).
 */
import { describe, expect, it } from "vitest";
import { entityGraphSchema, type EntityGraph } from "@/core/entitygraph/schema";
import { MODEL_QUESTIONS } from "@/core/model";
import {
  REVISION_RECENCY_MODEL,
  carriesRevisionEvidence,
  revisionCitableKeysOn,
  revisionEvidenceOn,
  setEvidenceOn,
  sheetRevisionRequest,
} from "../index";

/** The key set the adapter's revision arm recognises a request by, sorted (`REVISION_KEYS`). */
const REVISION_KEYS = ["layout", "levels", "revisionMarks", "revisionRows", "setRows"];

const CHANNELS = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" as const };

/** The handle half of a source key, from an ordinal — uppercase hex, as L-CAD-02 mints them. */
function handle(ordinal: number): string {
  return `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;
}

type TextSpec = { text: string; x: number; y: number; height: number; placed?: boolean };
type SheetSpec = { layout: string; block: readonly (readonly [string, string])[]; texts: readonly TextSpec[] };

/**
 * A hand-built EntityGraph v2, valid under the one mirror both runtimes read (L-CAD-05): model space
 * plus the paper sheets given, each carrying one title block with its attributes and the texts its
 * strip prints. Every key is minted once.
 */
function builtGraph(sheets: readonly SheetSpec[]): EntityGraph {
  const entities: Record<string, unknown>[] = [{ key: handle(0x10), type: "LINE", space: "Model", layer: "0", colour: CHANNELS, points: [[0, 0], [2, 2]] }];
  const attributes: Record<string, unknown>[] = [];
  sheets.forEach((sheet, index) => {
    const block = handle(0x100 * (index + 1));
    entities.push({ key: block, type: "INSERT", space: sheet.layout, layer: "Title", colour: CHANNELS, points: [[0, 0]] });
    for (const [tag, text] of sheet.block) attributes.push({ src: block, tag, text, height: 2 });
    sheet.texts.forEach((spec, at) => {
      entities.push({
        key: handle(0x100 * (index + 1) + at + 1),
        type: "TEXT",
        space: sheet.layout,
        layer: "Title",
        colour: CHANNELS,
        text: spec.text,
        height: spec.height,
        ...(spec.placed === false ? {} : { points: [[spec.x, spec.y]] }),
      });
    });
  });
  return entityGraphSchema.parse({
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-unit", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      { name: "Model", kind: "model", bbox: { min: [0, 0], max: [2, 2] }, strays_rejected: 0 },
      ...sheets.map((sheet) => ({ name: sheet.layout, kind: "paper", bbox: { min: [0, 0], max: [841, 594] }, strays_rejected: 0 })),
    ],
    dropped_layouts: [],
    entities,
    derived: [],
    block_attributes: attributes,
    counters: [],
  });
}

/** One structural set as an office draws it: two sheets, each a title block and a revision table. */
function setOfTwo(): EntityGraph {
  return builtGraph([
    {
      layout: "S-01",
      block: [
        ["SHEETNO", "S-01"],
        ["SCALE", "1:100"],
        ["REV", "B"],
        ["DATE", "12-08-2026"],
      ],
      texts: [
        // the table's column labels: a line, and no date in it
        { text: "REV", x: 1, y: 105, height: 1.4 },
        { text: "DATE", x: 7, y: 105, height: 1.4 },
        { text: "DESCRIPTION", x: 23, y: 105, height: 1.4 },
        // the first printed row, three texts on one baseline
        { text: "A", x: 1.5, y: 100, height: 1.6 },
        { text: "05-07-2026", x: 7, y: 100, height: 1.6 },
        { text: "ISSUED FOR RAJUK APPROVAL", x: 23, y: 100, height: 1.4 },
        // a dated note standing at the far side of the same sheet, on the same baseline
        { text: "PLOTTED 01-01-2026", x: 600, y: 100, height: 1.8 },
        // the second printed row
        { text: "B", x: 1.5, y: 95, height: 1.6 },
        { text: "12-08-2026", x: 7, y: 95, height: 1.6 },
        { text: "C4 3RD-4TH BARS REVISED; ISSUED FOR CONSTRUCTION", x: 23, y: 95, height: 1.4 },
        // the sheet's own title: no date, so no row
        { text: "S-01  FOUNDATION PLAN", x: 15, y: 20, height: 3.2 },
      ],
    },
    {
      layout: "S-02",
      block: [
        ["SHEETNO", "S-02"],
        ["REV", "A"],
        ["ISSUE_DATE", "05-07-2026"],
      ],
      texts: [
        { text: "A", x: 1.5, y: 100, height: 1.6 },
        { text: "05-07-2026", x: 7, y: 100, height: 1.6 },
        { text: "ISSUED FOR RAJUK APPROVAL", x: 23, y: 100, height: 1.4 },
      ],
    },
  ]);
}

describe("the revision evidence one sheet prints", () => {
  it("reads the title block's revision marks off its own tags, and leaves the rest of the block alone", () => {
    const evidence = revisionEvidenceOn(setOfTwo(), "S-01");
    expect(evidence.marks.map((mark) => `${mark.tag} ${mark.text}`)).toEqual(["REV B", "DATE 12-08-2026"]);
    expect(new Set(evidence.marks.map((mark) => mark.src)).size, "both marks are cited by the block they belong to").toBe(1);
  });

  it("reads a tag the block author spelled another way — REV NO, ISSUE_DATE — as the same field", () => {
    const evidence = revisionEvidenceOn(setOfTwo(), "S-02");
    expect(evidence.marks.map((mark) => mark.tag)).toEqual(["REV", "ISSUE_DATE"]);
  });

  it("prints a row as the line the paper prints it — the texts sharing a baseline, in reading order, carrying their own keys", () => {
    const evidence = revisionEvidenceOn(setOfTwo(), "S-01");
    expect(evidence.rows.map((row) => row.text)).toEqual([
      "A 05-07-2026 ISSUED FOR RAJUK APPROVAL",
      "PLOTTED 01-01-2026",
      "B 12-08-2026 C4 3RD-4TH BARS REVISED; ISSUED FOR CONSTRUCTION",
    ]);
    expect(evidence.rows[0]?.keys.length, "a row of three texts is cited by all three").toBe(3);
  });

  it("is no row where the line states no date — the column labels are not a revision", () => {
    const rows = revisionEvidenceOn(setOfTwo(), "S-01").rows;
    expect(rows.some((row) => row.text.includes("DESCRIPTION"))).toBe(false);
    expect(rows.some((row) => row.text.includes("FOUNDATION PLAN"))).toBe(false);
  });

  it("gives a text the artifact places nowhere a line of its own rather than grouping it by guess", () => {
    const graph = builtGraph([
      {
        layout: "S-01",
        block: [["REV", "A"]],
        texts: [
          { text: "A 05-07-2026 ISSUED FOR APPROVAL", x: 0, y: 0, height: 1.6, placed: false },
          { text: "B 12-08-2026 ISSUED FOR CONSTRUCTION", x: 0, y: 0, height: 1.6, placed: false },
        ],
      },
    ]);
    expect(revisionEvidenceOn(graph, "S-01").rows.map((row) => row.keys.length)).toEqual([1, 1]);
  });

  it("names every key an answer may cite, and nothing else the sheet carries", () => {
    const graph = setOfTwo();
    const citable = revisionCitableKeysOn(graph, "S-01");
    const evidence = revisionEvidenceOn(graph, "S-01");
    expect(citable).toEqual([...new Set([...evidence.marks.map((mark) => mark.src), ...evidence.rows.flatMap((row) => row.keys)])]);
    expect(citable.includes(handle(0x200)), "another sheet's block is not citable on this sheet's reading").toBe(false);
  });

  it("answers for a layout the inventory names, and refuses one it does not", () => {
    expect(carriesRevisionEvidence(setOfTwo(), "S-01")).toBe(true);
    expect(() => revisionEvidenceOn(setOfTwo(), "S-99")).toThrow(/layout inventory names no/);
  });

  it("carries nothing where the sheet prints neither a mark nor a row", () => {
    const graph = builtGraph([{ layout: "S-07", block: [["SHEETNO", "S-07"]], texts: [{ text: "GENERAL NOTES", x: 10, y: 10, height: 3 }] }]);
    expect(carriesRevisionEvidence(graph, "S-07")).toBe(false);
  });
});

describe("the set the sheet is read against", () => {
  it("holds every OTHER sheet's words and never this sheet's own", () => {
    const set = setEvidenceOn(setOfTwo(), "S-01");
    expect(set.map((sheet) => sheet.layout)).toEqual(["S-02"]);
    expect(set[0]?.marks).toEqual(["REV A", "ISSUE_DATE 05-07-2026"]);
    expect(set[0]?.rows).toEqual(["A 05-07-2026 ISSUED FOR RAJUK APPROVAL"]);
  });

  it("carries no key at all: a sheet's evidence is citable on its own reading and nowhere else", () => {
    expect(JSON.stringify(setEvidenceOn(setOfTwo(), "S-01"))).not.toContain("DXF_HANDLE");
  });

  it("leaves out a sheet of the set that prints nothing about its issue", () => {
    const graph = builtGraph([
      { layout: "S-01", block: [["REV", "B"]], texts: [] },
      { layout: "S-02", block: [["SHEETNO", "S-02"]], texts: [{ text: "GENERAL NOTES", x: 10, y: 10, height: 3 }] },
    ]);
    expect(setEvidenceOn(graph, "S-01")).toEqual([]);
  });
});

describe("the question one sheet's issue state is asked", () => {
  it("names the closed question, pins the id AS-05 spells, and spells the key set the adapter recognises", () => {
    const request = sheetRevisionRequest(setOfTwo(), "S-01");
    expect(request.question).toBe(MODEL_QUESTIONS.sheetRevisionRecency);
    expect(request.modelId).toBe(REVISION_RECENCY_MODEL);
    const content = JSON.parse(request.messages[0]?.content ?? "{}") as Record<string, unknown>;
    expect(Object.keys(content).sort()).toEqual(REVISION_KEYS);
  });

  it("carries the spectrum's own sentences, so the adapter holds no second spelling of them", () => {
    const content = JSON.parse(sheetRevisionRequest(setOfTwo(), "S-01").messages[0]?.content ?? "{}") as { levels: string[] };
    expect(content.levels.length).toBe(5);
    expect(content.levels.every((level) => level.trim().length > 0)).toBe(true);
  });

  it("is a pure function of the artifact — the same graph asks byte-identically, so a recorded answer replays", () => {
    expect(sheetRevisionRequest(setOfTwo(), "S-01").messages[0]?.content).toBe(sheetRevisionRequest(setOfTwo(), "S-01").messages[0]?.content);
  });

  it("asks about one sheet: its own rows carry keys, and the set's carry none", () => {
    const content = JSON.parse(sheetRevisionRequest(setOfTwo(), "S-01").messages[0]?.content ?? "{}") as {
      layout: string;
      revisionRows: { keys: string[] }[];
      setRows: { layout: string }[];
    };
    expect(content.layout).toBe("S-01");
    expect(content.revisionRows.every((row) => row.keys.length > 0)).toBe(true);
    expect(content.setRows.map((sheet) => sheet.layout)).toEqual(["S-02"]);
  });
});
