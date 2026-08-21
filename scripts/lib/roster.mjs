/**
 * V-VERIFY's stage roster — the data half of scripts/verify.mjs.
 *
 * It lives in its own module for one reason: verify.mjs runs the roster the
 * moment it is loaded, so nothing can read the roster of the *real* tree
 * without also running the gate inside itself. As data it can be asserted
 * against this repository — the names, their order, and which stages the
 * arming rule lights up here — while verify.mjs stays the one thing that
 * executes it.
 */
import { at } from './lane.mjs';

/**
 * node_modules/.bin/<name>, so no stage pays pnpm's start-up twice.
 *
 * @param {string} name
 */
const bin = (name) => at(`node_modules/.bin/${name}`);

/**
 * The roster, in the order V-VERIFY states it.
 *
 * `input` is the directory whose absence skips the stage; `null` means the
 * stage is armed in every tree. `command` is the argv the stage runs once it
 * is armed — `null` marks a stage whose command arrives with the increment
 * that lands its input, and being armed without one is a failure, never a
 * silent pass.
 *
 * @type {ReadonlyArray<{
 *   name: string,
 *   input: string | null,
 *   command: readonly [string, readonly string[]] | null,
 *   cwd?: string,
 * }>}
 */
export const ROSTER = [
  { name: 'typegen', input: 'src/app', command: [bin('next'), ['typegen']] },
  { name: 'tsc', input: null, command: [bin('tsc'), ['--noEmit']] },
  { name: 'eslint', input: null, command: [bin('eslint'), ['.']] },
  { name: 'vitest', input: null, command: [bin('vitest'), ['run']] },
  // The three stages below have no command yet, and a command is not something
  // that can be written in advance of the thing it checks:
  //
  //   db-drift        V-VERIFY's check is "generate into scratch and compare
  //                   against the committed migrations". `drizzle-kit generate`
  //                   into an empty scratch --out has no journal to compare
  //                   with, regenerates the whole schema and exits 0 either
  //                   way, so it would answer `ok` for a drifted tree.
  //   method-hashes   the manifest is a file that does not exist; scripts/
  //                   method-hashes.mjs is the skeleton C-06 asks for.
  //   catalogue-drift there is no catalogue table to drift from.
  //
  // Each one is armed by its input root all the same, so the increment that
  // lands the input meets a loud failure with a recorded reason rather than a
  // green light nobody earned (C-06: never silently passed).
  { name: 'db-drift', input: 'db/schema', command: null },
  { name: 'method-hashes', input: 'src/core/methods', command: null },
  { name: 'catalogue-drift', input: 'src/core/catalogue', command: null },
  {
    name: 'cad-ruff',
    input: null,
    command: ['uv', ['run', '--frozen', 'ruff', 'check', '.']],
    cwd: at('cad'),
  },
  {
    name: 'cad-pytest',
    input: 'cad/tests',
    command: ['uv', ['run', '--frozen', 'pytest', '-q']],
    cwd: at('cad'),
  },
  {
    name: 'build',
    input: 'src/app',
    // V-VERIFY wants a cold build into a distDir of its own, never the dev
    // server's `.next`. Next reads `distDir` from next.config and from nowhere
    // else — there is no CLI flag for it and no environment variable — so this
    // command belongs to the increment that lands src/app and its next.config,
    // where `distDir: '.next-verify'` can actually be written. Until then the
    // stage stays unwired rather than wired to a build that stomps `.next`.
    command: null,
  },
];
