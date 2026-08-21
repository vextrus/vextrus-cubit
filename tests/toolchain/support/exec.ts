/**
 * Test support for the inc-000 toolchain acceptance.
 *
 * The toolchain's contract is a set of commands and the lines they print on
 * stdout, so the acceptance has to run processes rather than import modules.
 * Nothing here knows how a script is implemented — only how it is invoked.
 */
import { spawn } from 'node:child_process';

export interface RunResult {
  /** Exit code; -1 when the child was killed without one. */
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  /** True when the child outlived its timeout and was killed. */
  readonly timedOut: boolean;
  readonly elapsedMs: number;
}

export interface RunOptions {
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly env?: NodeJS.ProcessEnv;
  /** Emulates `2>/dev/null`: the child's stderr is thrown away, not captured. */
  readonly discardStderr?: boolean;
}

const DEFAULT_TIMEOUT_MS = 120_000;

export function run(
  command: string,
  args: readonly string[],
  options: RunOptions,
): Promise<RunResult> {
  return new Promise<RunResult>((resolve, reject) => {
    const startedAt = Date.now();
    const discard = options.discardStderr === true;
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', discard ? 'ignore' : 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.on('error', (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      resolve({
        code: code ?? -1,
        stdout,
        stderr,
        timedOut,
        elapsedMs: Date.now() - startedAt,
      });
    });
  });
}

/** Splits captured output into lines, dropping the trailing empty line. */
export function lines(text: string): readonly string[] {
  return text.split(/\r?\n/).filter((line) => line.length > 0);
}

/** A run's whole output, for failure messages that are worth reading. */
export function transcript(label: string, result: RunResult): string {
  return [
    `${label} exited ${result.code}${result.timedOut ? ' (killed on timeout)' : ''}`,
    '--- stdout ---',
    result.stdout,
    '--- stderr ---',
    result.stderr,
  ].join('\n');
}
