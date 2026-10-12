"""A key phrase naming site works is read against the export view's Steps (S22-FL7, review 3 of #684):
the engine never gives site works as a view's subject; it proposes the view for Step 14. Invented
keys and exports only."""

from pathlib import Path

import pytest

from tools.scorer.tests.acceptance.t24g.sets import one_sheet, shown, total
from tools.scorer.tests.acceptance.t24s.runs import Place, export_view, key_view

A_BOX = [10.0, 10.0, 110.0, 110.0]


def score(tmp_path: Path, phrase: str, export: dict[str, object]) -> str:
    place = Place(tmp_path)
    one_sheet(place, [key_view(A_BOX, "View A", subject=phrase)], [export])
    assert place.score() == 0
    return ""


@pytest.mark.parametrize(
    ("phrase", "subject", "steps", "right"),
    [
        ("site works layout", None, ["site_mep"], True),  # alone: no subject, Step 14
        ("site works layout", "column", ["columns", "site_mep"], True),  # beside a column
        ("site works layout", "site_works", [], True),  # a hand-made export's subject
        ("site works layout", None, [], False),  # no Step 14, no subject
        ("site works layout", "column", ["columns"], False),  # a column alone
        ("column layout", "column", ["columns", "site_mep"], True),  # unchanged
        ("column layout", None, ["site_mep"], False),  # Step 14 is no column
    ],
)
def test_a_site_works_phrase_is_read_against_step_14(
    tmp_path: Path,
    capfd: pytest.CaptureFixture[str],
    phrase: str,
    subject: str | None,
    steps: list[str],
    right: bool,
) -> None:
    view = {**export_view(A_BOX, "View A", subject=subject or ""), "subject": subject, "steps": steps}
    score(tmp_path, phrase, view)
    output = shown(capfd)
    assert total(output, "view subjects", 1 if right else 0, 1), output
