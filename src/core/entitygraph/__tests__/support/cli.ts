/**
 * The seam the acceptance drives: the `cad/` CLI as a one-shot process (SEAM-CAD,
 * L-CAD-01), plus the EntityGraph v2 vocabulary written out as a type so the assertions
 * read as prose.
 *
 * Nothing here imports product source. The CLI is spawned exactly as the test contract
 * spells it — `uv run --frozen python -m cubit_cad ingest <path> --out <path>` with the
 * working directory at `cad/` — because a stateless one-shot process is what the seam is,
 * and an in-process import would prove a different thing.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The repository root; vitest runs with the tree as its working directory. */
export const REPO = process.cwd();

/** The lane the CLI is invoked from. Every command below runs with this as its cwd. */
export const CAD = join(REPO, 'cad');

/** Where the committed DXF fixtures live, relative to `cad/` and absolute. */
export const fixtureRel = (name: string): string => join('tests', 'fixtures', name);
export const fixtureAbs = (name: string): string => join(CAD, 'tests', 'fixtures', name);

/** Colour as the contract states it: a resolved rgb and the rule that resolved it. */
export interface Colour {
  readonly rgb: string;
  readonly source: string;
}

/** One EntityGraph entity — an original (with `key`) or derived paint (with `src`). */
export interface GraphEntity {
  readonly key?: string;
  readonly src?: string;
  readonly type: string;
  readonly layer: string;
  readonly space: string;
  readonly colour: Colour;
  readonly geometry: Record<string, unknown>;
  readonly closed?: boolean;
  readonly area?: number;
  readonly text?: string;
  readonly height?: number;
  readonly anchor?: readonly number[];
}

/** The per-layout fidelity counters R-TO-001 requires to be recorded. */
export interface LayoutCounters {
  readonly explode_truncated: boolean;
  readonly explode_losses: Record<string, number>;
  readonly flatten_capped: number;
  readonly strays_rejected: number;
}

/** EntityGraph v2, snake_case, exactly the vocabulary the test contract lists. */
export interface EntityGraph {
  readonly version: number;
  readonly ingest: {
    readonly extractor: {
      readonly name: string;
      readonly version: string;
      readonly parameter_set_hash: string;
    };
    readonly file_sha256: string;
  };
  readonly units: {
    readonly insunits_code: number;
    readonly unit: string | null;
    readonly insunits_unmapped: boolean;
  };
  readonly layouts: readonly {
    readonly name: string;
    readonly kind: string;
    readonly bbox: readonly number[];
  }[];
  readonly entities: readonly GraphEntity[];
  readonly derived: readonly GraphEntity[];
  readonly attributes: readonly { readonly src: string; readonly tag: string; readonly text: string }[];
  readonly counters: {
    readonly layouts_dropped: number;
    readonly per_layout: Record<string, LayoutCounters>;
  };
}

/** What a spawned command said for itself. */
export interface Ran {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  /** Everything both streams said, for a failure message that is worth reading. */
  readonly said: string;
}

function spawnInCad(args: readonly string[]): Ran {
  const result = spawnSync('uv', args, {
    cwd: CAD,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
    maxBuffer: 256 * 1024 * 1024,
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? (result.error === undefined ? '' : String(result.error.message));
  return { status: result.status, stdout, stderr, said: `${stdout}${stderr}` };
}

/**
 * `python -m cubit_cad ingest <input> --out <out>`, run from `cad/` under `uv run --frozen`.
 * `extra` carries the flags a refusal case needs (`--format dwg`).
 */
export function ingest(input: string, out: string, extra: readonly string[] = []): Ran {
  return spawnInCad([
    'run',
    '--frozen',
    'python',
    '-m',
    'cubit_cad',
    'ingest',
    input,
    '--out',
    out,
    ...extra,
  ]);
}

/** Any python, in the lane's frozen environment — used to read the installed ezdxf version. */
export function python(args: readonly string[]): Ran {
  return spawnInCad(['run', '--frozen', 'python', ...args]);
}

/** Any tool in the lane's frozen environment (pytest, ruff). */
export function uvRun(args: readonly string[]): Ran {
  return spawnInCad(['run', '--frozen', ...args]);
}

/** Read an artifact the CLI wrote. */
export function readGraph(path: string): EntityGraph {
  return JSON.parse(readFileSync(path, 'utf8')) as EntityGraph;
}

/** A throwaway directory for `--out` paths and rewritten fixtures. */
export function scratch(): { dir: string; dispose: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'cubit-cad-'));
  return { dir, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}

/** The handles an artifact's originals claim, in the `DXF_HANDLE:` scheme. */
export const KEY_PATTERN = /^DXF_HANDLE:([0-9A-Fa-f]+)$/;

/** The handle inside a source key, upper-cased, or null when the key is not well formed. */
export function handleOfKey(key: string | undefined): string | null {
  if (key === undefined) return null;
  const match = KEY_PATTERN.exec(key);
  return match?.[1]?.toUpperCase() ?? null;
}
