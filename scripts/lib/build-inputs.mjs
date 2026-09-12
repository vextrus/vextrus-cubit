// What a Next build reads, for the one question `build-if-stale` asks: is the built output older
// than any of them? The roots are walked; these are named, because the walk skips every entry whose
// name starts with a dot and these sit at the tree's root rather than under one.
import { existsSync, readdirSync } from "node:fs";

/** The named inputs that are always inputs, whatever the tree carries beside them. */
const NAMED = ["next.config.ts", "package.json", "pnpm-lock.yaml", "tsconfig.json", "postcss.config.mjs", "tailwind.config.ts", "middleware.ts"];

/**
 * The build's inputs that are NAMED rather than walked. Every `.env*` file of the tree is one of
 * them: Next inlines `NEXT_PUBLIC_*` into the client bundle at BUILD time, so an edit to `.env.local`
 * changes the built product while touching nothing under `src/` — and build-if-stale served the
 * previous bundle to a journey written for the new value, which is a green that measured the wrong
 * product. The walk cannot find them: it skips every entry whose name starts with a dot, and these
 * sit at the root rather than under an input root.
 *
 * They are read from the directory rather than spelled, because a tree carries `.env`, `.env.local`,
 * `.env.test` and `.env.production` at once and a written list goes stale the day a fifth is added.
 *
 * @param {string} dir the tree's root
 * @returns {string[]} the named input files, every `.env*` present included
 */
export function inputFilesOf(dir) {
  const envs = existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.startsWith(".env"))
        .map((entry) => entry.name)
        .sort()
    : [];
  return [...NAMED, ...envs];
}
