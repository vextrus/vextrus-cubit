// Breaker acceptance — the one-shot CLI contract under drawings the committed corpus does not hold.
//
// The test contract fixes two things about an `ingest` invocation, and this file grades both against
// drawings written here rather than committed: a run either succeeds, in which case what it wrote is
// an EntityGraph (L-CAD-05: the artifact is the only thing carrying the contract across the seam, so
// a written artifact its own mirror refuses is a broken hand-off), or it refuses, in which case the
// failure is loud in the shape L-CAD-04 names — the drawing named on stderr and `--out` untouched.
//
// A Python traceback is neither: it exits non-zero without naming the drawing, so nothing downstream
// can say which sheet was refused.
//
// The drawings are written here for the reason `FLATTEN_CAP_TRIP_DXF` is written in the support
// module: nothing in the contract obliges the committed corpus to contain a hostile drawing, and a
// rule that only fires on a lucky fixture is a rule nothing checks.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { entityGraphSchema } from "../../src/core/entitygraph/schema";
import { requireCadPackage, runIngest, type SpawnOutcome } from "./support/artifact";

const scratchDirs: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "cubit-cad-breaker-"));
  scratchDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

/** A minimal R12 drawing carrying `body` as its ENTITIES section — the same hand-authored form the
 *  support module's cap-trip drawing uses, which `ezdxf.readfile` opens without complaint. */
function r12(body: readonly string[]): string {
  return [
    "0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    ...body,
    "0", "ENDSEC", "0", "EOF", "",
  ].join("\n");
}

/** A closed POLYLINE ring whose vertices sit at 1e200 — every coordinate finite and lawful, and no
 *  larger than the `1e+20` the committed corpus already spells in its own header. */
const HUGE_RING_DXF = r12([
  "0", "POLYLINE", "5", "C1", "8", "0", "66", "1", "70", "1",
  "10", "0.0", "20", "0.0", "30", "0.0",
  "0", "VERTEX", "5", "D0", "8", "0", "10", "0.0", "20", "0.0", "30", "0.0",
  "0", "VERTEX", "5", "D1", "8", "0", "10", "1e200", "20", "0.0", "30", "0.0",
  "0", "VERTEX", "5", "D2", "8", "0", "10", "1e200", "20", "1e200", "30", "0.0",
  "0", "VERTEX", "5", "D3", "8", "0", "10", "0.0", "20", "1e200", "30", "0.0",
  "0", "SEQEND", "5", "E1", "8", "0",
]);

/** A LINE whose end point overflows to infinity when the file's text is read as a float — the shape
 *  a broken exporter writes, and one `ezdxf.readfile` accepts. */
const INFINITE_COORDINATE_DXF = r12([
  "0", "LINE", "5", "1A", "8", "0",
  "10", "0.0", "20", "0.0", "30", "0.0",
  "11", "1e400", "21", "0.0", "31", "0.0",
]);

/** Two entities sharing one handle. DXF handles are meant to be unique and ezdxf says so on stderr
 *  ("Found non-unique entity handle") while still reading the drawing — so the extractor mints one
 *  source key twice, which is exactly what L-CAD-02 says a key may not be. */
const DUPLICATE_HANDLE_DXF = r12([
  "0", "LINE", "5", "A1", "8", "0",
  "10", "0.0", "20", "0.0", "30", "0.0", "11", "1.0", "21", "1.0", "31", "0.0",
  "0", "LINE", "5", "A1", "8", "0",
  "10", "2.0", "20", "2.0", "30", "0.0", "11", "3.0", "21", "3.0", "31", "0.0",
]);

interface Staged {
  readonly input: string;
  readonly out: string;
}

function stage(name: string, dxf: string): Staged {
  const dir = scratch();
  const input = join(dir, `${name}.dxf`);
  writeFileSync(input, dxf, "utf8");
  return { input, out: join(dir, `${name}.entitygraph.json`) };
}

/**
 * The contract, as the test contract states it, for any drawing at all: exit 0 means an artifact was
 * written and it is an EntityGraph; anything else means the drawing was named on stderr and `--out`
 * was left untouched. One of the two must hold — there is no third outcome the contract allows.
 */
function gradeOutcome(run: SpawnOutcome, staged: Staged, what: string): void {
  if (run.status === 0) {
    expect(existsSync(staged.out), `${what}: ingest exited 0 without writing --out`).toBe(true);
    const parsed = entityGraphSchema.safeParse(JSON.parse(readFileSync(staged.out, "utf8")));
    expect(
      parsed.success,
      `${what}: ingest exited 0 but wrote an artifact the shipped Zod mirror refuses — ` +
        `${parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))}`,
    ).toBe(true);
    return;
  }
  expect(
    run.stderr.includes(staged.input),
    `${what}: ingest exited ${run.status} without naming the drawing on stderr (L-CAD-04)\n${run.stderr}`,
  ).toBe(true);
  expect(existsSync(staged.out), `${what}: a refused ingest wrote to --out`).toBe(false);
}

describe("breaker: the ingest contract under hostile drawings", () => {
  it("a lawful drawing whose shoelace area overflows is either ingested or refused by name", () => {
    requireCadPackage();
    const staged = stage("huge-ring", HUGE_RING_DXF);
    gradeOutcome(runIngest(staged.input, staged.out), staged, "a closed ring at 1e200");
  }, 600_000);

  it("a drawing carrying a non-finite coordinate is refused by name, not by stack trace", () => {
    requireCadPackage();
    const staged = stage("infinite-coordinate", INFINITE_COORDINATE_DXF);
    gradeOutcome(runIngest(staged.input, staged.out), staged, "a LINE ending at 1e400");
  }, 600_000);

  it("an ingest that exits 0 never writes an artifact the shipped mirror refuses", () => {
    requireCadPackage();
    const staged = stage("duplicate-handle", DUPLICATE_HANDLE_DXF);
    gradeOutcome(runIngest(staged.input, staged.out), staged, "two entities sharing one handle");
  }, 600_000);
});
