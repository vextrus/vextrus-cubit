"""Ticket T-W334's acceptance through the harness (engine/harness.py): the `conflicts` stage takes a
`Series` from the real `conflicts.find` (no error), exports nothing new for it (the export stays valid
against `engine/export.schema.json`), and the runs it groups are no `same_title` Conflict.

Modelled on engine/check/tests/test_harness_19b.py: fake upstream stages (06b's `fakes`), the real
`conflicts.find` with 13's own readers. One invented title on two runs whose views state different
storeys.
"""

from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from engine.export import load_schema, validate
from engine.harness import STAGES, Stage
from engine.recognise import conflicts
from engine.tests.test_harness import conventions, fakes, run  # noqa: F401 (fixtures)

SHEETS = """
    from engine.recognise.types import SheetCandidate, SheetLocation, Sourced

    ROWS = [("S-03", "Ramp details"), ("S-04", "Ramp details"), ("S-08", "Ramp details")]

    def find(artefact, discipline, conventions):
        return [
            SheetCandidate(
                location=SheetLocation(layout=f"Layout{n}"),
                number=Sourced(number, "title_block_text"),
                title=Sourced(title, "title_block_text"),
                discipline=Sourced(discipline, "file"),
            )
            for n, (number, title) in enumerate(ROWS)
        ]
"""
VIEWS = """
    from engine.recognise.types import Box, ViewCandidate

    STOREYS = {"S-03": "floor_2", "S-04": "floor_2", "S-08": "floor_6"}

    def find(artefact, sheet, conventions):
        return [
            ViewCandidate(
                box=Box(0, 0, 100, 80), kind="detail", title="Ramp section",
                storeys=(STOREYS[sheet.number.value],), storeys_meaning="at_floor_level",
            )
        ]
"""


def test_the_conflicts_stage_takes_a_series_and_exports_its_runs_as_continuations_only(
    tmp_path: Path,
    fakes: Callable[..., tuple[Stage, ...]],  # noqa: F811
    conventions: Path,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    returned: list[list[Any]] = []
    real_find = conflicts.find

    def find(*args: Any) -> list[Any]:
        found: list[Any] = real_find(*args)
        returned.append(found)
        return found

    monkeypatch.setattr(conflicts, "find", find)
    real = {stage.name: stage for stage in STAGES}
    stages = tuple(
        real["conflicts"] if s.name == "conflicts" else s for s in fakes(sheets=SHEETS, views=VIEWS)
    )

    document = run(tmp_path, stages, {"structural/one.dwg": "one"}, conventions=conventions)

    from engine.recognise.types import Series  # type: ignore[attr-defined, unused-ignore]

    [found] = returned
    [series] = [f for f in found if isinstance(f, Series)]
    assert [s.number.value for s in series.sheets if s.number] == ["S-03", "S-04", "S-08"]
    assert validate(document, load_schema()) == []
    assert document["set_stages"]["conflicts"]["state"] == "ok"
    assert document["set_stages"]["conflicts"].get("error") is None
    assert document["continuations"] == [
        {"title": "Ramp details", "sheets": [{"file": 0, "sheet": 0}, {"file": 0, "sheet": 1}]}
    ]
    assert document["conflicts"] == []
