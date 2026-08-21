/**
 * Next (App Router) — the web lane's whole configuration (C-06, C-07).
 *
 * `distDir` is the one thing this file has to decide. V-VERIFY builds cold into its own
 * directory (`NEXT_DIST_DIR=.next-verify`) so that a verify run neither poisons nor is
 * poisoned by whatever `pnpm dev` left behind; every other caller gets `.next`.
 */
import type { NextConfig } from 'next';

const config: NextConfig = {
  distDir: process.env['NEXT_DIST_DIR'] ?? '.next',
};

export default config;
