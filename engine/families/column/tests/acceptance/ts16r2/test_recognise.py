"""S16-R2: the column reader (session 16's contract, column; docs/plans/M1.md C4).

"column: candidate per column outline per view per storey: `mark` ("C1"), `values` `section_b`,
`section_d` (from the size LABEL, drawing units, verbatim text kept), `at` = grid ref "B/2" + offset; ...
a column with no size label -> QuestionRaised code `engine.column.size_not_read`."

The plan is synthetic (millimetres), drawn here with ezdxf and written to DWG by the repo's writer
(`engine/fixtures/dwg/_writer`) in the test's temporary folder, then read through M0's reader. The grid
is confirmed and passed in as ConfirmedFacts: A and B (vertical, x = 0 and 6000), 1 and 2 (horizontal,
y = 0 and 5000).
"""

import subprocess
from pathlib import Path

import pytest
from ezdxf.document import Drawing

from engine.families.column.recognise import recognise
from engine.families.types import ElementCandidate, Recognised
from engine.fixtures import dwg

from . import _k0

pytestmark = pytest.mark.needs_toolchain

STOREY = "floor_1"


def _column(
    doc: Drawing, centre: tuple[float, float], b: float, d: float, labels: tuple[str, ...]
) -> None:
    model = doc.modelspace()
    x, y = centre
    corners = [
        (x - b / 2, y - d / 2),
        (x + b / 2, y - d / 2),
        (x + b / 2, y + d / 2),
        (x - b / 2, y + d / 2),
    ]
    model.add_lwpolyline(corners, close=True, dxfattribs={"layer": "COL"})
    for row, text in enumerate(labels):
        model.add_text(text, dxfattribs={"layer": "COL-TEXT", "height": 100}).set_placement(
            (x + b / 2 + 150, y + d / 2 - 150 * row)
        )


def _plan() -> Drawing:
    doc = dwg.new_drawing()
    doc.layers.add("COL")
    doc.layers.add("COL-TEXT")
    _column(doc, (6000, 5000), 250, 500, ("C1", "250x500"))  # on B/2
    _column(doc, (100, -60), 254, 508, ("C2", '10"x20"'))  # near A/1, off by (100, -60)
    _column(doc, (0, 5000), 250, 500, ("C3",))  # on A/2, no size label
    return doc


@pytest.fixture(scope="module")
def plan_dwg(tmp_path_factory: pytest.TempPathFactory) -> Path:
    folder = tmp_path_factory.mktemp("ts16r2")
    writer = dwg.build_writer(folder)
    dxf, drawn = folder / "columns.dxf", folder / "columns.dwg"
    _plan().saveas(dxf)
    subprocess.run(
        [str(dwg.dotnet()), str(writer), str(dxf), str(drawn), "AC1032"], check=True, timeout=120
    )
    return drawn


@pytest.fixture(scope="module")
def recognised(plan_dwg: Path) -> Recognised:
    grid = _k0.confirmed(
        _k0.grid_line("A", "y", "0"),
        _k0.grid_line("B", "y", "6000"),
        _k0.grid_line("1", "x", "0"),
        _k0.grid_line("2", "x", "5000"),
    )
    return recognise([_k0.plan_view(plan_dwg, STOREY)], grid, _k0.setup(), None)


def _by_mark(recognised: Recognised, mark: str) -> ElementCandidate:
    found = [c for c in recognised.candidates if c.mark == mark]
    assert len(found) == 1, f"{len(found)} candidates marked {mark}: {recognised.candidates!r}"
    return found[0]


def test_each_column_outline_is_one_candidate_with_its_mark_verbatim(recognised: Recognised) -> None:
    marks = sorted(c.mark for c in recognised.candidates if c.mark in {"C1", "C2"})
    assert marks == ["C1", "C2"]
    assert len(recognised.candidates) <= 3
    assert all(c.family == "column" for c in recognised.candidates)


def test_a_candidate_is_on_the_views_storey(recognised: Recognised) -> None:
    assert _by_mark(recognised, "C1").storey == STOREY


def test_a_column_on_an_intersection_takes_its_grid_ref(recognised: Recognised) -> None:
    assert _k0.grid_ref_of(_by_mark(recognised, "C1")) == "B/2"


def test_an_offset_column_takes_the_nearest_intersections_grid_ref(recognised: Recognised) -> None:
    assert _k0.grid_ref_of(_by_mark(recognised, "C2")) == "A/1"


def test_a_metric_size_label_gives_b_and_d_in_drawing_units(recognised: Recognised) -> None:
    c1 = _by_mark(recognised, "C1")
    assert _k0.value_of(c1, "section_b") == 250
    assert _k0.value_of(c1, "section_d") == 500


def test_the_metric_size_label_is_kept_verbatim(recognised: Recognised) -> None:
    c1 = _by_mark(recognised, "C1")
    assert _k0.verbatim_of(c1, "section_b") == "250x500"
    assert _k0.verbatim_of(c1, "section_d") == "250x500"


def test_an_inch_size_label_gives_b_and_d_in_drawing_units(recognised: Recognised) -> None:
    c2 = _by_mark(recognised, "C2")
    assert _k0.value_of(c2, "section_b") == 254
    assert _k0.value_of(c2, "section_d") == 508


def test_the_inch_size_label_is_kept_verbatim(recognised: Recognised) -> None:
    c2 = _by_mark(recognised, "C2")
    assert _k0.verbatim_of(c2, "section_b") == '10"x20"'
    assert _k0.verbatim_of(c2, "section_d") == '10"x20"'


def test_a_column_without_a_size_label_raises_size_not_read(recognised: Recognised) -> None:
    codes = [q.code for q in recognised.questions]
    assert codes.count("engine.column.size_not_read") == 1


def test_no_size_is_guessed_for_the_unlabelled_column(recognised: Recognised) -> None:
    for c in recognised.candidates:
        if c.mark == "C3":
            assert "section_b" not in c.values
            assert "section_d" not in c.values
