/**
 * AC-3 (second half) — `pnpm db:drift` is a real lane (V-VERIFY, C-06).
 *
 * Drift is a comparison, not a generation: the lane is only worth having if it goes red
 * when db/schema and db/migrations disagree, and leaves the tree exactly as it found it
 * when they agree. Both halves are asserted here — the green one against the repository,
 * the red one against a copy under /tmp whose history has been walked back one migration.
 */
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, lane, lastLine, lines, run, scratchTree } from './support/lanes';

async function porcelain(cwd: string = REPO): Promise<string> {
  const ran = await run('git', ['status', '--porcelain'], { cwd });
  return ran.stdout;
}

describe('AC-3 — the drift lane (V-VERIFY)', () => {
  it('AC-3: `pnpm db:drift` prints `db:drift: ok`, exits 0 and leaves the tree untouched', async () => {
    const before = await porcelain();
    const ran = await lane('db:drift');
    expect(ran.code, `db:drift exited ${ran.code}\n${ran.merged}`).toBe(0);
    expect(lastLine(ran.stdout).startsWith('db:drift: ok'), ran.merged).toBe(true);

    const after = await porcelain();
    // "drizzle-kit generate into scratch, tree untouched": on the gate's clean checkout
    // this reading is empty, and it is identical either way — the lane writes nothing that
    // git can see, least of all into db/.
    expect(after, 'db:drift changed the working tree').toBe(before);
    const appeared = lines(after).filter((line) => !lines(before).includes(line));
    expect(appeared, 'db:drift left new entries in the working tree').toEqual([]);
  });

  it('AC-3: a tree whose schema and migrations disagree is `db:drift: FAIL DRIFT`, exit 1', async () => {
    const copy = scratchTree('schema-drift');
    const journalPath = join(copy, 'db', 'migrations', 'meta', '_journal.json');
    expect(existsSync(journalPath), 'the copy has no migration journal').toBe(true);

    // Walk the history back one step and leave db/schema whole: the schema is now ahead of
    // the migrations, which is the disagreement the lane exists to report.
    const parsed = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries?: { idx?: unknown; tag?: unknown }[];
    };
    const entries = parsed.entries ?? [];
    const last = entries[entries.length - 1];
    expect(last, 'the copy has no journalled migration to remove').toBeDefined();
    if (last === undefined) return;
    writeFileSync(
      journalPath,
      JSON.stringify({ ...parsed, entries: entries.slice(0, -1) }, null, 2),
    );
    rmSync(join(copy, 'db', 'migrations', `${String(last.tag)}.sql`), { force: true });
    const meta = join(copy, 'db', 'migrations', 'meta');
    for (const name of readdirSync(meta)) {
      if (name.endsWith('_snapshot.json') && name.startsWith(String(last.idx).padStart(4, '0'))) {
        rmSync(join(meta, name), { force: true });
      }
    }

    const ran = await lane('db:drift', { cwd: copy });
    expect(ran.code, `db:drift stayed green on a divergent tree\n${ran.merged}`).toBe(1);
    expect(
      lines(ran.stdout).some((line) => line.startsWith('db:drift: FAIL DRIFT')),
      `db:drift did not report DRIFT on stdout\n${ran.merged}`,
    ).toBe(true);
  });
});
