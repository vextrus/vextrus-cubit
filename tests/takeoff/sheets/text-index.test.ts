// @vitest-environment node
/**
 * SRCH-1 — the words a drawing's sheets show, indexed once per artifact (R-SPINE-052's first cut;
 * docs/design/command-palette.md I-626…c).
 *
 * WHAT IS READ AND NOTHING IS STAGED: F-RCC6-BNBC read by the SHIPPED `cad/` CLI — the artifact the
 * product stores — and indexed by the module's own pure reading. The handles named below are the
 * committed fixture's own (the extractor identity pins them, L-CAD-02), as `sheet-of-key.test.ts`
 * names them; every other expectation is read off the artifact itself (B-19).
 *
 * The CACHE is proven over more drawings than `artifactAt` keeps (four): a second search of six
 * drawings must read no artifact at all, where the artifact cache alone re-reads and re-validates.
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { artifactAt, artifactCacheTally, forgetArtifacts } from "@/core/entitygraph/artifact";
import { normaliseNotation } from "@/core/entitygraph/notation";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { Storage } from "@/core/storage";
import { ingestDrawing } from "@/modules/takeoff/ingest/cli";
import {
  excerptOf,
  findInIndex,
  forgetTextIndexes,
  paragraphsOf,
  textIndexAt,
  textIndexOf,
  textIndexTally,
  wordsOf,
  type TextIndex,
} from "@/modules/takeoff/sheets/text-index";

/** How long the shipped CLI may take to read the drawing cold (the cad lane's own budget). */
const READ_MS = 300_000;

const BNBC_DXF = "fixtures/rcc6-bnbc/rcc6-bnbc.dxf";
const VIEWPORTS_ARTIFACT = "cad/tests/fixtures/viewports.entitygraph.json";

/** A source key of the committed fixture, by its handle. */
const handle = (hex: string): string => `DXF_HANDLE:${hex}`;

let graph: EntityGraph;
let index: TextIndex;

beforeAll(async () => {
  const outcome = await ingestDrawing(new Uint8Array(readFileSync(join(process.cwd(), BNBC_DXF))), "dxf", { tempDir: mkdtempSync(join(tmpdir(), "cubit-text-index-")) });
  if (!outcome.ok) throw new Error(`the shipped cad CLI refused ${BNBC_DXF}: ${outcome.refusal} — ${outcome.detail}`);
  graph = outcome.graph;
  index = textIndexOf(graph);
}, READ_MS);

/** Every text record of the artifact, raw, with the key a viewer selects it by — the independent reading. */
function rawTexts(): { key: string; text: string; from: "entity" | "attribute" | "derived" }[] {
  return [
    ...graph.entities.filter((entity) => entity.text !== undefined && (entity.type === "TEXT" || entity.type === "MTEXT")).map((entity) => ({ key: entity.key, text: entity.text as string, from: "entity" as const })),
    ...graph.block_attributes.map((attribute) => ({ key: attribute.src, text: attribute.text, from: "attribute" as const })),
    ...graph.derived.filter((record) => record.text !== undefined && (record.type === "TEXT" || record.type === "MTEXT")).map((record) => ({ key: record.src, text: record.text as string, from: "derived" as const })),
  ];
}

describe("the words, as the index reads them (I-626)", () => {
  test("a word is a whole run of letters and digits, upper-cased: C3 and PC3 are two words", () => {
    expect(wordsOf("pc3 & C3, 2-C3")).toEqual(["PC3", "C3", "2", "C3"]);
    expect(wordsOf("f'c = 3500 psi")).toEqual(["F", "C", "3500", "PSI"]);
    expect(wordsOf(" — ")).toEqual([]);
  });

  test("an MTEXT reads as its paragraphs, codes stripped and `%%` resolved; a TEXT is one paragraph", () => {
    expect(paragraphsOf("MTEXT", "{\\fSwis721 Cn BT|b1|i0|c0|p34;\\LGENERAL NOTES}\\P\\A1;1. READ WITH  THE ARCH")).toEqual(["GENERAL NOTES", "1. READ WITH THE ARCH"]);
    expect(paragraphsOf("TEXT", "%%C50 BAR %%D45")).toEqual([normaliseNotation("%%C50 BAR %%D45")]);
    expect(paragraphsOf("MTEXT", "\\P\\P")).toEqual([]);
  });

  test("a long paragraph is shown around the words asked for, cut at word boundaries and marked where cut", () => {
    const clause = "6. CONCRETE: CYLINDER STRENGTH AT 28 DAYS AS NOTED BELOW. CEMENT CEM-I 52.5N. MAXIMUM AGGREGATE 20 mm. f'c = 3500 psi FOR ALL MEMBERS U.N.O. SLUMP 100 mm. CURE BY PONDING FOR NOT LESS THAN 14 DAYS AFTER CASTING";
    const at = clause.indexOf("3500 psi");
    const shown = excerptOf(clause, at, at + "3500 psi".length);
    expect(shown.text, "the words asked for are inside what is shown").toContain("3500 psi");
    expect(shown.clippedStart && shown.clippedEnd, "a clause cut at both ends says so at both ends").toBe(true);
    expect(clause.includes(shown.text), "and what is shown is the clause's own words, unchanged").toBe(true);
    expect(excerptOf("C2", 0, 2)).toEqual({ text: "C2", clippedStart: false, clippedEnd: false });
  });
});

describe("F-RCC6-BNBC's words, found on their sheets (R-SPINE-052, I-627)", () => {
  test("'LIFT CORE' answers every text that says it — S-23's three among them, each placed by core's resolver", () => {
    const found = findInIndex(index, "LIFT CORE");
    const said = found.map((match) => [match.entry.key, match.entry.sheetLabel]);
    expect(said).toEqual([
      // The seven model-space labels, each framed by the one plan sheet whose window shows it.
      [handle("D3D"), "S-13"],
      [handle("EF9"), "S-14"],
      [handle("1090"), "S-15"],
      [handle("10C5"), "S-15"],
      [handle("1979"), "S-19"],
      [handle("1ABA"), "S-20"],
      [handle("1BE7"), "S-21"],
      // The cover's drawing index, S-23's own title and its plan's caption — drawn on the paper.
      [handle("1F00"), "S-00"],
      [handle("2246"), "S-23"],
      [handle("2247"), "S-23"],
      // S-23's title block names the sheet in an ATTRIBUTE, found under its block reference's key.
      [handle("2237"), "S-23"],
    ]);
    expect(found.filter((match) => match.entry.sheetLabel === "S-23").length, "three of them name S-23").toBe(3);
    // The map's count of 10 was over TEXT and MTEXT alone; the attribute is the eleventh (I-627).
    const raw = rawTexts().filter((one) => /LIFT\s+CORE/i.test(one.text));
    expect(raw.filter((one) => one.from === "entity").length, "the drawing's own TEXT and MTEXT say it ten times").toBe(10);
    expect(raw.filter((one) => one.from === "attribute").map((one) => one.key), "and one title block's attribute says it once more").toEqual([handle("2237")]);
    expect(found.length, "and every one of the eleven is answered, once").toBe(raw.length);
  });

  test("'C3' answers the texts where C3 is a WORD and none of the PC3s", () => {
    const found = findInIndex(index, "C3");
    const keys = new Set(found.map((match) => match.entry.key));
    expect(found.length, "nine texts say C3 as a word — six marks on S-10, the schedule's, and two on S-12").toBe(9);
    for (const match of found) expect(match.entry.words.some((words) => words.includes("C3")), `${match.entry.key} says C3 as a word`).toBe(true);

    const pc3 = rawTexts().filter((one) => /PC3/i.test(one.text) && !wordsOf(normaliseNotation(one.text)).includes("C3"));
    expect(pc3.length, "the drawing says PC3 in texts that never say C3 — the case a substring match gets wrong").toBeGreaterThan(0);
    for (const one of pc3) expect(keys.has(one.key), `${one.key} ("${one.text}") says PC3, not C3`).toBe(false);
    expect(rawTexts().filter((one) => one.text.toUpperCase().includes("C3")).length, "a substring match would have answered far more").toBeGreaterThan(found.length);
    expect(found.filter((match) => match.entry.sheetLabel === "S-10").length, "C3's marks stand on S-10, the column layout plan").toBe(6);
  });

  test("an MTEXT is found by what it says, its codes stripped: the pile-cap schedule's title and the general notes' heading", () => {
    const schedule = findInIndex(index, "PILE CAP SCHEDULE").find((match) => match.entry.key === handle("639"));
    expect(schedule, "the schedule's MTEXT title (`\\LPILE CAP SCHEDULE\\l\\P…`) is found").toBeDefined();
    expect(schedule?.excerpt.text, "…as the words drawn, with no underline code").toBe("PILE CAP SCHEDULE");
    expect(schedule?.exact, "…and it says exactly what was asked").toBe(true);
    const notes = findInIndex(index, "GENERAL NOTES").find((match) => match.entry.key === handle("1F3E"));
    expect(notes?.excerpt.text, "the notes' heading, out of its font run (`{\\fSwis721 Cn BT|…;\\LGENERAL NOTES}`)").toBe("GENERAL NOTES");

    const coded = index.entries.flatMap((entry) => entry.paragraphs).filter((paragraph) => /\\[PLlOoKkfFAaHhCcQqTtWw]|%%[CcDdPpUuOoKk%]/.test(paragraph));
    expect(coded, "no indexed paragraph still carries an MTEXT code or a `%%` code").toEqual([]);
  });

  test("a block reference's paint says each thing once under its key: 27 title blocks, one DATE each", () => {
    const found = findInIndex(index, "DATE").filter((match) => match.exact);
    const painted = rawTexts().filter((one) => one.from === "derived" && one.text === "DATE");
    const blocks = new Set(painted.map((one) => one.key));
    expect(painted.length, "each title block paints DATE twice (the job line and the revisions table)").toBe(2 * blocks.size);
    expect(index.entries.filter((entry) => entry.paragraphs.includes("DATE")).length, "the index itself keeps one DATE entry per block, not two").toBe(blocks.size);
    expect(found.length, "and each is answered once, under its own reference").toBe(blocks.size);
    expect(new Set(found.map((match) => match.entry.sheetLabel)).size, "one on each sheet").toBe(blocks.size);
  });

  test("the QS's C2: its marks on S-10 answered first as exact words, its schedule and details after", () => {
    const found = findInIndex(index, "C2");
    expect(found.filter((match) => match.entry.sheetLabel === "S-10" && match.exact).length, "C2's eight marks stand on S-10").toBe(8);
    expect(found.every((match) => match.entry.words.some((words) => words.includes("C2")))).toBe(true);
    expect(findInIndex(index, "c2").map((match) => match.entry.key), "asked in lower case, the same answer").toEqual(found.map((match) => match.entry.key));
  });

  test("a query holding no word asks for nothing", () => {
    expect(findInIndex(index, " & ")).toEqual([]);
    expect(findInIndex(index, "")).toEqual([]);
  });
});

describe("a key is found once — it is what a find opens (I-627)", () => {
  test("a title block paints SHEET TITLE and SHEET NO. under its one reference: each block is one find, none is lost", () => {
    for (const query of ["SHEET", "NO", "REV"]) {
      const [word] = wordsOf(query);
      const saying = index.entries.filter((entry) => entry.words.some((words) => words.includes(word as string)));
      const keys = new Set(saying.map((entry) => entry.key));
      expect(saying.length, `the index holds several texts under one key that say ${query} — the case this judges`).toBeGreaterThan(keys.size);

      const found = findInIndex(index, query).map((match) => match.entry.key);
      expect(found.length, `'${query}' answers each key once: ${found.length} finds over ${keys.size} keys`).toBe(new Set(found).size);
      expect(new Set(found), `and answers every key that says ${query}`).toEqual(keys);
    }
    const block = findInIndex(index, "SHEET").filter((match) => match.entry.key === handle("1E48"));
    expect(block.length, "S-00's title block (SHEET TITLE, SHEET NO.) is one find").toBe(1);
  });

  test("of a key's texts, the one saying exactly what was asked stands for it, wherever it was drawn", () => {
    const base = JSON.parse(readFileSync(join(process.cwd(), VIEWPORTS_ARTIFACT), "utf8")) as EntityGraph;
    const label = base.entities.find((entity) => entity.key === handle("92"));
    expect(label?.text, "the fixture's model-space label").toBe("C1 400x400");
    const { key, ...drawn } = label as EntityGraph["entities"][number];
    // The same key paints a bare `C1` after its label — as a block reference paints an attribute's words.
    const painted = { ...base, derived: [...base.derived, { ...drawn, src: key, text: "C1" }] } as EntityGraph;
    const said = (query: string): unknown[] => findInIndex(textIndexOf(painted), query).map((match) => [match.entry.key, match.excerpt.text, match.exact]);
    expect(said("C1"), "asked for C1: the paint that says exactly C1, not the label drawn first").toEqual([[handle("92"), "C1", true]]);
    expect(said("C1 400x400"), "asked for the whole label: the label").toEqual([[handle("92"), "C1 400x400", true]]);
  });
});

describe("the index is kept per content hash, apart from the four graphs artifactAt keeps", () => {
  const TENANT = "a1a1a1a1-1111-4111-8111-a1a1a1a1a1a1";

  /** Six distinct artifacts — more than `artifactAt` keeps — each the committed viewports fixture, renamed. */
  function sixArtifacts(): Map<string, Uint8Array> {
    const base = JSON.parse(readFileSync(join(process.cwd(), VIEWPORTS_ARTIFACT), "utf8")) as { entities: { text?: string }[] };
    const held = new Map<string, Uint8Array>();
    for (let at = 0; at < 6; at += 1) {
      const copy = structuredClone(base);
      for (const entity of copy.entities) if (entity.text !== undefined) entity.text = `${entity.text} D${at}`;
      held.set(`${at}`.padStart(64, "0"), new TextEncoder().encode(JSON.stringify(copy)));
    }
    return held;
  }

  function storageOver(bytes: Map<string, Uint8Array>): Storage {
    return { get: async (_tenantId: string, sha256: string) => bytes.get(sha256) ?? null } as unknown as Storage;
  }

  beforeEach(() => {
    forgetArtifacts();
    forgetTextIndexes();
  });

  test("a second search over six drawings reads no artifact; the artifact cache alone re-validates", async () => {
    const bytes = sixArtifacts();
    const storage = storageOver(bytes);
    const hashes = [...bytes.keys()];

    for (const sha of hashes) await textIndexAt(TENANT, sha, storage, `drawing ${sha}`);
    expect(artifactCacheTally().validations, "the first search reads and validates each drawing once").toBe(6);
    expect(textIndexTally().builds, "and indexes each once").toBe(6);

    for (const sha of hashes) {
      const again = await textIndexAt(TENANT, sha, storage, `drawing ${sha}`);
      expect(findInIndex(again, `D${hashes.indexOf(sha)}`).length, "each index is its own drawing's").toBeGreaterThan(0);
    }
    expect(artifactCacheTally().validations, "the second reads none of them again").toBe(6);
    expect(textIndexTally(), "every answer came from the index cache").toMatchObject({ builds: 6, hits: 6, kept: 6 });

    // What a search that walked the artifacts would pay: four graphs kept, six asked in turn.
    for (const sha of hashes) await artifactAt(TENANT, sha, storage, `drawing ${sha}`);
    expect(artifactCacheTally().validations, "the artifact cache alone re-reads and re-validates the drawings it retired").toBeGreaterThan(6);
  });

  test("an index is a tenant's: the same hash under another tenant is read under that tenant", async () => {
    const bytes = sixArtifacts();
    const storage = storageOver(bytes);
    const sha = [...bytes.keys()][0] as string;
    await textIndexAt(TENANT, sha, storage, "one");
    await textIndexAt("a2a2a2a2-1111-4111-8111-a2a2a2a2a2a2", sha, storage, "two");
    expect(textIndexTally().builds, "two tenants, two readings").toBe(2);
  });

  test("the viewports fixture's model-space text is placed on the sheet whose window frames it", async () => {
    const bytes = sixArtifacts();
    const one = await textIndexAt(TENANT, [...bytes.keys()][0] as string, storageOver(bytes), "one");
    const found = findInIndex(one, "C1");
    expect(found.map((match) => [match.entry.key, match.entry.layoutName]), "C1 400x400 is drawn in model space and shown on SHEET").toEqual([[handle("92"), "SHEET"]]);
  });
});
