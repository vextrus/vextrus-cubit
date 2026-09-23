---
paths:
  - "cad/**"
  - "fixtures/**"
  - "scripts-data/**"
  - "tests/golden/**"
  - "tests/rcc6/**"
  - "scripts/harness/drawing.py"
  - "src/modules/takeoff/partition/**"
  - "src/modules/takeoff/ingest/**"
---
# CAD lane and fixture law

- `cad/` turns file formats into the EntityGraph and stops (L-CAD-01); everything that reads meaning
  (views, grid, placement, schedules, notation) runs in TypeScript over the artifact. A DWG converts
  through LibreDWG two-pass audited (L-CAD-04); ezdxf is pinned exactly (1.4.4) because the extractor's
  identity is part of every source key's scope (L-CAD-02) — moving it, or LibreDWG, re-keys the corpora
  and is a declared re-ingest, never a routine bump.
- Read-only commands: `uv run --project cad pytest cad` (the lane runs `-n 6`), `ruff check cad`,
  `dwgread <f.dwg>`, `dwg2dxf -m -o <scratch>/x.dxf <f.dwg>` (plain `dwg2dxf` writes beside its input).
- **Two fixtures, never a replacement**: F-RCC6 is byte-frozen at v1.1 (the J-000 corpus, the SAMPLE
  seed, the fast regression lane); F-RCC6-BNBC (`fixtures/gen/rcc6_bnbc/` → `fixtures/rcc6-bnbc/`, pytest
  at `cad/tests/rcc6_bnbc/`) is the M3/M4 yardstick. A numeric assertion names its roster. A
  regenerated fixture, snapshot or baseline goes in its own `baseline:`-subject commit naming the proof.
- Read a golden through `goldenRows(fixtureId)` (`tests/golden/support/golden-fixture.ts`). The golden is
  authored by the generator's independent model, never by the product's methods; the lane is armed by
  the manifests (`fixtures/rcc6/manifest.json`, `scripts-data/sample-seed/manifest.json`).
- **`stack` and `mark` are two namespaces that both spell `C<n>`** (mark C7 = stack C7X, mark C5 = stack
  B4). Two spellings of one fact are the first defect to look for. A reader that answers nothing over a
  drawing it should read: diff the keys.
- **The Edison set** (`.private/reference/edison/*.dwg`, the owner's real professional drawings,
  gitignored): an internal benchmark to learn from — layering, schedule layouts, note grammar, dimension
  styles, title blocks, viewport conventions, the dirt real drawings carry. Dissect it with the `cubit`
  MCP tools `drawing_inventory` / `drawing_render` (work lands in `.private/work/`). It never enters the
  repository, never becomes demo content, and its geometry and text are never copied into a fixture
  (L-CAD-09): a fixture learns its CONVENTIONS and stays a synthetic, authored drawing. The
  `edison-drawings` skill is the procedure.
- The golden against the drawing: about 78 cells are unreachable from F-RCC6-BNBC as drawn and about 15
  disagree with it; that reconciliation (R0) is the owner's to rule.
