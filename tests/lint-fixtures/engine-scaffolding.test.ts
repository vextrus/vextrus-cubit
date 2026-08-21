/**
 * The ownership boundary, made mechanical: a change may not destroy engine-maintained
 * scaffolding (B-05, C-06).
 *
 * Every other guardrail in this suite judges what the increment ADDS — a rule fires, a
 * fixture is confined, a pin is exact. None of them judge what a change REMOVES outside
 * the paths the increment owns, and that gap is not theoretical: a whole file of
 * engine-maintained session notes was deleted on this branch and passed `pnpm verify`,
 * `pnpm checkup`, the fixture suite and the structural diff without a single red line.
 * B-05 is explicit that prose is not enforcement, so the boundary gets a check.
 *
 * The rule, stated rather than snapshotted (no list of today's filenames — a frozen list
 * goes red the moment the engine adds a file, and green for every file it has not yet
 * added):
 *
 *   a file whose own text declares it engine-maintained, and which some reachable commit
 *   deleted, must be present in the tree today.
 *
 * The declaration is the file's; the history is git's; nothing here has to be kept in
 * step by hand. A deletion is read from the commit that made it and the verdict is put to
 * the index (`git ls-files`), so a restoration counts the moment it is staged. Rename
 * detection is turned off (`--no-renames`) so that a move reads as a deletion —
 * deliberately: the engine names its own scaffolding, and a build session that moves it is
 * exactly the event to stop. With git's default rename detection a `git mv` is reported as
 * an R and filtered out by `--diff-filter=D`, which is the opposite of what this check is for.
 *
 * The claim is about history, so a checkout that does not carry the history cannot answer
 * it. A shallow clone does not error — `git log` simply reports no deletions — so the
 * truncation is detected outright and fails the test loudly rather than passing vacuously.
 * CI checks out with `fetch-depth: 0` for this reason.
 */
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();

const git = (args: string[]): string =>
  execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/** The self-declaration an engine-maintained file carries in its own header. */
const MARKER = new RegExp(['maintained', 'by', 'the', 'Vextrus', 'Builder', 'engine'].join('\\s+'), 'i');

type Deletion = { readonly commit: string; readonly path: string };

/**
 * Every path any reachable commit deleted, paired with the commit that deleted it. Null
 * when this checkout cannot answer — no `.git`, an export without history, or a truncated
 * one (a shallow clone, whose `git log` succeeds and reports nothing at all). The caller
 * fails on that rather than vouching for a claim it never checked.
 */
function deletions(): Deletion[] | null {
  let log: string;
  try {
    // A shallow checkout answers "no deletions" to every question, so it is not an answer.
    if (git(['rev-parse', '--is-shallow-repository']).trim() !== 'false') return null;
    // --no-renames: a move must read as a deletion, which is the event this check exists for.
    log = git(['log', '--diff-filter=D', '--no-renames', '--name-only', '--format=%x00%H', 'HEAD']);
  } catch {
    return null;
  }
  const found: Deletion[] = [];
  let commit = '';
  for (const line of log.split('\n')) {
    if (line.startsWith('\0')) {
      commit = line.slice(1).trim();
      continue;
    }
    const path = line.trim();
    if (path !== '' && commit !== '') found.push({ commit, path });
  }
  return found;
}

/** The file's content as it stood immediately before the deletion; null when unreadable. */
function contentBeforeDeletion(deletion: Deletion): string | null {
  try {
    return git(['show', `${deletion.commit}^:${deletion.path}`]);
  } catch {
    return null;
  }
}

const tracked = (path: string): boolean => {
  try {
    return git(['ls-files', '--', path]).trim() !== '';
  } catch {
    return false;
  }
};

describe('inc-000 — the ownership boundary holds (B-05, C-06)', () => {
  it('B-05: no change destroys a file that declares itself engine-maintained', () => {
    const removed = deletions();
    expect(
      removed,
      'the boundary is a claim about history — it must be reachable, and a shallow clone cannot reach it (check out with fetch-depth: 0)',
    ).not.toBeNull();
    if (removed === null) throw new Error('unreachable: the assertion above already failed');

    const destroyed = removed
      .filter((deletion) => {
        const before = contentBeforeDeletion(deletion);
        return before !== null && MARKER.test(before);
      })
      .filter((deletion) => !tracked(deletion.path))
      .map((deletion) => `${deletion.path} (deleted in ${deletion.commit.slice(0, 8)})`);

    expect(
      [...new Set(destroyed)],
      'an engine-maintained file was deleted and never put back; restore it from the base',
    ).toEqual([]);
  });
});
