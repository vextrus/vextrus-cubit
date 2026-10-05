"""Ticket T-249 (PR A), A2 case 4: the shape of a wrong Sheet field, for a Development Set only, per
field and per Discipline (the key's), in closed words and counts (section 3, A2):

- storeys: `export blank | export lists more | export lists fewer | same storeys, other order |
  different`;
- title: `export blank | key inside export | export inside key | different`;
- Discipline: key -> export pairs (a closed list, the engine's Discipline keys of
  `engine/recognise/conventions/sheet-default.json`, else `another Discipline`);
- date: `export blank | day and month swapped | year differs | different`;
- number: `export blank | different`.

The ticket fixes the words, not the line's layout: a line is read as holding the Discipline, the
field, the shape and the count (`: 1` at its end), never " / ". One wrong Sheet of each shape;
invented values only.
"""

import json
import re
from pathlib import Path
from typing import Any

import pytest

from .places import Place, export_sheet, export_view, key_sheet, key_view, new_lines

ROOT = Path(__file__).resolve().parents[5]
DISCIPLINES = [
    d["key"]
    for d in json.loads(
        (ROOT / "engine" / "recognise" / "conventions" / "sheet-default.json").read_text()
    )["disciplines"]
]
BOX = [20.0, 20.0, 120.0, 120.0]
TITLE = "Made-up transfer girder layout"
STOREYS = "fifth floor, sixth floor"
DATE = "04.09.2025"
NUMBER = "QZ-520"


def one(layout: str, **wrong: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    """A key sheet and its export, right in every field but those given (the export's values)."""
    key = key_sheet(
        layout,
        NUMBER + layout[-2:],
        TITLE,
        "",
        [key_view(BOX, "Made-up girder plan")],
        date=DATE,
    )
    key["storeys"] = ["fifth floor", "sixth floor"]  # a key keeps storeys as a list
    export = export_sheet(
        layout,
        wrong.get("number", NUMBER + layout[-2:]),
        wrong.get("title", TITLE),
        wrong.get("storeys", STOREYS),
        [export_view(BOX, "Made-up girder plan")],
    )
    if "date" in wrong:
        export["issue_date"] = (
            None if wrong["date"] is None else {"value": wrong["date"], "source": "title_block_text"}
        )
    else:
        export["issue_date"] = {"value": DATE, "source": "title_block_text"}
    for name in ("number", "title", "storeys_as_stated"):
        field = "storeys" if name == "storeys_as_stated" else name
        if field in wrong and wrong[field] is None:
            export[name] = None
    if "discipline" in wrong:
        export["discipline"] = {"value": wrong["discipline"], "source": "file"}
    return key, export


SHAPES: dict[str, tuple[str, str, dict[str, Any]]] = {
    # name: (field word, shape words, the export's wrong value)
    "storeys blank": ("storeys", "export blank", {"storeys": None}),
    "storeys more": (
        "storeys",
        "export lists more",
        {"storeys": "fifth floor, sixth floor, seventh floor"},
    ),
    "storeys fewer": ("storeys", "export lists fewer", {"storeys": "sixth floor"}),
    "storeys order": ("storeys", "same storeys, other order", {"storeys": "sixth floor, fifth floor"}),
    "storeys different": ("storeys", "different", {"storeys": "mezzanine, podium"}),
    "title blank": ("title", "export blank", {"title": None}),
    "title key inside": ("title", "key inside export", {"title": TITLE + " and sections"}),
    "title export inside": ("title", "export inside key", {"title": "transfer girder layout"}),
    "title different": ("title", "different", {"title": "Made-up lift pit plan"}),
    "date blank": ("date", "export blank", {"date": None}),
    "date swapped": ("date", "day and month swapped", {"date": "09.04.2025"}),
    "date year": ("date", "year differs", {"date": "04.09.2024"}),
    "date different": ("date", "different", {"date": "21.10.2025"}),
    "number blank": ("number", "export blank", {"number": None}),
    "number different": ("number", "different", {"number": "QZ-777"}),
}


def run(
    place: Place, pairs: list[tuple[dict[str, Any], dict[str, Any]]], *, held_out: bool = False
) -> None:
    place.write_keys([key for key, _ in pairs], held_out=held_out)
    place.write_run([export for _, export in pairs])


def shown(place: Place, capfd: pytest.CaptureFixture[str]) -> str:
    assert place.score() == 0
    captured = capfd.readouterr()
    return captured.out + captured.err


def said(lines: list[str], *words: str) -> list[str]:
    """The lines holding each of `words` (each a whole phrase, in any order), ending in a count."""

    def holds(line: str, phrase: str) -> bool:
        return re.search(rf"(?<![\w-]){re.escape(phrase)}(?![\w-])", line) is not None

    return [
        line for line in lines if all(holds(line, w) for w in words) and re.search(r":\s*\d+$", line)
    ]


def test_each_wrong_field_is_said_by_its_shape_and_discipline(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    names = sorted(SHAPES)
    run(place, [one(f"Tab F{n:02d}", **SHAPES[name][2]) for n, name in enumerate(names, 10)])

    output = shown(place, capfd)
    lines = new_lines(output)

    assert not [line for line in lines if " / " in line]
    for name in names:
        field, shape, _wrong = SHAPES[name]
        found = said(lines, "structural", field, shape)
        assert len(found) == 1, (name, lines)
        assert found[0].endswith(": 1"), (name, found)


def test_a_wrong_discipline_is_said_as_its_key_to_export_pair(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    run(place, [one("Tab F01", discipline="plumbing"), one("Tab F02", discipline="plumbing")])

    lines = new_lines(shown(place, capfd))

    found = [line for line in lines if re.search(r"(?<![\w-])structural -> plumbing: 2$", line)]
    assert len(found) == 1, lines


@pytest.mark.parametrize("discipline", DISCIPLINES)
def test_every_engine_discipline_is_named_and_any_other_is_another_discipline(
    discipline: str, tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    """The scorer's closed list equals the engine's Discipline keys (a copy, as SUBJECTS is)."""
    place = Place(tmp_path)
    other = "architectural" if discipline != "architectural" else "structural"
    key, export = one("Tab F03", discipline=other)
    key["discipline"] = discipline
    key2, export2 = one("Tab F04", discipline=discipline)
    key2["discipline"] = "Qx Invented Trade"
    run(place, [(key, export), (key2, export2)])

    lines = new_lines(shown(place, capfd))

    assert [line for line in lines if re.search(rf"(?<![\w-]){discipline} -> {other}: 1$", line)], lines
    assert [line for line in lines if re.search(rf"another Discipline -> {discipline}: 1$", line)], lines
    assert "qx invented trade" not in "\n".join(lines).casefold()


def test_a_held_out_set_says_no_field_shape(tmp_path: Path, capfd: pytest.CaptureFixture[str]) -> None:
    place = Place(tmp_path)
    run(place, [one("Tab F05", title="Made-up lift pit plan")], held_out=True)

    output = shown(place, capfd)

    assert "different" not in output
    assert len(output.splitlines()) == 4  # the head, the set, its two totals
