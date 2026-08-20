/**
 * Runs once before vitest's files, in both lanes (vitest.config.ts).
 *
 * Two tests ask git what this workspace holds rather than trusting a glob: the
 * refusal register walks `git ls-files` for the corpus it searches (Q-07), and
 * the migration ledger walks `git log` for the history it forbids rewriting
 * (AC-08). A workspace exported without its `.git` — a copy, a tarball, an
 * unpacked artefact — has no answer to give: git exits non-zero and the stage
 * fails for a reason that says nothing about the code.
 *
 * So when the tree is not a checkout, a repository is initialised over it and
 * the files that are here are staged: `git ls-files` then lists exactly this
 * tree. Nothing is committed. History is not ours to invent, and a test that
 * reads history must still meet the truth — an empty history is not a passing
 * one, and it will say so.
 *
 * In a checkout, and that is every normal run, this does nothing at all.
 */
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/run.mjs';

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export default function setup() {
  try {
    git(['rev-parse', '--git-dir']);
    return;
  } catch {
    // not a checkout — below
  }

  try {
    git(['init', '-q']);
    // .gitignore is part of the export, so node_modules and the distDirs stay out
    git(['add', '-A']);
  } catch {
    // no git on this machine either; the tests that need it report it themselves
  }
}
