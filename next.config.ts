/**
 * Next's build, told where to put its output and nothing else (C-06, C-07).
 *
 * `distDir` is read from NEXT_DIST_DIR because three lanes build this tree for different
 * reasons and none of them may consume another's output: `pnpm verify` builds cold into
 * `.next-verify` (scripts/lib/verify-roster.mjs sets the variable, and its comment names
 * this increment as the one that has to honour it), `pnpm e2e` builds into `.next-e2e` and
 * serves that build on 3211, and a developer's `next dev` keeps `.next`. All three are
 * gitignored, so no lane's build can dirty the checkout.
 *
 * Nothing is imported from `next` here on purpose: `next`'s global.d.ts augments
 * NodeJS.ProcessEnv with a *required* NODE_ENV, and one type-only import of it would put
 * that augmentation into every file tsc reads.
 */
const config = {
  distDir: process.env['NEXT_DIST_DIR'] ?? '.next',
};

export default config;
