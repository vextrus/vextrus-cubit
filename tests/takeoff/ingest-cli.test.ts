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
