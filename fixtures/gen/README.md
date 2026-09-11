# Fixture generators

Committed scripts that author the synthetic drawing corpora under `fixtures/<name>/` (L-CAD-09:
fixtures are synthetic drawings authored by committed scripts; competitor-derived drawings never
enter the repository).

## `rcc6.py` — F-RCC6

A six-storey RCC residential building: foundation plan (footings F1–F4, pile caps PC1–PC2, tie
beams), typical floor plan (columns C1–C4 on grid A–F / 1–6, beams B1–B6, slab and openings), roof
plan, column, beam and footing schedules, a section with levels, general notes (fy, cover, laps
`50d`) and a title block on every sheet. Everything derives from one embedded set of authored
inputs, and the run writes `fixtures/rcc6/`:

| file | what it is |
| --- | --- |
| `rcc6.dxf` | ezdxf, R2004; one paper layout per sheet, the views in model space |
| `rcc6.dwg` | minted from the DXF by LibreDWG's `dxf2dwg` |
| `rcc6.pdf` | vector PDF, one page per sheet, written by reportlab (D-04: fixtures only) |
| `rcc6.raster.pdf`, `raster/<slug>.png` | the vector pages rendered through pypdfium2 at 200 DPI, skewed 0.6° and speckled with seeded noise |
| `inputs.json` | the authored inputs, verbatim |
| `takeoff.golden.json` | the hand takeoff: RCC_CONCRETE and FORMWORK per class × level by the L-FRM-02/L-FRM-03 formulas from the inputs, never from the drawing (L-QTY-06) |
| `sanity.json` | every original entity the generator placed, tallied per space × DXF type as it was placed |
| `manifest.json` | sheet roster, page sizes, raster facts, the generator's own sha256 |

Run it from the checkout root:

```
uv run --project cad --group fixtures python fixtures/gen/rcc6.py [--out DIR]
```

`DIR` defaults to `fixtures/rcc6`. The script prints `wrote <path> sha256=<hex>` per file and exits
0; any failure exits non-zero with the reason on stderr and writes nothing. Its dependencies
(reportlab, pillow, pypdfium2) live in the cad project's `fixtures` dependency group. Nothing in
`cad/src` imports them: `uv run --group fixtures` leaves the group resident in the shared `cad/.venv`,
so `cad/tests/sanity/test_fixtures_group.py` scans the app's sources for such an import rather than
trusting a local run.

The output is deterministic — the same script writes the same bytes — except `rcc6.dwg`, whose
writer is not byte-stable; `cad/tests/sanity/` judges a regenerated DWG by its LibreDWG census and
every other file by byte identity, and pins the sanity number: the DXF read through `ingest_dxf`
and the DWG read through `convert_dwg` must each account for every drawn entity.

## Rules for a generator here

- writes its corpus under `fixtures/<name>/`, never into `src/**` or `tests/lint-fixtures/**`;
- is deterministic — same inputs, byte-identical output — so a golden test can compare without a
  re-baseline (Q-08);
- is runnable on its own and re-runnable in place;
- records what it generated and from which source, so a stale corpus is visible rather than quiet
  (B-23).

The lint fixture corpus at `tests/lint-fixtures/**` is *not* generated: every payload there is
written by hand and read by the toolchain suite, because a rule is proven against the exact shape a
person would write (Q-01).

## F-RCC6 v1.1 — conventions of the repair (AM-01, AM-02)

v1.1 is a golden-side repair: `rcc6.py`'s drawing is byte-for-byte what v1.0 drew (DXF, DWG, both
PDFs and every PNG are unchanged), and only the authored inputs' measured geometry, the takeoff
golden and the manifest move.

- **The junction law.** BEAM and SLAB rows are measured under AM-02 (L-MEA-09): every junction
  volume and contact face has one owner. Beams are clear between support faces and below the slab
  soffit; the slab runs through, out to the edge beams' outer faces, less the column plan areas and
  the openings.
- **The FDN → GF column neck is left out.** No column is measured between the footing top at
  -1.500 and the GF floor: the column rows start at GF and run floor-to-floor from there. The neck
  is real concrete the golden does not bill — an under figure, declared here as a convention of
  v1.1 rather than repaired, because billing it would move the M2 column rows that AM-01 freezes.
- **Column formwork keeps `2(b + d) x storey`.** AM-02 would take `perimeter x (storey - t_slab)`
  less the beam-end contacts; v1.1 does not, for the same reason — it would move the frozen column
  rows. This is the one place v1.1 knowingly publishes an over figure, and `fixtures/rcc6/
  manifest.json`'s `repairs` list names it as deferred with that side recorded.
- **The beam schedule still prints B5 at 4.5 m.** The plan draws B5 as the four opening trimmers
  (2 x 2.500 m + 2 x 2.000 m); the golden bills what is drawn. Re-authoring the schedule is a
  drawing-side item, deferred, and the golden's figure is under while it waits.
