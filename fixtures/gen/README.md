# Fixture generators

`pnpm gen:fixtures` regenerates the committed fixture corpora from the
generators in this directory. Increment zero ships the skeleton — the contract
every generator must meet — because the generators themselves belong to the
increments whose fixtures they produce (C-06, B-15).

## The contract

A generator is a `.mjs` module in this directory that default-exports:

```js
export default {
  /** Corpus name; also the directory it writes under fixtures/. */
  name: 'ledger',
  /** Everything that changes the output, hashed into the corpus manifest. */
  version: 1,
  /** Writes the corpus. Called with an absolute output directory. */
  async generate(outputDir) {},
};
```

Four properties the gate depends on:

1. **Deterministic.** Same generator version, same bytes. No `Date.now()`, no
   unseeded randomness, no map iteration order that depends on insertion by a
   hash. A generator seeds its own PRNG from a constant in its own source.
2. **Committed output.** The corpora are committed; `pnpm gen:fixtures` is a
   regeneration, not a build step. `git status --porcelain` is empty after a
   run, or the generator has drifted from its output and the gate says so.
3. **No network, no database.** A generator reads its own source and writes
   files. Nothing else.
4. **Decimal at the seam (B-07).** Money and quantities in a generated corpus
   are strings or integers of the smallest unit, never binary floats — a
   fixture that carries a float teaches the tests to accept one.

## Corpora the later increments will land here

- drawings — DWG/DXF inputs for the CAD ingest lane, with expected quantities.
- ledger — journal entries whose balance is known, for the ledger drift check.
- documents — payloads for each document type, for the schema tests.

Until one of them exists, `pnpm gen:fixtures` prints
`gen:fixtures: SKIP LANE_NOT_YET_BUILT` and exits 0.
