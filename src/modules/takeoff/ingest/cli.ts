// SEAM-CAD across the process boundary (L-CAD-01, L-CAD-04): `ingestDrawing(bytes, format)` lays the
// drawing down in the job's own temp dir, invokes the `cad/` CLI once over it, and answers what came
// back — never anything about how the CLI got there.
//
// The judgement is the artifact, not the exit status: L-CAD-04 says the exit code is not a success
// signal in as many words, so a run that exits 0 having written nothing is refused and a run that
// exits non-zero having written geometry both mirrors parse is an ingest. A sheet nothing could be
// taken from is an answer (the registered SHEET_NOT_INGESTABLE), not a fault (ARCH-03, B-21).
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { entityGraphSchema, type EntityGraph } from "../../../core/entitygraph/schema";
import { REFUSALS } from "../../../core/errors";
import type { SheetNotIngestable } from "./refusals";

/** The formats this lane hands to the CLI (R-TO-001's DXF and DWG). */
export type IngestFormat = "dxf" | "dwg";

/** The machine's override of the CLI command prefix, whitespace-split (AS-01). */
export const CAD_COMMAND_VAR = "CUBIT_CAD_COMMAND";

/** The invocation the test contract spells, when the machine names none. */
const DEFAULT_CAD_COMMAND: readonly string[] = ["uv", "run", "--project", "cad", "vextrus-cad"];

/** The one subcommand `cad/` ships, and the flag it writes its artifact behind. */
const SUBCOMMAND = "ingest";
const OUT_FLAG = "--out";

/** The extension the artifact is written under, beside the drawing it was taken from. */
const ARTIFACT_SUFFIX = "entitygraph.json";

/**
 * How long one invocation may take. Generous, as L-CAD-04 asks: a DWG crosses two LibreDWG passes
 * of 900 s each, and the kind's `expireSeconds` stands above this so the queue never re-queues an
 * attempt that is still inside its own budget.
 */
const CLI_TIMEOUT_MS = 1_800_000;

/** How much of the extractor's own account of a refusal is carried back to the operator. */
const STDERR_TAIL_CHARS = 4000;

/** What one invocation amounted to: the geometry and the bytes that carry it, or a refused sheet. */
export type IngestOutcome = { ok: true; graph: EntityGraph; artifact: Uint8Array } | { ok: false; refusal: SheetNotIngestable; detail: string };

/** The sha256 of some bytes, lowercase hex — the address SEAM-STORAGE holds them under. */
export function digestOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** The command prefix the CLI is spawned under: the machine's, whitespace-split, or the default. */
function commandPrefix(): string[] {
  const stated = process.env[CAD_COMMAND_VAR]?.trim();
  return stated === undefined || stated === "" ? [...DEFAULT_CAD_COMMAND] : stated.split(/\s+/);
}

/** What one run of the CLI said and how it ended — neither of which decides whether it worked. */
type Run = { stderr: string; ended: string };

/**
 * Run the drawing through `cad/` once, in the directory the attempt was given.
 *
 * The input is written under its own address, so a temp dir holds the bytes the digest names and an
 * artifact beside them; the CLI runs at the checkout root, which is where `uv run --project cad`
 * resolves the project from.
 */
export async function ingestDrawing(bytes: Uint8Array, format: IngestFormat, options: { tempDir: string }): Promise<IngestOutcome> {
  const digest = digestOf(bytes);
  const input = join(options.tempDir, `${digest}.${format}`);
  const out = join(options.tempDir, `${digest}.${ARTIFACT_SUFFIX}`);
  await writeFile(input, bytes);

  const run = await invoke([SUBCOMMAND, input, OUT_FLAG, out]);

  let artifact: Uint8Array;
  try {
    artifact = new Uint8Array(await readFile(out));
  } catch {
    // An extractor that took no geometry writes no file, whatever it exited with (L-CAD-04).
    return refused("the extractor wrote no artifact", run);
  }

  let document: unknown;
  try {
    document = JSON.parse(new TextDecoder().decode(artifact)) as unknown;
  } catch {
    return refused("the extractor's artifact is not a document this product can read", run);
  }

  // The vocabulary both sides of the seam parse (L-CAD-05): an artifact the mirror will not admit
  // is not geometry this product can read, whichever version of it was written.
  const parsed = entityGraphSchema.safeParse(document);
  if (!parsed.success) return refused("the extractor wrote no EntityGraph this product can read", run);
  return { ok: true, graph: parsed.data, artifact };
}

/** Spawn the CLI once, collecting what it said on stderr and how it ended. */
function invoke(argv: readonly string[]): Promise<Run> {
  const [command, ...prefix] = commandPrefix();
  return new Promise((settle, fail) => {
    const child = spawn(command ?? "", [...prefix, ...argv], { cwd: process.cwd(), stdio: ["ignore", "ignore", "pipe"], timeout: CLI_TIMEOUT_MS });
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    // A CLI that could not be spawned at all is an outage of ours, not a sheet's fault: it travels
    // to the caller as a failure rather than being dressed up as a refusal (ARCH-03).
    child.on("error", fail);
    child.on("close", (code, signal) => {
      settle({ stderr, ended: signal === null ? `exit status ${String(code)}` : `signal ${signal}` });
    });
  });
}

/**
 * A sheet nothing could be taken from, with the extractor's own account of it: what this side saw,
 * how the process ended, and the tail of what the CLI said — a silent refusal tells an operator
 * nothing (R-SPINE-062's remedy is only actionable beside the reason).
 */
function refused(what: string, run: Run): IngestOutcome {
  const tail = run.stderr.trim().slice(-STDERR_TAIL_CHARS);
  const said = tail === "" ? "" : `\n${tail}`;
  return { ok: false, refusal: REFUSALS.SHEET_NOT_INGESTABLE.code, detail: `${what} (${run.ended})${said}` };
}
