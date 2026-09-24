// M4P-1 — a vector PDF becomes sheets (R-TO-002, L-CAD-02, R-TO-004).
//
// F-RCC6-BNBC's vector set is put through the cad CLI exactly as the ingest seam spawns it, and the
// artifact is then read by the product's own stages: the Zod mirror, core's sheet reading (the
// title-block grammar, the scale state, the fidelity facts, the schemes a sheet's keys are of) and
// the viewer's render manifest. What a QS sees on the drawings screen — each page a card with its
// number and title, one that opens in the viewer — is read here from the same functions the screen
// calls, over the same bytes a real upload would hand them.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { forgetArtifacts } from "../../src/core/entitygraph/artifact";
import { entityGraphSchema, type EntityGraph } from "../../src/core/entitygraph/schema";
import { sheetsOfRecord, type SheetFacts } from "../../src/core/sheets";
import type { Storage } from "../../src/core/storage";
import { factsOf } from "../../src/modules/takeoff/ingest/facts";
import { partitionArtifact } from "../../src/modules/takeoff/partition/views/assign";
import { VIEW_TYPE } from "../../src/modules/takeoff/partition/views/law";
import { buildRenderManifest } from "../../src/modules/takeoff/viewer/manifest";
import { REPO_ROOT, requireCadPackage, runIngest } from "./support/artifact";

const BNBC = join(REPO_ROOT, "fixtures", "rcc6-bnbc");

/** The generator's own roster of the set: its sheets in page order, each with its number and title. */
type RosterSheet = { readonly number: string; readonly title: string };

/** A tenant and a content hash no other suite reads, so the artifact cache answers this graph alone. */
const TENANT = "00000000-0000-4000-8000-00000000f401";
const ARTIFACT_SHA = "f".repeat(63) + "1";

let dir = "";
let graph: EntityGraph;
let bytes: Uint8Array;
let sheets: SheetFacts[];
let roster: readonly RosterSheet[];

/** A storage port that answers the one artifact this suite ingested, at any address. */
function storageHolding(held: Uint8Array): Storage {
  return {
    put: async () => {
      throw new Error("this stand-in is read-only");
    },
    get: async () => held,
  } as unknown as Storage;
}

beforeAll(async () => {
  requireCadPackage();
  dir = mkdtempSync(join(tmpdir(), "cubit-pdf-sheets-"));
  const out = join(dir, "rcc6-bnbc.entitygraph.json");
  const run = runIngest(join(BNBC, "rcc6-bnbc.pdf"), out);
  expect(run.status, `vextrus-cad ingest rcc6-bnbc.pdf exited ${String(run.status)}\n${run.stderr}`).toBe(0);
  bytes = new Uint8Array(readFileSync(out));
  graph = entityGraphSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
  roster = (JSON.parse(readFileSync(join(BNBC, "manifest.json"), "utf8")) as { sheets: RosterSheet[] }).sheets;

  forgetArtifacts();
  const record = { ingestId: "00000000-0000-4000-8000-00000000f402", drawingId: "00000000-0000-4000-8000-00000000f403", artifactSha256: ARTIFACT_SHA, extractor: { scheme: graph.ingest.scheme }, facts: factsOf(graph) };
  sheets = await sheetsOfRecord(TENANT, record, storageHolding(bytes));
}, 240_000);

afterAll(() => {
  forgetArtifacts();
  if (dir !== "") rmSync(dir, { recursive: true, force: true });
});

describe("M4P-1: a vector PDF set is ingested page by page", () => {
  it("the artifact is a PDF lane's: pypdfium2 under PDF_OBJECT, every key a whole sha256, no world unit claimed", () => {
    expect(graph.ingest.scheme).toBe("PDF_OBJECT");
    expect(graph.ingest.tool).toBe("pypdfium2");
    // S-03's pasted scan is traced (M4P-3): its lines are the vectoriser's keys, pinned beside pdfium's.
    expect(graph.ingest.trace?.tool, "the vectoriser that traced S-03's scan is pinned beside pdfium (I-518)").toBe("opencv-lsd");
    const traced = graph.entities.filter((entity) => entity.key.startsWith("RASTER_TRACE:"));
    expect(new Set(traced.map((entity) => entity.space)), "only the page carrying a scan mints traced keys").toEqual(new Set(["Page 4"]));
    expect(graph.entities.every((entity) => /^(PDF_OBJECT|RASTER_TRACE):[0-9A-F]{64}$/.test(entity.key))).toBe(true);
    expect(graph.insunits, "page space states no drawing unit, so a scale is a QS's to affirm (I-513)").toEqual({ code: 0, unit: "unitless", unmapped: false });
  });

  it("each page is a sheet, in page order, and its title block proposes the number and title its roster states", () => {
    expect(sheets.map((sheet) => sheet.layoutName)).toEqual(roster.map((_sheet, index) => `Page ${String(index + 1)}`));
    for (const [index, sheet] of sheets.entries()) {
      const owed = roster[index];
      expect(sheet.kind, `${sheet.layoutName} is paper`).toBe("paper");
      expect(sheet.proposal.basis, `${sheet.layoutName} is read by the grammar`).toBe("GRAMMAR");
      expect(sheet.proposal.number, `${sheet.layoutName} proposes the number printed in its title block`).toBe(owed?.number);
      expect(owed?.title.startsWith(sheet.proposal.title) ?? false, `${sheet.layoutName} proposes "${sheet.proposal.title}", the head of "${owed?.title ?? ""}"`).toBe(true);
    }
    const s10 = sheets[10];
    expect({ number: s10?.proposal.number, title: s10?.proposal.title, discipline: s10?.proposal.discipline }).toEqual({ number: "S-10", title: "COLUMN LAYOUT PLAN", discipline: "STRUCTURAL" });
  });

  it("each sheet reads its schemes from its own keys, stands unaffirmed rather than unplaceable, and names its collapses", () => {
    for (const sheet of sheets) {
      // S-03 (Page 4) is the mixed page: a drafted sheet with a scan pasted on it reads both (I-519).
      const owed = sheet.layoutName === "Page 4" ? ["PDF_OBJECT", "RASTER_TRACE"] : ["PDF_OBJECT"];
      expect(sheet.schemes, `${sheet.layoutName}'s keys are of the schemes it minted (I-519)`).toEqual(owed);
      expect(sheet.scaleState, `${sheet.layoutName} has extents and states no world unit: its scale waits on a QS, it is not unplaceable`).toBe("unaffirmed");
      const counted = graph.counters.find((counter) => counter.space === sheet.layoutName)?.collapsed ?? {};
      expect(sheet.facts.collapsed, `${sheet.layoutName} carries its collapses as a fidelity fact (I-520)`).toBe(Object.values(counted).reduce((sum, count) => sum + count, 0));
    }
    expect(sheets.some((sheet) => (sheet.facts.collapsed as number) > 0), "the set collapses duplicated strokes somewhere, so the fact is not vacuous").toBe(true);
  });

  it("a page carrying a picture nobody read says so on its card: the logo on page 1; page 4's pasted scan is traced, and its card states the scan (I-521, I-584)", () => {
    const unread = Object.fromEntries(sheets.map((sheet) => [sheet.layoutName, sheet.facts.unread]));
    const carrying = Object.entries(unread).filter(([, count]) => count !== 0);
    expect(carrying, "the logo is a picture, never read; the hook-detail scan is traced, so it is read").toEqual([["Page 1", 1]]);
    const scanned = sheets.filter((sheet) => sheet.scans.length > 0);
    expect(
      scanned.map((sheet) => [sheet.layoutName, sheet.scans.map((scan) => [scan.dpi, scan.dpiSource, scan.deskewDegrees])]),
      "S-03's card states its scan's DPI — read off where it is placed — and the turn it was squared by",
    ).toEqual([["Page 4", [[152.4, "placement", 0]]]]);
    const images = graph.entities.filter((entity) => entity.type === "IMAGE");
    expect(images.map((image) => image.space).sort(), "each is still listed at its placement").toEqual(["Page 1", "Page 4"]);
    expect(images.every((image) => image.closed === false), "and its frame is open, so no outline reader takes it for a member (I-521)").toBe(true);
  });

  it("a page opens in the viewer: its render manifest holds its lines and texts under their PDF keys", () => {
    const manifest = buildRenderManifest(graph, "Page 11");
    const records = manifest.layers.flatMap((layer) => layer.records);
    expect(records.length, "the page paints").toBeGreaterThan(100);
    expect(records.every((record) => record.key?.startsWith("PDF_OBJECT:") === true)).toBe(true);
    expect(records.some((record) => record.text === "S-10 COLUMN LAYOUT PLAN"), "the title block's line is painted where the grammar read it").toBe(true);
    expect(manifest.extents, "the page frames a box the viewer can fit").not.toBeNull();
  });
});

describe("M4P-2: the vector set is partitioned page by page (I-681)", () => {
  it("every original of every page, PDF_OBJECT and RASTER_TRACE alike, is assigned once, to a view of its own page", () => {
    const partition = partitionArtifact(graph);
    const pageOf = new Map(partition.views.map((view) => [view.viewKey, view.page]));
    expect(partition.assignments.size, "every original is assigned").toBe(graph.entities.length);
    const strays = graph.entities.filter((entity) => pageOf.get(partition.assignments.get(entity.key) ?? "") !== entity.space);
    expect(strays.map((entity) => entity.key), "and each to a view read on the page it is drawn on").toEqual([]);
    expect(new Set(partition.views.map((view) => view.page)), "each of the set's pages is read as its own drawing space").toEqual(new Set(sheets.map((sheet) => sheet.layoutName)));
    const traced = graph.entities.filter((entity) => entity.key.startsWith("RASTER_TRACE:"));
    expect(traced.length, "S-03's pasted scan is traced, so its lines are owed a view").toBeGreaterThan(0);
  });

  it("S-10's page is one LAYOUT_PLAN view anchored on its caption, holding every original of the page", () => {
    const partition = partitionArtifact(graph);
    const onPage = partition.views.filter((view) => view.page === "Page 11");
    expect(onPage.map((view) => ({ type: view.type, caption: view.caption }))).toEqual([{ type: VIEW_TYPE.LAYOUT_PLAN, caption: "COLUMN LAYOUT PLAN SCALE 1:100" }]);
    const plan = onPage[0];
    const anchor = graph.entities.find((entity) => entity.key === plan?.anchorKey);
    expect(anchor?.space, "the anchor is a text of S-10's own page").toBe("Page 11");
    const originals = graph.entities.filter((entity) => entity.space === "Page 11");
    expect(
      originals.every((entity) => partition.assignments.get(entity.key) === plan?.viewKey),
      "a grid point a QS cites on S-10 is held by the plan (L-MEA-05)",
    ).toBe(true);
  });
});
