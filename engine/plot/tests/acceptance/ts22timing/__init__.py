"""S22-TIMING's acceptance: every timing comparison in `engine/plot/tests` takes the best of several runs
of each side, through one shared helper (`engine.plot.tests.timing.best_of`).

The defect (#653's `test_title_read_shared_budget.py`, PR #655's `python (rest)`): each side of
`page_reads < 4 * one + 0.05` was timed once, cold, so a loaded CI runner broke the bound
((0.379, 0.066)) and a plain rerun passed. The least of at least five runs of each side drops the
noise and keeps a real regression, which slows every run:

    uv run pytest engine/plot/tests/acceptance/ts22timing -rf
"""
