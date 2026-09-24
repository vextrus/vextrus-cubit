/**
 * AC-2 — `ingestDrawing` across the CLI seam (SEAM-CAD, L-CAD-01, L-CAD-04).
 *
 * The seam is one subprocess invocation per drawing, in a temp dir of the job's own, and the thing
 * that decides whether it worked is the ARTIFACT: present, and parsing under the Zod mirror both
 * sides of the seam share. An exit status is not a success signal (L-CAD-04 says so in as many
 * words), so both halves of that are driven here — a real refusal the CLI reports with a non-zero
 * status, and a stand-in that exits 0 having written nothing, or something the mirror will not
 * parse.
 *
 * The default invocation is proven against the real `cad/` CLI over the committed corpus; the argv,
 * the working directory and the once-per-drawing property are proven against a stand-in named
 * through `CUBIT_CAD_COMMAND`, which is the only way to see what the product really spawned without
 * reading its source.
 *
 * No database and no storage: this is the seam alone. The pipeline that carries an artifact into the
 * store is `ingest-pipeline.test.ts`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { asStoredV2 } from "../cad/support/artifact";
import {
  CAD_COMMAND_VAR,
  cadFixture,
  committedArtifact,
  corpusBytes,
  ENTITYGRAPH_MODULE,
  ingestSeam,
  productModule,
  REPO_ROOT,
  sha256Of,
  SHEET_NOT_INGESTABLE,
  stubCli,
  tempDir,
  withCadCommand,
  type GraphSchema,
  type IngestSeam,
} from "./support/ingest-stage";

/** How long a real `uv run` may take, cold: the first invocation materialises the cad environment. */
const CLI_BUDGET_MS = 300_000;

/** The corpus AC-2 names, each read as bytes the way a stored drawing arrives. */
const CORPUS: readonly { label: string; bytes: () => Uint8Array }[] = [
  { label: "cad/tests/fixtures/basic.dxf", bytes: () => cadFixture("basic") },
  { label: "cad/tests/fixtures/blocks.dxf", bytes: () => cadFixture("blocks") },
  { label: "cad/tests/fixtures/layouts.dxf", bytes: () => cadFixture("layouts") },
  { label: "fixtures/rcc6/rcc6.dxf", bytes: () => corpusBytes(join("fixtures", "rcc6", "rcc6.dxf")) },
];

/** Bytes no extractor can read, presented under a name that claims they are a drawing. */
const NOT_A_DRAWING = new TextEncoder().encode("this is not a DXF; it is a sentence.\n");

async function seam(): Promise<IngestSeam> {
  return await ingestSeam();
}

describe("AC-2 — one invocation, judged by its artifact", () => {
  test(
    "AC-2: every drawing of the declared corpus comes back as a parsed EntityGraph and the artifact that carries it",
    async () => {
      const { ingestDrawing } = await seam();
      const { entityGraphSchema } = await productModule<GraphSchema>(ENTITYGRAPH_MODULE);

      for (const source of CORPUS) {
        const bytes = source.bytes();
        const digest = sha256Of(bytes);
        const dir = tempDir("cli");

        const outcome = await ingestDrawing(bytes, "dxf", { tempDir: dir });
        expect(outcome.ok, `${source.label} is a drawing the extractor reads; it answered ${JSON.stringify(outcome)}`.slice(0, 600)).toBe(true);
        if (!outcome.ok) return;

        // The input is laid down under its own address, and the artifact beside it (AC-2).
        const input = join(dir, `${digest}.dxf`);
        const written = join(dir, `${digest}.entitygraph.json`);
        expect(existsSync(input), `the bytes are written to <tempDir>/<sha256>.<format> — ${input}`).toBe(true);
        expect(sha256Of(new Uint8Array(readFileSync(input))), "the file written is the drawing itself, unaltered").toBe(digest);
        expect(existsSync(written), `the CLI is told to write <tempDir>/<sha256>.entitygraph.json — ${written}`).toBe(true);

        // `artifact` is the bytes the CLI wrote, and `graph` is those bytes through the shared mirror.
        expect(Buffer.from(outcome.artifact).equals(readFileSync(written)), "the artifact answered is the bytes the CLI wrote, byte for byte").toBe(true);
        const parsed = entityGraphSchema.parse(JSON.parse(new TextDecoder().decode(outcome.artifact)));
        expect(outcome.graph, `${source.label}: graph is entityGraphSchema.parse of the artifact`).toStrictEqual(parsed);
      }
    },
    CLI_BUDGET_MS,
  );

  test(
    "AC-2: DWG drawings are converted and ingested across the CLI seam",
    async () => {
      const { ingestDrawing } = await seam();
      const { entityGraphSchema } = await productModule<GraphSchema>(ENTITYGRAPH_MODULE);
      const dwgBytes = new Uint8Array(readFileSync(join(REPO_ROOT, "cad/tests/dwg/fixtures/basic.dwg")));
      const dir = tempDir("cli-dwg");

      const outcome = await ingestDrawing(dwgBytes, "dwg", { tempDir: dir });
      expect(outcome.ok, `basic.dwg answered: ${JSON.stringify(outcome)}`).toBe(true);
      if (!outcome.ok) return;

      const parsed = entityGraphSchema.parse(JSON.parse(new TextDecoder().decode(outcome.artifact)));
      expect(outcome.graph).toStrictEqual(parsed);
      const entities = Array.isArray(outcome.graph["entities"]) ? outcome.graph["entities"] : [];
      expect(entities.length).toBeGreaterThan(0);
    },
    CLI_BUDGET_MS,
  );

  test("AC-2: the CLI is spawned once, at the checkout root, with the argv the contract spells", async () => {
    const { ingestDrawing } = await seam();
    const bytes = cadFixture("basic");
    const digest = sha256Of(bytes);
    const dir = tempDir("argv");
    // A stand-in that writes a committed artifact: what it DOES is not what this case judges — what
    // it was ASKED is. Its command is two words, so the prefix is whitespace-split, not shell-run.
    const stub = stubCli({ artifact: JSON.stringify(committedArtifact("basic")), stderr: "", exitCode: 0 });

    const outcome = await withCadCommand(stub.command, async () => await ingestDrawing(bytes, "dxf", { tempDir: dir }));

    expect(stub.calls(), `the CLI is invoked exactly once per drawing (L-CAD-01), and ${CAD_COMMAND_VAR} named the stand-in`).toBe(1);
    const invocation = stub.invocation();
    expect(invocation?.argv, "the subcommand and its two arguments are exactly the test contract's").toEqual([
      "ingest",
      join(dir, `${digest}.dxf`),
      "--out",
      join(dir, `${digest}.entitygraph.json`),
    ]);
    expect(invocation?.cwd, "the CLI runs at the checkout root — `uv run --project cad` is resolved from there").toBe(REPO_ROOT);
    expect(outcome.ok, "an artifact the mirror parses is a successful ingest, whoever wrote it").toBe(true);
  });

  test(
    "AC-2: bytes no extractor can read are refused, and the refusal carries what the CLI said",
    async () => {
      const { ingestDrawing } = await seam();
      const outcome = await withCadCommand(undefined, async () => await ingestDrawing(NOT_A_DRAWING, "dxf", { tempDir: tempDir("garbage") }));

      expect(outcome.ok, "bytes that are not a drawing produce no artifact, so the sheet is refused").toBe(false);
      if (outcome.ok) return;
      expect(outcome.refusal, "the registered code for a sheet nothing could be taken from").toBe(SHEET_NOT_INGESTABLE);
      expect(outcome.detail.trim().length, "the refusal carries the CLI's own account of why — a silent refusal tells an operator nothing").toBeGreaterThan(0);
    },
    CLI_BUDGET_MS,
  );

  test(
    "M4P-1: a vector PDF crosses the seam as an EntityGraph under PDF_OBJECT, its unread image named on its page (R-TO-002, I-521)",
    async () => {
      const { ingestDrawing } = await seam();
      const { entityGraphSchema } = await productModule<GraphSchema>(ENTITYGRAPH_MODULE);
      const outcome = await withCadCommand(undefined, async () => await ingestDrawing(corpusBytes(join("cad", "tests", "fixtures", "forms.pdf")), "pdf", { tempDir: tempDir("cli-pdf") }));

      expect(outcome.ok, `forms.pdf answered: ${JSON.stringify(outcome)}`.slice(0, 600)).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.graph).toStrictEqual(entityGraphSchema.parse(JSON.parse(new TextDecoder().decode(outcome.artifact))));
      const ingest = outcome.graph["ingest"] as Record<string, unknown>;
      expect([ingest["scheme"], ingest["tool"], ingest["trace"]], "pdfium read it, and no vectoriser did").toEqual(["PDF_OBJECT", "pypdfium2", undefined]);
      const counters = outcome.graph["counters"] as { space: string; unread?: Record<string, number> }[];
      expect(counters.map((row) => [row.space, row.unread]), "page 1's image is carried and named, never read").toEqual([
        ["Page 1", { IMAGE: 1 }],
        ["Page 2", {}],
      ]);
    },
    CLI_BUDGET_MS,
  );

  test(
    "M4P-3: a scan crosses the seam traced — its lines under RASTER_TRACE, its record's page raster read from beside the artifact (R-TO-003, I-584)",
    async () => {
      const { ingestDrawing } = await seam();
      const { entityGraphSchema } = await productModule<GraphSchema>(ENTITYGRAPH_MODULE);
      // S-03's pasted hook detail, as its own scan: 720 x 480 grey, no resolution stated in the file.
      const scan = corpusBytes(join("fixtures", "rcc6-bnbc", "images", "hook-detail-scan.png"));
      const outcome = await withCadCommand(undefined, async () => await ingestDrawing(scan, "png", { tempDir: tempDir("cli-scan") }));

      expect(outcome.ok, `the scan answered: ${JSON.stringify(outcome)}`.slice(0, 600)).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.graph).toStrictEqual(entityGraphSchema.parse(JSON.parse(new TextDecoder().decode(outcome.artifact))));
      const ingest = outcome.graph["ingest"] as Record<string, unknown>;
      expect([ingest["scheme"], ingest["tool"], ingest["tool_version"]], "the pinned vectoriser read it").toEqual(["RASTER_TRACE", "opencv-lsd", "4.13.0.90"]);
      const entities = outcome.graph["entities"] as { key: string; type: string }[];
      expect(entities.length, "the detail's bars and hooks trace to lines").toBeGreaterThan(20);
      expect(entities.every((entity) => entity.type === "LINE" && /^RASTER_TRACE:[0-9A-F]{64}$/.test(entity.key)), "every traced line is a whole digest").toBe(true);

      const [record, ...more] = outcome.graph["rasters"] as { sha256: string; dpi: number | null; dpi_source: string; traced: number }[];
      expect(more, "one scan, one picture").toEqual([]);
      expect([record?.dpi, record?.dpi_source], "the file states no DPI, and the record says so rather than guess one").toEqual([null, "unstated"]);
      expect(record?.traced).toBe(entities.length);
      expect(
        outcome.pageRasters.map((raster) => raster.sha256),
        "the page raster the lines were taken from crosses beside the artifact",
      ).toEqual([record?.sha256]);
      expect(sha256Of(outcome.pageRasters[0]!.bytes), "under the name its bytes hash to").toBe(record?.sha256);
    },
    CLI_BUDGET_MS,
  );

  test("M4P-3: an artifact naming a page raster the run did not write is refused whole (I-584)", async () => {
    const { ingestDrawing } = await seam();
    const good = committedArtifact("basic");
    const record = { space: "model", sha256: "0".repeat(64), width: 4, height: 4, dpi: null, dpi_source: "unstated", deskew_degrees: 0, placement: [[0, 4], [4, 4], [4, 0], [0, 0]], traced: 0, dropped_short: 0 };
    const naming = stubCli({ artifact: JSON.stringify({ ...good, entities: [], derived: [], block_attributes: [], rasters: [record], ingest: { ...(good["ingest"] as object), scheme: "RASTER_TRACE" } }), stderr: "", exitCode: 0 });
    const outcome = await withCadCommand(naming.command, async () => await ingestDrawing(cadFixture("basic"), "dxf", { tempDir: tempDir("no-raster") }));
    expect(outcome.ok, "a traced picture nobody can show is half an ingest").toBe(false);
    if (!outcome.ok) expect(outcome.detail).toContain(`names a page raster ${"0".repeat(64)} it did not write`);
  });

  test("AC-2: the judgement is the artifact, never the exit status", async () => {
    const { ingestDrawing } = await seam();
    const bytes = cadFixture("basic");
    const good = committedArtifact("basic");

    // Exit 0, wrote nothing: a run that claims success and produced no geometry is not an ingest.
    const silent = stubCli({ artifact: null, stderr: "", exitCode: 0 });
    const nothing = await withCadCommand(silent.command, async () => await ingestDrawing(bytes, "dxf", { tempDir: tempDir("exit0") }));
    expect(nothing.ok, "a CLI that exits 0 having written no artifact is refused (L-CAD-04: the exit code is not a success signal)").toBe(false);
    expect(silent.calls(), "the stand-in really was the thing that ran").toBe(1);

    // Exit 0, wrote something the shared mirror will not parse: an artifact of the wrong vocabulary
    // is no artifact. EntityGraph v2 is the floor (L-CAD-05), so a v1 document is one.
    const stale = stubCli({ artifact: JSON.stringify({ ...good, entitygraph_version: 1 }), stderr: "", exitCode: 0 });
    const unparsed = await withCadCommand(stale.command, async () => await ingestDrawing(bytes, "dxf", { tempDir: tempDir("stale") }));
    expect(unparsed.ok, "an artifact the EntityGraph mirror will not parse is not geometry this product can read").toBe(false);
    if (!unparsed.ok) expect(unparsed.refusal, "and the sheet is refused by name").toBe(SHEET_NOT_INGESTABLE);

    // Exit non-zero having written a perfectly good artifact: the geometry is there, so it is taken.
    const noisy = stubCli({ artifact: JSON.stringify(good), stderr: "warnings are not failures\n", exitCode: 3 });
    const taken = await withCadCommand(noisy.command, async () => await ingestDrawing(bytes, "dxf", { tempDir: tempDir("noisy") }));
    expect(taken.ok, "an artifact that parses is an ingest even when the process exited non-zero — the artifact is the judgement").toBe(true);
  });

  test("EntityGraph v3: a stale cad install writing the v2 floor is stopped at the door by name, and nothing is taken", async () => {
    // The mirror reads v2 because an artifact STORED before v3 must keep reading; a FRESH v2 is a
    // cad install older than this checkout, and an ingest taken from it would store a drawing with
    // every turned mark and block identity missing and nothing to say so (I-415). The drawing
    // was never judged, so this is not the sheet's refusal (whose remedy tells the operator to
    // export it again) but an outage of ours, named (ARCH-03).
    const { ingestDrawing } = await seam();
    const stored = asStoredV2(committedArtifact("basic"));
    const { entityGraphSchema } = await productModule<GraphSchema>(ENTITYGRAPH_MODULE);
    expect(() => entityGraphSchema.parse(stored), "the stand-in's output is a lawful v2 artifact — the stored-read path admits it").not.toThrow();

    const stale = stubCli({ artifact: JSON.stringify(stored), stderr: "", exitCode: 0 });
    const attempt = withCadCommand(stale.command, async () => await ingestDrawing(cadFixture("basic"), "dxf", { tempDir: tempDir("stale-install") }));

    await expect(attempt, "the door names the stale install and both versions").rejects.toThrow(/cad extractor is stale: it wrote EntityGraph v2, and this product ingests v3/);
    expect(stale.calls(), "the stand-in really was the thing that ran").toBe(1);

    // The current version through the same stand-in is taken, so what stopped the run was the version.
    const current = stubCli({ artifact: JSON.stringify(committedArtifact("basic")), stderr: "", exitCode: 0 });
    const taken = await withCadCommand(current.command, async () => await ingestDrawing(cadFixture("basic"), "dxf", { tempDir: tempDir("current-install") }));
    expect(taken.ok, "a v3 artifact from the same stand-in is an ingest").toBe(true);
  });

  test("AC-2: a refusal's detail carries the tail of what the CLI said on stderr", async () => {
    const { ingestDrawing } = await seam();
    const marker = "vextrus-cad: cannot ingest this sheet: SPECIFIC-REASON-9f2c";
    const loud = stubCli({ artifact: null, stderr: `noise on an earlier line\n${marker}\n`, exitCode: 2 });

    const outcome = await withCadCommand(loud.command, async () => await ingestDrawing(cadFixture("basic"), "dxf", { tempDir: tempDir("stderr") }));
    expect(outcome.ok, "nothing was written, so nothing was ingested").toBe(false);
    if (outcome.ok) return;
    expect(outcome.detail, "the detail carries the tail of the CLI's stderr, so an operator reads the extractor's own words").toContain(marker);
  });
});
