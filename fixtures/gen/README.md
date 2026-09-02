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
