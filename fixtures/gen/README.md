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

## `rcc6_bnbc/` — F-RCC6-BNBC (the M3/M4 yardstick)

A fictional G+6 RCC residential building in Dhaka, drawn the way a Dhaka consultancy draws one:
27 sheets from the cover and the general notes through the pile, cap, grade beam, column, beam,
slab, stair, core, tank and lintel sheets to a sample bar bending schedule, on mixed A1/A2/A3 paper,
in feet-inches on the plans and millimetres on the details (W-08). Everything comes from
`model.build()` — the golden takeoff and the drawings are two paintings of one authored model, and
the golden never imports a drawing module (`cad/tests/rcc6_bnbc/test_rcc6_bnbc_lint.py`).

The generator is a package, not a script, because it has a model, a golden, validators, composers
and five emitters:

```
uv run --project cad --group fixtures python -m fixtures.gen.rcc6_bnbc [--out DIR] [--stage all|golden]
```

`DIR` defaults to `fixtures/rcc6-bnbc`. `--stage golden` writes the six Wave A JSON files alone (the
fast path the golden tests take); `--stage all` is the default and writes everything below. The run
prints `wrote <relative> sha256=<hex>` per file; any failure exits non-zero, says why on stderr and
**writes nothing at all** — the whole corpus is built in a temporary directory, checked there, and
only then moved into place (E-fixture §3.10).

| file | what it is |
| --- | --- |
| `takeoff.golden.json`, `bbs.golden.json`, `cells.json`, `site.json`, `model.json` | the hand takeoff, the bar bending schedule, the 36-cell matrix, the site facts and a plain-data dump of the model |
| `traps.json` | every registered trap with the live handle of its own entity in the drawing it names |
| `rcc6-bnbc.dxf` | ezdxf, R2004; one paper layout per sheet, the views in model space, one VIEWPORT per view, `$INSUNITS 0` |
| `rcc6-bnbc.model.dxf` | the same sheets as another office draws them: each paper scene ×100 in model space, details at ×(100/S) with `DIMLFAC` (W-05) |
| `arch-plan.dxf` | the architect's drawing S-13 binds and S-19 still points at, unresolved |
| `rcc6-bnbc.libredwg-r2000.dxf` | the R2000 twin whose tag stream slipped: `vextrus_cad.resync` refuses it by name until it drops the injected lines (W-07) |
| `rcc6-bnbc.dwg`, `rcc6-bnbc.model.dwg` | minted by LibreDWG under a measured profile: every feature it loses is left out of the DWG source and named in `sanity.json` (W-04) |
| `rcc6-bnbc.pdf` | the vector PDF, TrueType text (Vera out of the pinned reportlab wheel), pages at each sheet's own paper size |
| `rcc6-bnbc.shx.pdf` | the same drawing with its text stroked from the embedded Hershey simplex table — no text object at all, so an extractor reads nothing (T-PDF-SHX) |
| `raster/r1/*.png` | clean renders at 300 dpi, greyscale |
| `raster/r2/*.jpg`, `rcc6-bnbc.r2.pdf` | the scan at 200 dpi — skew, uneven lamp, blur, speckle, an APPROVED stamp, a signature, a fold crease, punch holes — and the whole set bound as one DCT raster PDF at 120 dpi |
| `raster/r3/*.jpg` | the photocopy at 120 dpi: binarised, strokes dilated then eroded, title-block edge cropped |
| `raster/r4/*.jpg` | the phone photograph at 150 dpi: keystoned, vignetted, warm-cast, soft |
| `images/*.png` | the rasters the drawing itself carries (the consultant's logo, a scanned marginal note) |
| `notation.corpus.json` | every drawn string with its parser family, sheet, handle and authored fact |
| `sanity.json` | the placing-time tally per (space, DXF type) for both DXFs, the DWG census and its named losses, and what each PDF and raster variant loses |
| `manifest.json` | the sheet roster, the sha256 of every output and of every generator module, the raster parameters actually used and every validate report |

**Determinism.** Two in-process builds are byte-identical for every file except the two DWGs:
`dxf2dwg` is not promised byte-stable, so each DWG is judged by the census the product's own DWG
lane reads off it, never by its bytes (W-04, §3.9). The build proves this on itself — it composes
the sheets, writes both DXFs and paints both PDFs a second time and compares — and
`cad/tests/sanity/test_rcc6_bnbc_regenerate.py` proves it again from the committed corpus. Nothing
reads a clock: the title block's date is authored, the PDFs carry fixed metadata, and every random
draw in the raster set comes from `numpy.random.default_rng([plan.RASTER["seed"], variant, sheet])`.

**Budget (Founder's Law 4, W-02).** The corpus holds 33.5 MB against a
45 MB cap, of which 12.3 MB is
`raster/` against a 25 MB cap, and no file exceeds
8 MB. PNG is spent only on the six-sheet R1 subset; every scan,
photocopy and photograph is JPEG. A variant that will not fit its share walks a ladder — quality
first, then dpi, never fewer sheets — and the manifest records what it actually used.
`cad/tests/rcc6_bnbc/test_rcc6_bnbc_size.py` pins all four caps.

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
