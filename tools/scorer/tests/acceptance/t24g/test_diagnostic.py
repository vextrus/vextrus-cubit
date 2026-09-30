"""Ticket 24g, R1 "Diagnostic": "(Development Sets only; general terms and counts only, never a key
value): per sheet "k missing views of kind X"; per set, unjoined key views by cause (no export view of
that kind / same kind best IoU 0.5-0.8 / 0.2-0.5 / <0.2 / other kind at ≥0.8), unjoined export views by
kind in the same buckets, joins if frame corners were aligned, joined views with no export subject.
Held-out: totals only, unchanged." And: "The join rule (kind + IoU ≥ 0.8, paper-scaled, no shift) is
unchanged."

One invented Development Set sheet whose unjoined key views fall in distinct numbers into each cause
that cannot overlap another (2 with no export view of their kind, 1 at a best same-kind IoU of 0.6, 3 at
0.33, 4 at 0), and whose joined views include 2 with no export subject. The ruling words the causes but
not the lines; a cause's line is found by the ruling's own label and its count beside it.

Invented keys and exports only.
"""

import re
from pathlib import Path

import pytest

from tools.scorer.tests.acceptance.t24s.runs import (
    JSON,
    Place,
    export_sheet,
    export_view,
    key_sheet,
    key_view,
)

from .sets import shown, total, unsubjected_view

# Key values that must never be shown: the sheet's fields, each view's title and subject phrase, and
# every number of every key box (all end in .37 or .87, which no count can be).
NUMBER = "QZ-6613"
TITLE = "Invented quarry plan"
STOREYS = "eleventh floor"
TITLE_PREFIX = "Marlowe view"
IN_VOCABULARY = "column layout"
OUTSIDE = "furniture arrangement"


def box(column: int, row: int, shift: float = 0.0) -> list[float]:
    """A 100 mm square at a grid place 300 mm apart; `shift` moves it right (a same-size box moved
    by d has an IoU of (100 - d) / (100 + d): 25 gives 0.6, 50 gives 0.33)."""
    x, y = 20.37 + 300.0 * column + shift, 20.87 + 300.0 * row
    return [x, y, x + 100.0, y + 100.0]


def messy_views() -> tuple[list[JSON], list[JSON]]:
    """The key's views and the export's, as described in the module's docstring."""
    keyed: list[JSON] = []
    found: list[JSON] = []

    def key(place: list[float], kind: str, subject: str = "slab") -> None:
        keyed.append(key_view(place, f"{TITLE_PREFIX} {len(keyed) + 1}", kind=kind, subject=subject))

    # Joined: two plans with no export subject; a title block (the key's spelling) with an export one.
    for column in (0, 1):
        key(box(column, 0), "plan", IN_VOCABULARY)
        found.append(unsubjected_view(box(column, 0), "Plan", kind="plan"))
    key(box(2, 0), "title block", OUTSIDE)
    found.append(export_view(box(2, 0), "Title block", kind="title_block", subject="slab"))
    # Unjoined, no export view of that kind: two sections.
    for column in (0, 1):
        key(box(column, 1), "section")
    # Unjoined, same kind best IoU 0.5-0.8: one plan (its export plan moved 25 mm, IoU 0.6).
    key(box(3, 0), "plan")
    found.append(export_view(box(3, 0, shift=25.0), "Plan", kind="plan"))
    # Unjoined, same kind best IoU 0.2-0.5: three details (each export detail moved 50 mm, IoU 0.33).
    for column in (0, 1, 2):
        key(box(column, 2), "detail")
        found.append(export_view(box(column, 2, shift=50.0), "Detail", kind="detail"))
    # Unjoined, same kind best IoU < 0.2: four schedules, the export's one schedule far from them all.
    for column in (0, 1, 2, 3):
        key(box(column, 3), "schedule")
    found.append(export_view(box(9, 9), "Schedule", kind="schedule"))
    return keyed, found


def messy_set(place: Place, *, held_out: bool = False) -> None:
    keyed, found = messy_views()
    place.write_keys([key_sheet("Sheet A", NUMBER, TITLE, STOREYS, keyed)], held_out=held_out)
    place.write_run([export_sheet("Sheet A", "AB-100", "Other plan", "ground floor", found)])


def count_beside(output: str, label: str, n: int) -> bool:
    """True when a line holds the cause's `label` (a regular expression) with the count `n` beside it:
    before it ("4 ... <0.2") or right after it ("<0.2: 4")."""
    before = rf"(?im)^.*(?<![\d.])\b{n}\b(?![.\d])[^\d\n]{{0,60}}{label}"
    after = rf"(?im)^.*{label}[^\d\n]{{0,8}}(?<![\d.])\b{n}\b(?![.\d])"
    return re.search(before, output) is not None or re.search(after, output) is not None


NO_VIEW_OF_THAT_KIND = r"no export views? of (?:that|its|the same|this) kind"
IOU_05_08 = r"0\.5\s*(?:\u2013|-|to)\s*0\.8"
IOU_02_05 = r"0\.2\s*(?:\u2013|-|to)\s*0\.5"
IOU_BELOW_02 = r"(?:<|below|under)\s*0\.2\b"
NO_EXPORT_SUBJECT = r"no export subject"


def test_each_sheet_says_how_many_views_of_each_kind_are_missing(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    messy_set(place)

    assert place.score() == 0
    output = shown(capfd)
    assert "2 missing views of kind section" in output, output
    assert "3 missing views of kind detail" in output, output
    assert "4 missing views of kind schedule" in output, output


def test_unjoined_key_views_with_no_export_view_of_that_kind_are_counted(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    messy_set(place)

    place.score()
    output = shown(capfd)
    assert count_beside(output, NO_VIEW_OF_THAT_KIND, 2), output


@pytest.mark.parametrize(
    ("label", "n"),
    [(IOU_05_08, 1), (IOU_02_05, 3), (IOU_BELOW_02, 4)],
    ids=["0.5-0.8", "0.2-0.5", "below 0.2"],
)
def test_unjoined_key_views_are_counted_by_their_best_same_kind_iou(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], label: str, n: int
) -> None:
    place = Place(tmp_path)
    messy_set(place)

    place.score()
    output = shown(capfd)
    assert count_beside(output, label, n), output


def test_joined_views_with_no_export_subject_are_counted(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    messy_set(place)

    place.score()
    output = shown(capfd)
    assert count_beside(output, NO_EXPORT_SUBJECT, 2), output


def test_the_join_rule_is_unchanged_by_the_diagnostic(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    messy_set(place)

    place.score()
    output = shown(capfd)
    # 13 key views; only the two plans and the title block join (kind folded, IoU >= 0.8, no shift).
    assert total(output, "views", 3, 13), output
    assert total(output, "view subjects", 0, 2), output
    assert "subjects outside the vocabulary: 1" in output, output


def test_the_diagnostic_shows_no_key_value(tmp_path: Path, capfd: pytest.CaptureFixture[str]) -> None:
    place = Place(tmp_path)
    messy_set(place)

    place.score()
    output = shown(capfd) + place.logged()
    assert "missing views of kind" in output  # the diagnostic did run
    keyed, _found = messy_views()
    secrets = [NUMBER, TITLE, STOREYS, TITLE_PREFIX, IN_VOCABULARY, OUTSIDE]
    for view in keyed:
        for number in view["box"]:
            secrets += [f"{number}", f"{number:.1f}", f"{number:.2f}", f"{number:g}"]
    for secret in secrets:
        assert secret.casefold() not in output.casefold(), secret
