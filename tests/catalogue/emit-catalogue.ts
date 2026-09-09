// L-MEA-04's catalogue is TS consts "emitted as tables by migration with a drift stage". This is the
// hand that writes what `src/core/catalogue/emit.ts` renders: run it after changing a const, and
// commit what it writes.
//
//   pnpm tsx tests/catalogue/emit-catalogue.ts
//
// It stands outside `src/**` on purpose (ARCH-01, ARCH-02): writing a committed artefact is a
// maintenance tool, and a tool needs the file system, the repo's own path and the toolchain's digest
// function — none of which belongs in a layer a client can reach. The layered half stays pure and
// renders; this half writes. The rendering is not repeated here, so the consts, the committed tables
// and the migrated rows still have one source between them (B-17).
//
// Nothing imports this file: it is invoked, and running it is its whole purpose.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOGUE_DIGEST_FILE, CATALOGUE_DIR, CATALOGUE_FILES, emittedTables } from "@/core/catalogue/emit";
import { digestOf, filesUnder } from "../../scripts/lib/digest.mjs";

/** The checkout the tables are committed in — two directories up from this file. */
const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/**
 * Write the tables and record their digest. The digest is the toolchain's one digest function over
 * every file under `db/catalogue` but the record itself (ARCH-02, B-17), which is exactly what
 * `scripts/catalogue-drift.mjs` re-takes at the gate — so a catalogue written here and a catalogue
 * read there cannot disagree about what its bytes hash to.
 */
function writeCatalogue(): readonly string[] {
  const tables = emittedTables();
  const written: string[] = [];
  mkdirSync(resolve(REPO_ROOT, CATALOGUE_DIR), { recursive: true });
  for (const file of CATALOGUE_FILES) {
    writeFileSync(resolve(REPO_ROOT, CATALOGUE_DIR, file), tables[file], "utf8");
    written.push(`${CATALOGUE_DIR}/${file}`);
  }
  const sources = filesUnder(REPO_ROOT, resolve(REPO_ROOT, CATALOGUE_DIR), (relative) => relative !== CATALOGUE_DIGEST_FILE);
  writeFileSync(resolve(REPO_ROOT, CATALOGUE_DIGEST_FILE), `${digestOf(REPO_ROOT, sources)}\n`, "utf8");
  return [...written, CATALOGUE_DIGEST_FILE];
}

for (const file of writeCatalogue()) process.stdout.write(`catalogue: wrote ${file}\n`);
