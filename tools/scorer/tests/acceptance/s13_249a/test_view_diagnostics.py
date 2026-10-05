"""Ticket T-249 (PR A), A2 cases 1-3, 5 and 6: the scorer says why a view fails, in counts and closed
words only (section 3, A2; factory §3.10: "no storeys, title, Discipline or date loop starts before
[the diagnostics] name the failing convention"). For a Development Set, after the existing
diagnostic block and never holding " / " (the log keeps only lines holding one: the totals):

1. views taken for another kind: a heading `  views taken for another kind, key kind -> export
   kind:` then one line per pair, `    <key kind> -> <export kind>: n`, or `    none`; a kind outside
   the scorer's KINDS is `another kind`;
2. the direction of a same-kind near miss (best IoU 0.2 to 0.8), per key kind: `export larger`,
   `export smaller`, `export shifted` (same size within 10 %, moved), `export overlaps otherwise`, as
   `    <key kind>: <direction>: n`;
3. failing views by class, per key kind: `missing`, `wrong kind`, `box near-miss` (0.5-0.8), `box far`
   (< 0.5), `title wrong`, `subject wrong`, as `    <key kind>: <class>: n`; a kind with no failure
   is absent.

A Held-out Set's answer is unchanged: its two totals. Invented keys and exports only.
"""

import re
from pathlib import Path

import pytest

from .places import (
    Place,
    export_sheet,
    export_view,
    key_sheet,
    key_view,
    lines_after,
    new_lines,
    old_lines,
)

HEADING = "  views taken for another kind, key kind -> export kind:"


def at(x: float, y: float, w: float = 100.0, h: float = 100.0) -> list[float]:
    return [x, y, x + w, y + h]


def shown(place: Place, capfd: pytest.CaptureFixture[str]) -> str:
    assert place.score() == 0
    captured = capfd.readouterr()
    return captured.out + captured.err


def confused(place: Place, *, held_out: bool = False) -> None:
    """Two key sections where the export drew elevations, a key schedule where it drew notes, and a
    key view of a kind outside KINDS where it drew a plan; one view joins."""
    keyed = [
        key_view(at(0, 0), "Made-up cut one", "section"),
        key_view(at(200, 0), "Made-up cut two", "section"),
        key_view(at(400, 0), "Made-up bar list", "schedule"),
        key_view(at(600, 0), "Made-up odd view", "qx folded drawing"),
        key_view(at(0, 300), "Made-up ground outline", "plan"),
    ]
    found = [
        export_view(at(0, 0), "Made-up cut one", "elevation"),
        export_view(at(200, 0), "Made-up cut two", "elevation"),
        export_view(at(400, 0), "Made-up bar list", "notes"),
        export_view(at(600, 0), "Made-up odd view", "plan"),
        export_view(at(0, 300), "Made-up ground outline", "plan"),
    ]
    place.write_keys(
        [key_sheet("Tab K1", "QZ-311", "Made-up sections sheet", "third floor", keyed)],
        held_out=held_out,
    )
    place.write_run([export_sheet("Tab K1", "QZ-311", "Made-up sections sheet", "third floor", found)])


def test_views_taken_for_another_kind_are_counted_by_pair(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    confused(place)

    pairs = lines_after(new_lines(shown(place, capfd)), HEADING)

    assert sorted(pairs) == sorted(
        [
            "    section -> elevation: 2",
            "    schedule -> notes: 1",
            "    another kind -> plan: 1",
        ]
    )


def test_no_view_taken_for_another_kind_says_none(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    views = [key_view(at(0, 0), "Made-up roof outline", "plan")]
    place.write_keys([key_sheet("Tab K2", "QZ-312", "Made-up roof sheet", "roof", views)])
    place.write_run(
        [
            export_sheet(
                "Tab K2",
                "QZ-312",
                "Made-up roof sheet",
                "roof",
                [export_view(at(0, 0), "Made-up roof outline", "plan")],
            )
        ]
    )

    assert lines_after(new_lines(shown(place, capfd)), HEADING) == ["    none"]


def directions(place: Place) -> None:
    """Key elevations, each with one export elevation at a near miss of its own, far from the
    others: larger (IoU 0.5), smaller (0.64), shifted (0.538), otherwise (0.387); a key detail at
    exactly IoU 0.2 (larger, counted) and one at exactly 0.8 (it joins, so it is not counted)."""
    keyed = [
        key_view(at(0, 0), "Made-up east face", "elevation"),
        key_view(at(1000, 0), "Made-up west face", "elevation"),
        key_view(at(2000, 0), "Made-up north face", "elevation"),
        key_view(at(3000, 0), "Made-up south face", "elevation"),
        key_view(at(0, 1000), "Made-up sill", "detail"),
        key_view(at(1000, 1000), "Made-up coping", "detail"),
    ]
    found = [
        export_view([0.0, 0.0, 100.0, 200.0], "Made-up east face", "elevation"),  # contains: 0.5
        export_view([1010.0, 10.0, 1090.0, 90.0], "Made-up west face", "elevation"),  # inside: 0.64
        export_view([2030.0, 0.0, 2130.0, 100.0], "Made-up north face", "elevation"),  # moved
        export_view([3020.0, 20.0, 3140.0, 80.0], "Made-up south face", "elevation"),  # neither
        export_view([0.0, 1000.0, 100.0, 1500.0], "Made-up sill", "detail"),  # contains: 0.2
        export_view([1000.0, 1000.0, 1100.0, 1125.0], "Made-up coping", "detail"),  # 0.8: joins
    ]
    place.write_keys([key_sheet("Tab K3", "QZ-313", "Made-up faces sheet", "first floor", keyed)])
    place.write_run([export_sheet("Tab K3", "QZ-313", "Made-up faces sheet", "first floor", found)])


def test_a_near_miss_is_counted_by_the_direction_of_the_export_box(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    directions(place)

    lines = new_lines(shown(place, capfd))

    for line in (
        "    elevation: export larger: 1",
        "    elevation: export smaller: 1",
        "    elevation: export shifted: 1",
        "    elevation: export overlaps otherwise: 1",
        "    detail: export larger: 1",
    ):
        assert lines.count(line) == 1, (line, lines)
    said = [line for line in lines if re.match(r"^    detail: export ", line)]
    assert said == ["    detail: export larger: 1"], lines  # the view at IoU 0.8 joined


def classes(place: Place) -> None:
    """One failing key view of each class, each of its own kind, and a kind (key plan) whose one
    view joins with its title and subject right."""
    keyed = [
        key_view(at(0, 0), "Made-up symbols", "legend", "slab"),
        key_view(at(200, 0), "Made-up bar bending", "schedule", "beam"),
        key_view(at(400, 0), "Made-up upper outline", "plan", "slab"),
        key_view(at(600, 0), "Made-up cut through", "section", "stair"),
        key_view(at(800, 0), "Made-up corbel", "detail", "column"),
        key_view(at(1000, 0), "Made-up rear face", "elevation", "shear wall"),
        key_view(at(1200, 0), "Made-up location", "key plan", "grid"),
    ]
    found = [
        export_view(at(200, 0), "Made-up bar bending", "notes", "beam"),  # wrong kind
        export_view([400.0, 0.0, 500.0, 160.0], "Made-up upper outline", "plan", "slab"),  # 0.625
        export_view([600.0, 0.0, 700.0, 300.0], "Made-up cut through", "section", "stair"),  # 0.33
        export_view(at(800, 0), "Made-up corbel, other", "detail", "column"),  # title wrong
        export_view(at(1000, 0), "Made-up rear face", "elevation", "beam"),  # subject wrong
        export_view(at(1200, 0), "Made-up location", "key plan", "grid"),  # right
    ]
    place.write_keys([key_sheet("Tab K4", "QZ-314", "Made-up mixed sheet", "fourth floor", keyed)])
    place.write_run([export_sheet("Tab K4", "QZ-314", "Made-up mixed sheet", "fourth floor", found)])


def test_failing_views_are_counted_by_class_per_key_kind(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    classes(place)

    lines = new_lines(shown(place, capfd))

    for line in (
        "    legend: missing: 1",
        "    schedule: wrong kind: 1",
        "    plan: box near-miss: 1",
        "    section: box far: 1",
        "    detail: title wrong: 1",
        "    elevation: subject wrong: 1",
    ):
        assert lines.count(line) == 1, (line, lines)
    assert not [line for line in lines if line.startswith("    key plan:")], lines
    assert not [line for line in lines if " / " in line]


MARKERS = (
    "QXLEAK-TITLE-4",
    "QXLEAK-NUM-4",
    "QXLEAK-STOREY-4",
    "QXLEAK-VIEW-4",
    "QXLEAK-LAYOUT-4",
    "QXLEAK-DATE-4",
)


def test_nothing_of_the_key_reaches_the_new_lines_or_the_log(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    """Key titles, numbers, storeys, dates and view titles carry markers that the export gets
    wrong; a key sheet laid out on a marked layout joins nothing (a joined sheet's layout is the
    export's own, which the answer has always named)."""
    place = Place(tmp_path)
    keyed = [
        key_view(at(0, 0), "QXLEAK-VIEW-4 one", "section", "beam"),
        key_view(at(200, 0), "QXLEAK-VIEW-4 two", "plan", "slab"),
        key_view(at(400, 0), "QXLEAK-VIEW-4 three", "qxleak kind", "slab"),
    ]
    place.write_keys(
        [
            key_sheet(
                "Tab K5",
                "QXLEAK-NUM-4",
                "QXLEAK-TITLE-4 sheet",
                "QXLEAK-STOREY-4 floor",
                keyed,
                date="QXLEAK-DATE-4",
            ),
            key_sheet(
                "QXLEAK-LAYOUT-4",
                "QXLEAK-NUM-4b",
                "QXLEAK-TITLE-4 lost",
                "QXLEAK-STOREY-4 lost",
                [key_view(at(0, 0), "QXLEAK-VIEW-4 lost", "detail")],
            ),
        ]
    )
    found = [
        export_view(at(0, 0), "Made-up other title", "elevation"),
        export_view([200.0, 0.0, 300.0, 170.0], "Made-up other plan", "plan", "beam"),
        export_view(at(400, 0), "Made-up odd one", "plan"),
    ]
    place.write_run([export_sheet("Tab K5", "QZ-399", "Made-up wrong title", "nowhere", found)])

    output = shown(place, capfd)

    lines = new_lines(output)
    assert lines_after(lines, HEADING), "the new lines are there"
    for marker in MARKERS:
        assert marker.casefold() not in output.casefold(), marker
        assert marker.casefold() not in place.logged().casefold(), marker
    assert "qxleak" not in output.casefold()  # the key's own kind, outside KINDS, too
    assert "qxleak" not in place.logged().casefold()
    assert not [line for line in lines if " / " in line]


# A2 case 6, a guard that passes on main: the scores and the existing lines are byte-equal to what
# main printed for the same fixtures (pinned from a run on main before any new line was added).

ON_MAIN = {
    "confused": """\
vx-score 20260929T130000Z-5e1f0c2a9b7d-beef: head 5e1f0c2a9b7d3e4f60718293a4b5c6d7e8f90123
invented-set: a Development Set
  sheet 1 (layout Tab K1): fail: 4 views missing; 4 extra views
    1 missing view of kind another kind
    1 missing view of kind schedule
    2 missing views of kind section
  extra sheets 0, extra views 4 (in the export only)
  unjoined key views of joined sheets, by cause:
    other kind at IoU >= 0.8: 4
    no export view of that kind: 0
    same kind, best IoU >= 0.8 (taken by another view): 0
    same kind, best IoU 0.5-0.8: 0
    same kind, best IoU 0.2-0.5: 0
    same kind, best IoU < 0.2: 0
  unjoined export views of joined sheets, by kind and cause:
    elevation: other kind at IoU >= 0.8: 2
    notes: other kind at IoU >= 0.8: 1
    plan: other kind at IoU >= 0.8: 1
  key views that would join if frame corners were aligned: no joined sheet has a frame
  joined views with no export subject: 0
  subjects outside the vocabulary: 0
  sheets         0 / 1
  views          1 / 5
  number         1 / 1
  title          1 / 1
  discipline     1 / 1
  storeys        1 / 1
  revision       1 / 1
  date           1 / 1
  view titles    1 / 1
  view subjects  1 / 1
""",
    "directions": """\
vx-score 20260929T130000Z-5e1f0c2a9b7d-beef: head 5e1f0c2a9b7d3e4f60718293a4b5c6d7e8f90123
invented-set: a Development Set
  sheet 1 (layout Tab K3): fail: 5 views missing; 5 extra views
    1 missing view of kind detail
    4 missing views of kind elevation
  extra sheets 0, extra views 5 (in the export only)
  unjoined key views of joined sheets, by cause:
    other kind at IoU >= 0.8: 0
    no export view of that kind: 0
    same kind, best IoU >= 0.8 (taken by another view): 0
    same kind, best IoU 0.5-0.8: 3
    same kind, best IoU 0.2-0.5: 2
    same kind, best IoU < 0.2: 0
  unjoined export views of joined sheets, by kind and cause:
    detail: same kind, best IoU 0.2-0.5: 1
    elevation: same kind, best IoU 0.5-0.8: 3
    elevation: same kind, best IoU 0.2-0.5: 1
  key views that would join if frame corners were aligned: no joined sheet has a frame
  joined views with no export subject: 0
  subjects outside the vocabulary: 0
  sheets         0 / 1
  views          1 / 6
  number         1 / 1
  title          1 / 1
  discipline     1 / 1
  storeys        1 / 1
  revision       1 / 1
  date           1 / 1
  view titles    1 / 1
  view subjects  1 / 1
""",
    "classes": """\
vx-score 20260929T130000Z-5e1f0c2a9b7d-beef: head 5e1f0c2a9b7d3e4f60718293a4b5c6d7e8f90123
invented-set: a Development Set
  sheet 1 (layout Tab K4): fail: 4 views missing, a view's title wrong, \
a view's subject wrong; 3 extra views
    1 missing view of kind legend
    1 missing view of kind plan
    1 missing view of kind schedule
    1 missing view of kind section
  extra sheets 0, extra views 3 (in the export only)
  unjoined key views of joined sheets, by cause:
    other kind at IoU >= 0.8: 1
    no export view of that kind: 1
    same kind, best IoU >= 0.8 (taken by another view): 0
    same kind, best IoU 0.5-0.8: 1
    same kind, best IoU 0.2-0.5: 1
    same kind, best IoU < 0.2: 0
  unjoined export views of joined sheets, by kind and cause:
    notes: other kind at IoU >= 0.8: 1
    plan: same kind, best IoU 0.5-0.8: 1
    section: same kind, best IoU 0.2-0.5: 1
  key views that would join if frame corners were aligned: no joined sheet has a frame
  joined views with no export subject: 0
  subjects outside the vocabulary: 0
  sheets         0 / 1
  views          3 / 7
  number         1 / 1
  title          1 / 1
  discipline     1 / 1
  storeys        1 / 1
  revision       1 / 1
  date           1 / 1
  view titles    2 / 3
  view subjects  2 / 3
""",
}
FIXTURES = {"confused": confused, "directions": directions, "classes": classes}


@pytest.mark.parametrize("name", sorted(FIXTURES))
def test_the_totals_and_the_existing_lines_are_what_main_prints(
    name: str, tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    FIXTURES[name](place)

    output = shown(place, capfd)

    assert old_lines(output) == ON_MAIN[name].splitlines()


def test_a_held_out_sets_answer_is_its_two_totals_as_on_main(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    confused(place, held_out=True)

    output = shown(place, capfd)

    assert output.splitlines() == ON_MAIN_HELD_OUT.splitlines()


ON_MAIN_HELD_OUT = """\
vx-score 20260929T130000Z-5e1f0c2a9b7d-beef: head 5e1f0c2a9b7d3e4f60718293a4b5c6d7e8f90123
invented-set: a Held-out Set, in aggregate only
  sheets         0 / 1
  views          1 / 5
"""
