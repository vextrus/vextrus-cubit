// The server-spine acceptance suite's own config (the AC-1/AC-2/AC-3 lane).
//
// The root config collects `tests/**/*.test.ts`, so it runs these suites — but nothing in the tree
// governed `tests/server/` as a directory, which left the suite's shared helper
// (`support/wire.ts`, the one home for staging the product's declared modules and calling the
// shipped route handler — ARCH-02) collected by no config at all. This config is that governor:
// its globs resolve against its own directory, so `vitest run --config tests/server/vitest.config.ts`
// runs exactly this suite, helper included, the same way `db/__tests__/vitest.config.ts` governs
// the database lane.
//
// The environment stays node: the tier under test is a server tier and every file here observes it
// through fetch `Request`/`Response`. The component-rendering acceptance lives in tests/app and asks
// for jsdom with a `@vitest-environment` docblock, so nothing here pretends to be a browser.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // vitest resolves `include` against `root`, and `root` defaults to the working directory the
  // runner was launched from — not to the config's own directory. Naming it here is what keeps
  // this config scoped to its suite instead of re-collecting the whole tree's suites.
  root: dirname(fileURLToPath(import.meta.url)),
  // The product spells its own layers through tsconfig's `@/` alias (ARCH-01). This lane's root is
  // its own directory, so the alias has to be an absolute path to the repo's src/ — a relative one
  // would be resolved against tests/server and land outside the tree.
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
