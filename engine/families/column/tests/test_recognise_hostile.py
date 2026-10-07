"""The column reader on hostile plans, built in code (engine/families/column/recognise.py): it never
raises on numbers a file may hold, and stays near linear on many rectangles and texts."""

import time
from decimal import Decimal

from engine.families.column.recognise import recognise
from engine.families.types import ConfirmedFacts, ElementFacts, ProjectSetup, Recognised, ViewArtefact
from engine.read.artefact import Block, Entity, Format, ReadArtefact, Text

type Corners = list[tuple[float, float, float]]


def _artefact(
    rects: list[Corners], texts: list[tuple[tuple[float, float, float], str, float]]
) -> ReadArtefact:
    entities: list[Entity | Text] = []
    handles: list[str] = []

    def handle() -> str:
        handles.append(format(len(handles) + 2, "X"))
        return handles[-1]

    for corners in rects:
        points = [list(p) for p in corners]
        entities.append(Entity(handle(), "LWPOLYLINE", "L", "1", {"points": points, "closed": True}))
    for at, text, height in texts:
        entities.append(
            Text(handle(), "TEXT", "T", "1", text, None, "none", None, None, height, at, None,
                 0, 0, 0.0, None, None, None, None, (0.0, 0.0, 1.0))
        )  # fmt: skip
    model = Block("1", "*Model_Space", (0.0, 0.0, 0.0), "Model", tuple(handles))
    return ReadArtefact.build(
        source_sha256="0" * 64, source_name="x.dwg", format=Format("dwg", "AC1032"), reader="r",
        reader_version="1", layouts=["Model"], insunits=4, notes=[], blocks=[model], entities=entities,
    )  # fmt: skip


def _rect(cx: float, cy: float, b: float, d: float) -> Corners:
    return [(cx - b / 2, cy - d / 2, 0.0), (cx + b / 2, cy - d / 2, 0.0), (cx + b / 2, cy + d / 2, 0.0),
            (cx - b / 2, cy + d / 2, 0.0)]  # fmt: skip


def _grid(*lines: tuple[str, str, str]) -> ConfirmedFacts:
    return ConfirmedFacts(
        facts=tuple(
            ElementFacts(
                family="grid_line",
                element_id=m,
                mark=m,
                storey="",
                values={"axis": a, "offset": Decimal(o)},
            )
            for m, a, o in lines
        )
    )


GRID = _grid(("A", "y", "0"), ("B", "y", "6000"), ("1", "x", "0"), ("2", "x", "5000"))


def _run(artefact: ReadArtefact, grid: ConfirmedFacts = GRID) -> Recognised:
    view = ViewArtefact(view_id="V", sheet_id="S", artefact=artefact, storey="floor_1")
    return recognise([view], grid, ProjectSetup(), None)


def test_a_size_label_of_huge_numbers_is_no_size_and_no_crash() -> None:
    found = _run(
        _artefact([_rect(0, 0, 300, 300)], [((200.0, 0.0, 0.0), "C1 " + "9" * 40 + "x1", 100.0)])
    )

    [c1] = found.candidates
    assert "section_b" not in c1.values
    assert [q.code for q in found.questions] == ["engine.column.size_not_read"]


def test_huge_rectangles_and_far_labels_are_not_read() -> None:
    rects = [_rect(0, 0, 3e30, 3e30), _rect(0, 0, 1e308, 1e308), _rect(0, 0, 0.001, 0.001)]
    texts = [
        ((1e308, 0.0, 0.0), "C1", 100.0),
        ((2e30, 0.0, 0.0), "C2", 1e308),
        ((0.0, 0.0, 0.0), "C3", 0.0),
    ]

    found = _run(_artefact(rects, texts))

    assert [c.mark for c in found.candidates] == ["C3"]


def test_a_rectangle_drawn_twice_is_one_column() -> None:
    found = _run(
        _artefact([_rect(0, 0, 300, 300), _rect(0, 0, 300, 300)], [((200.0, 0.0, 0.0), "C1", 100.0)])
    )

    assert [c.mark for c in found.candidates] == ["C1"]


def test_many_columns_and_labels_with_one_huge_outline_stay_near_linear() -> None:
    def plan(n: int) -> ReadArtefact:
        rects = [_rect(1000.0 * i, 0, 300, 300) for i in range(n)] + [_rect(0, 0, 9e7, 9e7)]
        texts = [((1000.0 * i + 200, 0.0, 0.0), f"C{i % 900 + 1}", 100.0) for i in range(n)]
        return _artefact(rects, texts)

    small, large = plan(500), plan(4000)
    started = time.perf_counter()
    _run(small, ConfirmedFacts(facts=()))
    first = time.perf_counter() - started
    started = time.perf_counter()
    found = _run(large, ConfirmedFacts(facts=()))
    second = time.perf_counter() - started

    assert len(found.candidates) == 4000
    assert second < 20 * first + 1.0, (first, second)
