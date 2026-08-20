#!/usr/bin/env node
/**
 * pnpm dev | build | start — Next with the environment resolved first.
 *
 * `next` reads `.env`, and a fresh clone has none: the three commands go through
 * here so `.env.example`'s documented defaults stand in (scripts/lib/run.mjs).
 * The port is C-07's, overridable with PORT for a parallel lane.
 */
import { loadEnv, run } from './lib/run.mjs';

loadEnv();

const [command, ...rest] = process.argv.slice(2);
const port = process.env.PORT ?? '3210';

/**
 * A parallel lane runs on its own offset (C-07), and the auth base URL has to
 * name the port the server actually listens on: a mailed verification link that
 * points at another lane's port is a dead link, and a browser on this one would
 * be told its origin is untrusted. Only a loopback URL is ever rewritten — a
 * deployed BETTER_AUTH_URL names a host, not this machine.
 */
const base = new URL(process.env.BETTER_AUTH_URL);
if (['127.0.0.1', 'localhost'].includes(base.hostname) && base.port !== port) {
  base.port = port;
  process.env.BETTER_AUTH_URL = base.origin;
}

const args = command === 'build' ? ['build'] : [command, '--port', port];

process.exit(await run('pnpm', ['exec', 'next', ...args, ...rest]));
