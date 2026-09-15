// V-DOCS's own config (AM-18). It collects exactly the document lane's suites and nothing else: the
// lane renders through the pinned Typst subprocess and reads the artefacts back, which is a different
// kind of work from the unit lane's and deserves its own roster and its own budget.
//
// It is wired in by `scripts/docs-test.mjs`, which package.json names as `test:docs`. The globs are
// the checkout ROOT's, because the runner passes no `--dir` and the lane's support reaches the
// product by repo-relative path.
//
// The suites run in ONE process. Each compiles through the same subprocess and reads the same three
// vendored faces, and the faces are memoised per process (src/core/documents/fonts.ts) — so a lane
// split across workers would re-read and re-hash them once per worker for no answer it did not
// already have. There is no database here: a document is a function of its payload.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  root: ROOT,
  // The product spells its own layers through tsconfig's `@/` alias (ARCH-01); this lane is told it
  // here, as the unit and database lanes are.
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/docs/**/*.test.ts"],
    exclude: ["node_modules/**"],
    fileParallelism: false,
    // A cold render pays for the renderer's start-up and for subsetting three faces. Generous, and
    // asserted by nothing: this is a ceiling that stops a hung subprocess, not a budget (AM-10 §3).
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
