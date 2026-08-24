# Fixture generators

This directory is the home of the generators that build the tree's committed fixtures — the DWG,
IFC and document inputs the CAD and document lanes will read (B-15, C-06).

## What exists today

Nothing. This directory holds no generator yet: the surfaces they would generate for — the CAD
tree, the document payloads, the catalogue — have not been built. Naming a generator here before
it runs would be exactly the stale scaffolding prose B-23 forbids, so this file names none.

## What a generator must be when one lands

- One generator per fixture family, deterministic: same inputs, byte-identical outputs, so a
  regenerated fixture that differs is a real change and shows up as one in review.
- It writes only into the fixture directory it owns, never into the product tree.
- Its output is committed. The gate reads committed fixtures; it never generates them while
  verifying, so a lane can never go green against a fixture nobody has seen.
- Its increment declares it, and this file gains a line naming it the day it exists.

The deliberate-bad lint corpus is **not** generated: it is hand-written and committed under
`tests/lint-fixtures`, because its payload is the flagged construct itself (Q-08).
