/**
 * Next (App Router) — the web lane's whole configuration (C-06, C-07).
 *
 * `distDir` is the one thing this file has to decide. V-VERIFY builds cold into its own
 * directory (`NEXT_DIST_DIR=.next-verify`) so that a verify run neither poisons nor is
 * poisoned by whatever `pnpm dev` left behind; every other caller gets `.next`.
 *
 * `agentRules` is the second: Next 16 writes its own guidance into the repository's CLAUDE.md
 * the first time `next dev` runs. That file is the engine's, maintained outside a build session
 * and reverted whenever a session touches it, so the generator is turned off rather than left
 * to append to a file this repository does not own here.
 */
import type { NextConfig } from 'next';

const config: NextConfig = {
  distDir: process.env['NEXT_DIST_DIR'] ?? '.next',
  agentRules: false,
};

export default config;
