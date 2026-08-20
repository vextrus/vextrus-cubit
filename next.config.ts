import type { NextConfig } from 'next';

/**
 * C-06 — the toolchain is born in one increment. `distDir` is overridable so
 * verify's cold `next build` stage never fights the dev server's `.next`.
 */
const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  reactStrictMode: true,
  typedRoutes: false,
  // `next dev`/`next build` otherwise write AGENTS.md and CLAUDE.md into the
  // tree. Neither belongs to this increment, and a toolchain that dirties the
  // working tree on `pnpm dev` makes every drift check a lie.
  agentRules: false,
  /**
   * C-07 spells this machine `127.0.0.1`, and so does every link the file mail
   * transport writes. Next's dev server otherwise refuses its own chunks (403)
   * to any spelling of loopback but `localhost`, which leaves `pnpm dev` serving
   * markup that never comes alive. Both spellings name this process.
   */
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

export default nextConfig;
