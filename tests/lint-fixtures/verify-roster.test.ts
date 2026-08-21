/**
 * AC-1 / C-06 — the roster this repository actually arms.
 *
 * verify's fourth stage is `vitest run`, so no test can run the repository's
 * own verify: it would run itself. The grammar of the contract is proved
 * against a copy of scripts/ under $TMPDIR with a stub executable where every
 * stage command would be — and a stub tree cannot tell an armed roster from a
 * mis-declared one, because in it every binary exists and exits 0.
 *
 * This file closes that gap without executing a stage. The roster verify runs
 * is data (scripts/lib/roster.mjs); the arming rule is a function over this
 * tree (scripts/lib/lane.mjs). Both are read here against the real repository:
 * which stages this tree arms, whether the commands they arm exist in
 * node_modules/.bin, and that the rule answers to a directory rather than to
 * any file that happens to carry the name.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { hasInput } from '../../scripts/lib/lane.mjs';
import { ROSTER } from '../../scripts/lib/roster.mjs';

const ROOT = process.cwd();

/** The stage roster, in the fixed order the test contract states. */
const STAGE_ROSTER = [
  'typegen',
  'tsc',
  'eslint',
  'vitest',
  'db-drift',
  'method-hashes',
  'catalogue-drift',
  'cad-ruff',
  'cad-pytest',
  'build',
] as const;

/** Armed in this increment; the rest have no input root yet. */
const ARMED_STAGES = ['tsc', 'eslint', 'vitest', 'cad-ruff'] as const;

describe('AC-1 the roster this repository arms', () => {
  const armed = ROSTER.filter((stage) => stage.input === null || hasInput(stage.input));

  it('AC-1: the roster verify runs is the contract roster, in order', () => {
    expect(ROSTER.map((stage) => stage.name)).toEqual([...STAGE_ROSTER]);
  });

  it('AC-1: in this tree exactly tsc, eslint, vitest and cad-ruff are armed', () => {
    expect(
      armed.map((stage) => stage.name),
      'the arming rule read against the real tree, not a stub of it',
    ).toEqual([...ARMED_STAGES]);
  });

  it('AC-1: every stage this tree arms has a command that exists to run', () => {
    const missing = armed
      .filter((stage) => {
        const command = stage.command;
        if (command === null) {
          return true;
        }
        const [file] = command;
        // `uv` is resolved from PATH by design — the cad lane is uv's own.
        // Everything else is an absolute path into this tree's node_modules.
        return path.isAbsolute(file) && !existsSync(file);
      })
      .map((stage) => stage.name);
    expect(
      missing,
      'an armed stage with no command on disk is a FAIL no stub tree can show',
    ).toEqual([]);
  });

  it('C-06: no stage skips while its input root is present', () => {
    const silent = ROSTER.filter((stage) => stage.input !== null && hasInput(stage.input))
      .filter((stage) => !(ARMED_STAGES as readonly string[]).includes(stage.name))
      .map((stage) => stage.name);
    expect(silent, 'a stage skipping with its input root present is a silent pass').toEqual([]);
  });

  it('AC-1: the cad lane runs where cad/ is', () => {
    const cadRuff = ROSTER.find((stage) => stage.name === 'cad-ruff');
    expect(cadRuff?.cwd, 'cad-ruff must run inside cad/').toBe(path.join(ROOT, 'cad'));
    expect(existsSync(path.join(ROOT, 'cad', 'pyproject.toml'))).toBe(true);
  });
});

describe('C-06 an input root is a directory, not a name', () => {
  it('C-06: a plain file of the same name arms nothing', () => {
    // A stray `src/app` file — a note, an editor's leftover — is not the lane's
    // input. Arming typegen and build on one would report FAIL for a tree that
    // has nothing to check. package.json stands in for it: a file that exists,
    // at a path no stage may ever be armed by.
    expect(existsSync(path.join(ROOT, 'package.json')), 'the probe needs a real file').toBe(true);
    expect(hasInput('package.json'), 'a file is not an input root').toBe(false);
  });

  it('C-06: a directory that exists arms, and an absent one does not', () => {
    expect(hasInput('scripts'), 'scripts/ is a directory in this tree').toBe(true);
    expect(hasInput('src/app'), 'src/app is a later increment (AM-02)').toBe(false);
  });
});
