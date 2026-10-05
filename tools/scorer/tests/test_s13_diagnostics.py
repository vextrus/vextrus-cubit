"""T-249's diagnostics beyond its acceptance tests: the scorer's copy of the engine's Discipline keys
equals the engine's (as SUBJECTS does), the direction and date shapes on their edges, a key view whose
place another view took is "box taken", and every new line is built from closed words and counts even
when the key and the export are hostile. Invented keys only."""

import json
import re
from pathlib import Path

import pytest

from tools.scorer import score
from tools.scorer.tests.acceptance.t24s.runs import (
    Place,
    export_sheet,
    export_view,
    key_sheet,
    key_view,
)

ROOT = Path(__file__).resolve().parents[3]


def test_the_scorers_disciplines_are_the_engines() -> None:
    conventions = json.loads(
        (ROOT / "engine" / "recognise" / "conventions" / "sheet-default.json").read_text()
    )
    assert list(score.DISCIPLINES) == [d["key"] for d in conventions["disciplines"]]


@pytest.mark.parametrize(
    ("found", "said"),
    [
        ((0.0, 0.0, 10.0, 20.0), "export larger"),
        ((2.0, 2.0, 8.0, 8.0), "export smaller"),
        ((3.0, 0.0, 13.0, 10.0), "export shifted"),
        ((1.0, 0.5, 11.9, 10.5), "export shifted"),  # within 10 % on both sides
        ((1.0, 0.0, 12.5, 10.0), "export overlaps otherwise"),  # 15 % wider
        ((0.0, 0.0, 10.0, 10.0), "export shifted"),  # the same box: never "larger" or "smaller"
    ],
)
def test_the_direction_of_an_export_box(found: score.Box, said: str) -> None:
    assert score._direction((0.0, 0.0, 10.0, 10.0), found) == said


@pytest.mark.parametrize(
    ("key", "found", "said"),
    [
        ("04.09.2025", "09.04.2025", "day and month swapped"),
        ("04.09.2025", "04.09.2024", "year differs"),
        ("2025-09-04", "2025-04-09", "day and month swapped"),
        ("04.04.2025", "04.04.2026", "year differs"),
        ("04.09.2025", "05.09.2025", "different"),
        ("04.09.2025", "september", "different"),
        ("04.09.2025", "1.2.3.4", "different"),
        ("04.09.2025", "123456.1.2", "different"),
    ],
)
def test_the_shape_of_a_wrong_date(key: str, found: str, said: str) -> None:
    assert score._date_shape(key, found) == said


@pytest.mark.parametrize(
    ("key", "found", "said"),
    [
        (["a", "b"], ["a", "b", "b"], "export lists more"),
        (["a", "b", "b"], ["b", "a"], "export lists fewer"),
        (["a", "b"], ["b", "a"], "same storeys, other order"),
        (["a", "b"], ["a", "c"], "different"),
        (["a", "b"], ["a", "c", "d"], "different"),
        (["a"], [], "export blank"),
    ],
)
def test_the_shape_of_wrong_storeys(key: list[str], found: list[str], said: str) -> None:
    assert score._shape("storeys", key, found) == said


def shown(place: Place, capfd: pytest.CaptureFixture[str]) -> str:
    assert place.score() == 0
    return capfd.readouterr().out


def test_a_key_view_whose_place_another_key_view_took_is_box_taken(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    box = [0.0, 0.0, 100.0, 100.0]
    keyed = [key_view(box, "Made-up first", "plan"), key_view(box, "Made-up second", "plan")]
    place.write_keys([key_sheet("Tab T1", "QZ-1", "Made-up taken", "first", keyed)])
    found = [export_view(box, "Made-up first", "plan")]
    place.write_run([export_sheet("Tab T1", "QZ-1", "Made-up taken", "first", found)])

    assert "    plan: box taken: 1" in shown(place, capfd).splitlines()


NEW = (
    "  views taken for another kind, key kind -> export kind:",
    "  same-kind near misses (best IoU 0.2-0.8), per key kind, by the export box:",
    "  failing key views of joined sheets, per key kind, by class:",
    "  sheet fields not as keyed, per key Discipline, by field and shape:",
)


def test_every_new_line_is_closed_words_and_counts(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    """Hostile kinds, titles, storeys, dates and Disciplines on both sides, joined and not."""
    hostile = ["column c3", "Marlowe", "plan\nsecret", "3d/secret", "z" * 300]
    keyed, found = [], []
    for i, kind in enumerate(hostile):
        where = [200.0 * i, 0.0, 200.0 * i + 100.0, 100.0]
        keyed.append(key_view(where, f"Secret title {i}", kind=kind, subject=f"secret {kind}"))
        near = [200.0 * i, 0.0, 200.0 * i + 100.0, 150.0]
        found.append(export_view(near, f"Found {i}", kind=kind if i % 2 else "plan"))
    place = Place(tmp_path)
    place.write_keys(
        [
            key_sheet(
                "Tab H1",
                "QZ-SECRET",
                "Secret sheet title",
                "secret storey, other storey",
                keyed,
                discipline="Secret trade",
                date="12.11.1999",
                revision="Secret revision",
            )
        ]
    )
    place.write_run([export_sheet("Tab H1", "QZ-9", "Found sheet", "found storey", found)])

    lines = shown(place, capfd).splitlines()

    start = lines.index(NEW[0])
    new = [line for line in lines[start:] if " / " not in line]
    closed = [
        *NEW,
        *score.KINDS,
        *score.DISCIPLINES,
        *score.DIRECTIONS,
        *score.CLASSES,
        *score.FIELD_WORDS.values(),
        *(shape for shapes in score.SHAPES.values() for shape in shapes),
        "none",
        "another kind",
        "another Discipline",
    ]
    allowed = {word for sentence in closed for word in re.findall(r"[^\W\d_]+", sentence.casefold())}
    for line in new:
        assert set(re.findall(r"[^\W\d_]+", line.casefold())) <= allowed, line
    assert "secret" not in "\n".join(new).casefold()


@pytest.mark.parametrize(
    ("field", "key", "found"),
    [
        ("date", "04.09.2025", "11-" * 100_000),
        ("title", "made-up title", "made-up title " * 10_000),
        ("storeys", ["a", "b"], ["a", "b", *(["c"] * 100_000)]),
        ("storeys", ["a"], ["a", "z" * 100_000]),
    ],
)
def test_a_value_past_the_shaped_length_is_different_before_any_shape_is_sought(
    field: str, key: object, found: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The refuter's finding (T-249, 60): a huge export date cost a joined sheet 150 times an
    unjoined one's time. No shape is sought past SHAPED, so no regex, Counter or search runs."""

    def never(*args: object) -> object:
        raise AssertionError("a shape was sought")

    monkeypatch.setattr(score, "_date_parts", never)
    monkeypatch.setattr(score, "_beyond", never)
    monkeypatch.setattr(score, "Counter", never)

    assert score._shape(field, key, found) == "different"
