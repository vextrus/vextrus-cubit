# SAMPLE seed package

The data behind R-UI-033's one-click SAMPLE project: the synthetic F-RCC6 fixture set, labelled
SAMPLE, described as a project plus the drawing files a seed would upload for it.

`manifest.json` is hand-written and names:

- the project facts (`label`, `project.name`, `project.code`, `project.buildingType`,
  `project.storeys`) — every one of them says SAMPLE where a person could read it;
- the generator that authored the drawings (`generator.path`, `generator.sha256` — the sha256 of
  the committed `fixtures/gen/rcc6.py`);
- every file of the corpus by repo-relative path, format and sha256 of the committed bytes. The
  DWG is included by its committed bytes: LibreDWG's `dxf2dwg` is not byte-stable, so a
  regenerated DWG is judged by its census (`cad/tests/sanity`), while this package pins the copy
  that is actually committed.

## What consumes it

Nothing yet. `src/server/shell/sample-seed.ts` still answers `{ available: false }`: the SAMPLE
offer's seam stays closed until the drawings tables and the upload seam exist, and the node that
ships them turns this package into the seeded project. Until then the shell's empty state keeps
teaching the upload action and offers nothing it cannot deliver (B-23).

## Keeping it true

`tests/rcc6/sample-seed.test.ts` checks every hash against the committed bytes. Regenerating the
corpus (`uv run --project cad --group fixtures python fixtures/gen/rcc6.py`) or editing the
generator changes hashes; update this manifest in the same change.
