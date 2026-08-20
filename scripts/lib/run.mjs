/**
 * Small shared helpers for the script layer: .env loading, child processes and
 * the wall-clock reporting the gate prints.
 */
import { spawn } from 'node:child_process';
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Loads `.env` if there is one, then fills whatever is still unset from
 * `.env.example`. A fresh clone has no `.env`, and `.env.example` carries C-07's
 * fixed local defaults — the cluster on 127.0.0.1:5544, the file mail transport —
 * so the toolchain runs out of the box. Nothing here overrides an env var that is
 * already set, so a real `.env` and CI's exported variables both still win.
 */
export function loadEnv() {
  loadDotenv({ path: new URL('../../.env', import.meta.url), quiet: true });
  loadDotenv({ path: new URL('../../.env.example', import.meta.url), quiet: true });
}

/**
 * Runs a command, streaming its output. Resolves with the exit code.
 *
 * `mergeStderr` sends the child's stderr to *our stdout* instead of our stderr,
 * so a run that reports through both streams still emits one ordered stream. A
 * reader that captures the two separately and concatenates them — which is how
 * the gate reads `pnpm verify` — otherwise sees every warning a tool wrote to
 * stderr arrive after the summary line that is contractually last.
 */
export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: options.stdio ?? (options.mergeStderr === true ? ['ignore', 1, 1] : 'inherit'),
      env: { ...process.env, ...(options.env ?? {}) },
    });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

/** Runs a command and captures stdout; resolves `null` when the binary is absent. */
export function capture(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (chunk) => {
      out += String(chunk);
    });
    child.on('error', () => resolve(null));
    child.on('close', (code) => resolve(code === 0 ? out.trim() : null));
  });
}

export function seconds(startedAt) {
  return ((Date.now() - startedAt) / 1000).toFixed(1);
}

/** The same wall clock, in whole seconds — the shape V-VERIFY's summary names. */
export function wholeSeconds(startedAt) {
  return String(Math.round((Date.now() - startedAt) / 1000));
}
