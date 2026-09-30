"""Ticket 24g, R1 "Kinds": "the scorer folds `_` to a space and maps `3d/perspective` (and `3d`,
`perspective`) to one kind before comparing. A correction of spelling, not a tuned threshold."

The keys write a kind as the key brief lists it ("title block", "key plan", "3D/perspective"); the
export writes the engine's words (`title_block`, `key_plan`, `perspective`). A key view and an export
view with identical boxes and the same kind in the two spellings join. The join rule (kind + IoU >= 0.8)
is unchanged, so two different kinds still do not join.

Invented keys and exports only.
"""

from pathlib import Path

import pytest

from tools.scorer.tests.acceptance.t24s.runs import Place, export_view, key_view

from .sets import one_sheet, shown, total

BOX = [10.0, 10.0, 110.0, 110.0]


@pytest.mark.parametrize(
    ("key_kind", "export_kind"),
    [
        ("title block", "title_block"),
        ("key plan", "key_plan"),
        ("3D/perspective", "perspective"),
        ("3D", "perspective"),
        ("perspective", "perspective"),
    ],
)
def test_a_key_kind_and_the_exports_spelling_of_it_join(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], key_kind: str, export_kind: str
) -> None:
    place = Place(tmp_path)
    one_sheet(
        place,
        [key_view(BOX, "View A", kind=key_kind)],
        [export_view(BOX, "View A", kind=export_kind)],
    )

    assert place.score() == 0
    output = shown(capfd)
    assert total(output, "views", 1, 1), output
    assert "a view missing" not in output
    assert total(output, "sheets", 1, 1), output


@pytest.mark.parametrize(
    ("key_kind", "export_kind"),
    [
        ("title block", "key_plan"),
        ("key plan", "plan"),
        ("3D/perspective", "plan"),
    ],
)
def test_two_different_kinds_still_do_not_join(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], key_kind: str, export_kind: str
) -> None:
    place = Place(tmp_path)
    one_sheet(
        place,
        [key_view(BOX, "View A", kind=key_kind)],
        [export_view(BOX, "View A", kind=export_kind)],
    )

    assert place.score() == 0
    output = shown(capfd)
    assert total(output, "views", 0, 1), output
    assert "a view missing" in output
