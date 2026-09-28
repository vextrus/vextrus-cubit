/*
 * The test-only pseudo right-to-left language's tag, alone in its own file so the development-only
 * specimen can name it without statically importing pseudo.ts, and so the market-literal scan's
 * allowlist names one file. `en-XB` is the pseudo-bidi tag Android and Chromium use for the same job.
 * Never shipped: `npm run build` fails if the tag reaches the production bundle (scripts/check-dist.mjs).
 */
export const PSEUDO_RTL_CODE = 'en-XB'
