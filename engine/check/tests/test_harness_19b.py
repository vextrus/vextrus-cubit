"""19b's two stages through the harness (engine/harness.py): fake upstream stages (06b's `fakes`), the
real `conflicts.find` and `catalogue.run_all`, and an export valid against its schema holding
conflicts, continuations and Check results.

13's readers are not on `main` yet, so the harness path's `recognisers` is replaced with the stand-ins
here (the part-2 wiring replaces the stand-ins with 13's); the last tests pin what the harness path does
without them: it fails by name where a number must be read, and is skipped where no sheet was read.
"""

from collections.abc import Callable
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest

from engine.export import load_schema, validate
from engine.harness import STAGES, Stage
from engine.recognise import conflicts
from engine.recognise.tests.stand_ins import stand_ins
from engine.tests.test_harness import by_path, conventions, fakes, run  # noqa: F401 (fixtures)

REAL = {"conflicts", "checks"}

SHEETS = """
    from engine.recognise.types import SheetCandidate, SheetLocation, Sourced

    ROWS = {
        "one": [
            ("S-01", "General notes", None),
            ("S-07", "Slab layout", "5TH FLOOR"),
            ("S-09", "Column schedule", None),
            ("S-10", "Column schedule", None),
        ],
        "two": [("S-07", "Slab layout", "5TH FLOOR"), ("S-12", "Beam and slab", "5TH FLOOR")],
    }

    def find(artefact, discipline, conventions):
        rows = ROWS[artefact.path.read_text().strip()]
        return [
            SheetCandidate(
                location=SheetLocation(layout=f"Layout{n}"),
                number=Sourced(number, "title_block_text"),
                title=Sourced(title, "title_block_text"),
                discipline=Sourced(discipline, "file"),
                storeys_as_stated=None if storeys is None else Sourced(storeys, "title_block_text"),
            )
            for n, (number, title, storeys) in enumerate(rows)
        ]
"""
VIEWS = """
    from engine.recognise.types import Box, ViewCandidate

    def find(artefact, sheet, conventions):
        if sheet.number.value in ("S-07", "S-12"):
            return [
                ViewCandidate(
                    box=Box(0, 0, 100, 80), kind="plan", title="5th floor slab, bottom",
                    storeys=("floor_5",), storeys_meaning="at_floor_level", subject="slab",
                    layer="bottom", steps=("slabs",),
                )
            ]
        if sheet.number.value == "S-01":
            return [ViewCandidate(box=Box(0, 0, 40, 20), kind="notes")]
        return []
"""
REGISTER = """
    from engine.recognise.types import Box, RegisterEntry

    def find(artefact, sheets):
        if sheets[0].number.value != "S-01":
            return []
        return [
            RegisterEntry(sheet=sheets[0], row_box=Box(0, n, 10, n + 1), number=number)
            for n, number in enumerate(("S-01", "S-07", "S-09", "S-10", "S-11"))
        ]
"""
PDF = """
    from dataclasses import dataclass

    @dataclass(frozen=True)
    class Page:
        number: int

    def report(path):
        return {"counts": {"pages": 2}}

    def page_text(path):
        return [Page(1), Page(2)]
"""
PLOT = """
    from engine.recognise.types import PlotMatch, PlotTransform

    def match(pages, sheets):
        return [
            PlotMatch(page=pages[0], sheet=sheets[0], residual=0.1,
                      transform=PlotTransform(scale=1.0, rotation=0, offset=(0.0, 0.0))),
            PlotMatch(page=pages[1], reason="no_sheet_matched"),
        ]
"""


def real_two(stages: tuple[Stage, ...]) -> tuple[Stage, ...]:
    real = {stage.name: stage for stage in STAGES}
    return tuple(real[s.name] if s.name in REAL else s for s in stages)


def read_set(tmp_path: Path, stages: tuple[Stage, ...], folder: Path) -> Any:
    files = {"structural/one.dwg": "one", "structural/two.dwg": "two", "structural/plot.pdf": ""}
    return run(tmp_path, stages, files, conventions=folder)


def test_the_harness_runs_19bs_two_stages_and_writes_a_valid_export(
    tmp_path: Path,
    fakes: Callable[..., tuple[Stage, ...]],  # noqa: F811
    conventions: Path,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    readers = stand_ins({"5TH FLOOR": ("floor_5",)})
    monkeypatch.setattr(conflicts, "recognisers", lambda _conventions: readers)
    stages = real_two(fakes(sheets=SHEETS, views=VIEWS, register=REGISTER, pdf=PDF, plot=PLOT))

    document = read_set(tmp_path, stages, conventions)

    assert validate(document, load_schema()) == []
    states = {n: r["state"] for n, r in document["set_stages"].items()}
    assert (states["plot"], states["conflicts"], states["checks"]) == ("ok", "ok", "ok")
    one, two = 0, 2  # the files, in path order: one.dwg, plot.pdf, two.dwg
    assert list(by_path(document)) == ["structural/one.dwg", "structural/plot.pdf", "structural/two.dwg"]
    assert document["continuations"] == [
        {"title": "Column schedule", "sheets": [{"file": one, "sheet": 2}, {"file": one, "sheet": 3}]}
    ]
    assert document["conflicts"] == [
        {
            "kind": "same_number",
            "candidates": [{"file": one, "sheet": 1}, {"file": two, "sheet": 0}],
            "evidence": {"number": "S-07", "copies": 2},
        },
        {
            "kind": "same_storey",
            "candidates": [
                {"file": one, "sheet": 1, "view": 0},
                {"file": two, "sheet": 0, "view": 0},
                {"file": two, "sheet": 1, "view": 0},
            ],
            "evidence": {
                "first": "S-07",
                "first_named": "number",
                "second": "S-12",
                "second_named": "number",
                "plan": "5th floor slab, bottom",
                "other": "",
                "titled": "same",
                "layer": "bottom",
                "views": 3,
                "discipline": "structural",
                "subject": "slab",
                "storey": "floor_5",
            },
        },
    ]
    fired = [
        (c["code"], c["subject"], c["finding"]["code"], c["finding"]["params"])
        for c in document["checks"]
        if c["outcome"] == "fired"
    ]
    assert fired == [
        (
            "coverage",
            {"file": one, "sheet": 0, "view": 0},
            "engine.coverage.unaccounted_untitled",
            {"sheet": "S-01", "named": "number", "kind": "notes"},
        ),
        (
            "plot_pages",
            {"file": 1, "page": 2},
            "engine.plot_pages.no_sheet",
            {"page": 2, "reason": "no_sheet_matched"},
        ),
        ("plot_pages", {"file": one, "sheet": 1}, "engine.plot_pages.no_page", {"number": "S-07"}),
        ("plot_pages", {"file": one, "sheet": 2}, "engine.plot_pages.no_page", {"number": "S-09"}),
        ("plot_pages", {"file": one, "sheet": 3}, "engine.plot_pages.no_page", {"number": "S-10"}),
        ("plot_pages", {"file": two, "sheet": 0}, "engine.plot_pages.no_page", {"number": "S-07"}),
        ("plot_pages", {"file": two, "sheet": 1}, "engine.plot_pages.no_page", {"number": "S-12"}),
        (
            "register",
            {"file": one, "sheet": 0, "register": 4},
            "engine.register_check.not_found",
            {"number": "S-11"},
        ),
        ("register", {"file": two, "sheet": 1}, "engine.register_check.not_listed", {"number": "S-12"}),
    ]
    passed = [(c["code"], c["subject"]) for c in document["checks"] if c["outcome"] == "passed"]
    assert ("storey_titles", {"file": two, "sheet": 1}) in passed
    assert {code for code, _ in passed} == {"coverage", "plot_pages", "register", "storey_titles"}
    assert all(c["finding"] is None for c in document["checks"] if c["outcome"] == "passed")


def test_without_13s_readers_the_stages_fail_by_name_and_the_export_holds(
    tmp_path: Path,
    fakes: Callable[..., tuple[Stage, ...]],  # noqa: F811
    conventions: Path,  # noqa: F811
) -> None:
    stages = real_two(fakes(sheets=SHEETS, views=VIEWS, register=REGISTER, pdf=PDF, plot=PLOT))

    document = read_set(tmp_path, stages, conventions)

    assert validate(document, load_schema()) == []
    for name in ("conflicts", "checks"):
        report = document["set_stages"][name]
        assert report["state"] == "failed"
        assert report["error"].startswith("NotWired: 13's sheets.sequence and storeys.read")
    assert document["conflicts"] == document["continuations"] == document["checks"] == []


def test_before_13_merges_both_stages_are_skipped_for_want_of_sheets(
    tmp_path: Path,
    fakes: Callable[..., tuple[Stage, ...]],  # noqa: F811
    conventions: Path,  # noqa: F811
) -> None:
    stages = tuple(
        replace(s, target="engine.recognise.sheets:find") if s.name == "sheets" else s
        for s in real_two(fakes())
    )

    document = read_set(tmp_path, stages, conventions)

    assert validate(document, load_schema()) == []
    assert document["stages"]["conflicts"]["built"] is True
    assert document["stages"]["checks"]["built"] is True
    for name in ("conflicts", "checks"):
        assert document["set_stages"][name]["state"] == "skipped"
        assert document["set_stages"][name]["error"] == "needs sheets"
