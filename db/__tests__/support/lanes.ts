/**
 * Spawning a lane and reading its contract line (C-06), and copying the tree somewhere a
 * failure branch can be provoked without touching the repository.
 *
 * The contract lines are stdout only — the gate reports stderr after stdout, so a merged
 * capture is what a "final line" claim has to be read from (scripts/lib/lane.mjs says the
 * same thing from the other side).
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cpSync, mkdirSync, symlinkSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** The vitest root is the repository root: the V-DB config includes db/__tests__ from it. */
export const REPO = process.cwd();

/**
 * A test in this suite may spawn `pnpm test:db`, whose own suite is this one. The sentinel
 * says "you are already inside a spawned lane": the nested run does the live-database work
 * and skips the spawning, so the recursion is one level deep and terminates.
 */
export const NESTED = 'CUBIT_VERIFIER_NESTED';

export function isNested(): boolean {
  return (process.env[NESTED] ?? '') !== '';
}

export interface Ran {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  /** stdout then stderr, as a reader of the terminal would have seen it. */
  readonly merged: string;
}

export interface RunOptions {
  readonly cwd?: string;
  /** An entry whose value is undefined is removed from the child's environment. */
  readonly env?: Readonly<Record<string, string | undefined>>;
}

function childEnv(overrides: Readonly<Record<string, string | undefined>>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return env;
}

export function run(file: string, args: readonly string[], options: RunOptions = {}): Promise<Ran> {
  return new Promise<Ran>((resolve) => {
    const child = spawn(file, [...args], {
      cwd: options.cwd ?? REPO,
      env: childEnv(options.env ?? {}),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    // merged is kept in arrival order rather than stdout-then-stderr: a contract's "final
    // line of the merged output" is what a reader of the terminal saw last.
    let merged = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdout += text;
      merged += text;
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderr += text;
      merged += text;
    });
    child.on('error', (error: Error) =>
      resolve({
        code: -1,
        stdout,
        stderr: `${stderr}${error.message}`,
        merged: `${merged}${error.message}`,
      }),
    );
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr, merged }));
  });
}

/** `pnpm run <script>` — the lane as a developer and the gate both invoke it. */
export function lane(script: string, options: RunOptions = {}): Promise<Ran> {
  return run('pnpm', ['run', script], options);
}

export function lines(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => line.trim() !== '');
}

/** The last thing the lane said. A contract's "final line" is this line. */
export function lastLine(text: string): string {
  const all = lines(text);
  return all[all.length - 1] ?? '';
}

/** Everything a copy of the tree does not need, and must not carry. */
const NOT_COPIED = new Set([
  'node_modules',
  '.next',
  '.next-verify',
  '.scratch',
  'dist',
  'out',
  'coverage',
  'test-results',
  'playwright-report',
  '.builder-heldout',
]);

/**
 * The tree, copied to a literal /tmp path (TMPDIR is unset here, so a fallback that reads
 * it lands the copy back inside the repository). node_modules is linked rather than
 * copied: the copy runs the same pinned toolchain, it just runs it somewhere disposable.
 */
export function scratchTree(label: string): string {
  const destination = join('/tmp', 'cubit-verifier', `${label}-${randomUUID()}`);
  mkdirSync(destination, { recursive: true });
  cpSync(REPO, destination, {
    recursive: true,
    filter: (source: string) => {
      const rel = relative(REPO, source);
      if (rel === '') return true;
      return !NOT_COPIED.has(rel.split(sep)[0] ?? '');
    },
  });
  symlinkSync(join(REPO, 'node_modules'), join(destination, 'node_modules'));
  return destination;
}
