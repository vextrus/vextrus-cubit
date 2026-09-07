// The migration chain is one sequence, on disk and in the journal alike (V-VERIFY, B-05). drizzle-kit
// numbers a new migration from the journal alone and overwrites a same-numbered snapshot without a
// word (drizzle-orm issue 5774), so two branches that each generated 00NN from one fork point can land
// a chain whose disk and journal disagree. This lane refuses that tree: every `NNNN_*.sql` number
// is unique, the journal's idx list is exactly the disk's numbers, each entry has its snapshot, and
// the journal's last idx is the disk's maximum. The builder engine regenerates a branch's migration
// on the combined schema at integration (scripts/db-regenerate-migration.mjs); this is the belt.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const MIGRATIONS = join(REPO_ROOT, "db", "migrations");
const META = join(MIGRATIONS, "meta");

interface JournalEntry {
  idx: number;
  tag: string;
}

describe("the migration chain is one sequence (V-VERIFY)", () => {
  const sql = existsSync(MIGRATIONS) ? readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort() : [];
  const journal = existsSync(join(META, "_journal.json")) ? (JSON.parse(readFileSync(join(META, "_journal.json"), "utf8")) as { entries: JournalEntry[] }) : null;

  test("every migration file carries a unique four-digit number", () => {
    const numbers = sql.map((f) => /^(\d{4})_/.exec(f)?.[1]).map((n) => (n === undefined ? null : Number(n)));
    expect(numbers.every((n) => n !== null), `unnumbered migration file among ${sql.join(", ")}`).toBe(true);
    expect(new Set(numbers).size, `duplicate migration numbers among ${sql.join(", ")}`).toBe(numbers.length);
  });

  test("the journal's idx list is exactly the disk's numbers, in order, each with its snapshot", () => {
    if (!journal) {
      expect(sql, "migration files without a journal").toEqual([]);
      return;
    }
    const disk = sql.map((f) => Number(/^(\d{4})_/.exec(f)?.[1] ?? -1));
    const idx = journal.entries.map((e) => Number(e.idx));
    expect(idx, "the journal and the disk name different sequences").toEqual(disk);
    for (const e of journal.entries) {
      expect(sql, `journal entry ${e.idx} names ${e.tag}, which is not on disk`).toContain(`${e.tag}.sql`);
      expect(existsSync(join(META, `${String(e.idx).padStart(4, "0")}_snapshot.json`)), `no snapshot for ${e.tag}`).toBe(true);
    }
    const last = journal.entries.at(-1);
    expect(last === undefined ? -1 : Number(last.idx)).toBe(Math.max(-1, ...disk));
  });
});
