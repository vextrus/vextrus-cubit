"""F-ARCH — the architect's set of the F-RCC6-BNBC building (tranche 1).

A committed, deterministic generator (L-CAD-09): `model.py` authors the architecture — walls,
openings, rooms, finishes and the schedules — over the structure F-RCC6-BNBC already authored
(grid, levels, columns, the lift core, beams and slab panels, read from
`fixtures.gen.rcc6_bnbc.model` and never edited); `golden.py` and `golden_check.py` are the two
independent paths of the hand takeoff; `selfcheck.py` refuses on any disagreement; `emit/` paints
the drawing. Run it from the checkout root:

    uv run --project cad --group fixtures python -m fixtures.gen.arch [--out DIR] [--stage all|golden]
"""
