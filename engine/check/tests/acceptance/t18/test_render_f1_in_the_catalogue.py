"""Ticket 18's acceptance: `render_f1.py` sits in engine/check/, which 19b's catalogue scans, and "it
declares its own (`CODE`, `VERSION`, `MILESTONE`, `KIND`, `MESSAGE`), or 18 names it in `catalogue.py`
as a non-Check" (docs/plans/M0.md, 18). Either way the catalogue's scan succeeds with it present.

    uv run pytest -rf engine/check/tests/acceptance/t18
"""

import importlib
import importlib.util

from engine.check import catalogue


def test_render_f1_is_a_module_of_engine_check() -> None:
    assert importlib.util.find_spec("engine.check.render_f1") is not None


def test_the_catalogue_scans_engine_check_with_render_f1_in_it() -> None:
    module = importlib.import_module("engine.check.render_f1")

    checks = catalogue.scan()

    declares = all(hasattr(module, n) for n in ("CODE", "VERSION", "MILESTONE", "KIND", "MESSAGE"))
    if declares:
        listed = [c for c in checks if c.module == "engine.check.render_f1"]
        assert len(listed) == 1
        entry = listed[0].entry
        assert entry.code == module.CODE
        assert entry.milestone == "M0"
        assert entry.set is False, "the render check is a stage of its own, never run by run_all"
    else:
        assert all(c.module != "engine.check.render_f1" for c in checks)


def test_render_f1_is_a_stage_of_its_own_and_not_a_set_check() -> None:
    importlib.import_module("engine.check.render_f1")

    assert all(c.module != "engine.check.render_f1" or c.run is None for c in catalogue.scan())
