/**
 * Small shared helpers for the script layer: .env loading, child processes and
 * the wall-clock reporting the gate prints.
 */
import { spawn } from 'node:child_process';
import { config as loadDotenv } from 'dotenv';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Where a machine's own secret lives: gitignored, per workspace, never shared. */
const LOCAL_ENV = new URL('../../.env.local', import.meta.url);

/** Which values were configured, and which the toolchain stood in for. */
const origins = new Map();

/**
 * Loads the environment, and remembers where each value came from.
 *
 * Three sources, in order: the environment and `.env` (what somebody
 * configured), `.env.local` (this machine's own generated values), then
 * `.env.example` for whatever is *still* unset — C-07's fixed local defaults,
 * the cluster on 127.0.0.1:5544 and the file mail transport, so the toolchain
 * runs out of the box. Nothing overrides a value that is already set.
 *
 * `.env.example` carries no signing secret, and this is why: a committed secret
 * that silently backfills is a deployment booting with session cookies signed by
 * a value anyone can read in the repository, and an unconfigured machine that
 * reports itself as configured. The secret is minted here instead — 32 random
 * bytes, written to the gitignored `.env.local` so every process in the lane
 * shares one and a restart does not sign every existing session out — and
 * `checkup` says plainly that it was minted rather than configured.
 */
export function loadEnv() {
  loadDotenv({ path: new URL('../../.env', import.meta.url), quiet: true });
  mark('environment');

  loadDotenv({ path: LOCAL_ENV, quiet: true });
  mark('local');

  loadDotenv({ path: new URL('../../.env.example', import.meta.url), quiet: true });
  mark('example');

  mintAuthSecret();
}

/** Records the origin of every name that has a value and no origin yet. */
function mark(origin) {
  for (const [name, value] of Object.entries(process.env)) {
    if (String(value ?? '').trim().length === 0) continue;
    if (!origins.has(name)) origins.set(name, origin);
  }
}

/** 'environment' | 'local' | 'example' | 'minted' | undefined for a name nothing set. */
export function envOrigin(name) {
  return origins.get(name);
}

function mintAuthSecret() {
  if (String(process.env.BETTER_AUTH_SECRET ?? '').trim().length > 0) return;

  const secret = randomBytes(32).toString('hex');
  process.env.BETTER_AUTH_SECRET = secret;
  origins.set('BETTER_AUTH_SECRET', 'minted');

  const file = fileURLToPath(LOCAL_ENV);
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (/^\s*BETTER_AUTH_SECRET=/m.test(existing)) return;
  const preamble = existing.length === 0 ? '# Generated per machine. Gitignored. Never a deployment secret.\n' : '';
  try {
    appendFileSync(file, `${preamble}BETTER_AUTH_SECRET=${secret}\n`);
  } catch {
    // a read-only workspace still runs: the secret lives for this process only,
    // which costs the lane its sessions on restart and nothing else
  }
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
