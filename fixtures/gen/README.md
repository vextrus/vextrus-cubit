# Fixture generators — skeleton

C-06 delivers the generators' skeleton with the toolchain; each generator arrives with the
increment whose data it generates. `pnpm gen:fixtures` runs them all and announces the
unbuilt lane until the first one lands.

## The contract every generator keeps

1. **Deterministic.** Same inputs, byte-identical outputs. No clock, no random seed that is
   not itself a committed input, no locale-dependent formatting (L-FMT-01). A generator that
   is re-run on a fresh clone leaves `git status --porcelain` empty.
2. **Generated, never hand-edited.** The generator is the source; its output is committed so
   the suite is readable in review and offline, and regenerating is the only way to change it.
   A hand-edit is a drift the next run silently reverts.
3. **One directory per corpus**, named for what it holds, with a `README.md` stating what the
   corpus proves and which clause requires it.
4. **Regeneration is a declared act.** Q-08: a regenerated fixture in a change needs a
   recorded reason, because "the golden output moved" and "the formula broke" look identical
   in a diff.

## The corpora the Bible calls for

| Corpus | Holds | Arrives with |
| --- | --- | --- |
| `golden/` | golden vectors for every measurement method — inputs, expected quantity, the method hash they were computed under | the methods increment |
| `documents/` | document payload schemas and their example payloads (bill, certificate, BBS, rate analysis, bid book) | the documents increment |
| `entity-graph/` | EntityGraph mirror fixtures — the shape a read must keep | the EntityGraph increment |
| `model-calls/` | recorded model calls for deterministic replay inside verify; a missing one is `FIXTURE_MISSING`, never a network call (L-AI-01) | the first model-using increment |
| `drawings/` | small DWG/DXF/PDF inputs for the cad/ ingest lane, with their audited two-pass output | the ingest increment |

## Layout

```
fixtures/
  gen/            this skeleton, and one generator per corpus (gen/<corpus>.mjs)
  <corpus>/       the committed output, with its README.md
```
