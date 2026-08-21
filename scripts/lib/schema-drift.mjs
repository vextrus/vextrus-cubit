/**
 * V-VERIFY's "schema drift (`drizzle-kit generate` into scratch, tree untouched)".
 *
 * Drift is a comparison, not a generation. `drizzle-kit generate` into an empty directory
 * always writes a full initial migration and exits 0 — armed that way the stage would go
 * green while asserting nothing, which is exactly what C-06 calls silently passed. So the
 * committed migrations (journal included) are copied into the cold scratch directory
 * first: drizzle-kit then sees the history it has to catch up with, and any SQL it writes
 * on top of that history is the drift. Every write lands under `.scratch`, which is
 * gitignored, so the tree is untouched either way.
 *
 * The repo root is a parameter so the check can be run against a tree that has a schema in
 * it, which this increment deliberately does not.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Every migration file already written, by path relative to the directory. */
function sqlFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

export function checkSchemaDrift(repo) {
  const scratch = join(repo, '.scratch', 'db-drift');
  const migrations = join(repo, 'db', 'migrations');

  rmSync(scratch, { recursive: true, force: true });
  if (existsSync(migrations)) {
    cpSync(migrations, scratch, { recursive: true });
  } else {
    mkdirSync(scratch, { recursive: true });
  }
  const before = new Set(sqlFiles(scratch));

  // drizzle-kit refuses `--config` alongside any other option, so the redirection is made
  // in a scratch config that re-exports the real one with `out` pointed at the copy. The
  // committed drizzle.config.ts stays the single statement of dialect, schema and
  // credentials — this file only says where to write.
  const configPath = join(repo, '.scratch', 'db-drift.config.ts');
  writeFileSync(
    configPath,
    "import base from '../drizzle.config.ts';\n" +
      `export default { ...base, out: ${JSON.stringify(relative(repo, scratch))} };\n`,
  );

  const generated = spawnSync(
    join(repo, 'node_modules', '.bin', 'drizzle-kit'),
    ['generate', '--config', relative(repo, configPath)],
    {
      cwd: repo,
      env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (generated.error !== undefined) {
    return { ok: false, output: `db-drift: drizzle-kit — ${generated.error.message}` };
  }
  const output = `${generated.stdout ?? ''}${generated.stderr ?? ''}`;
  if (generated.status !== 0) return { ok: false, output };

  const added = sqlFiles(scratch).filter((name) => !before.has(name));
  if (added.length === 0) return { ok: true, output };
  return {
    ok: false,
    output:
      `${output}\ndb-drift: db/schema is ahead of db/migrations — drizzle-kit wrote ` +
      `${added.join(', ')} on top of the committed history. Commit the migration the ` +
      `schema change needs; the scratch copy is thrown away.`,
  };
}
