"""17's stated scales, read by the default view conventions' patterns (invented texts)."""

import pytest

from engine.recognise import scales, views

PATTERNS = views.default_conventions().scale_patterns


@pytest.mark.parametrize(
    ("text", "stated", "ratio", "nts"),
    [
        ("SCALE 1:100", "1:100", 100.0, False),
        ("scale : 1 : 50", "1 : 50", 50.0, False),
        ("GROUND FLOOR PLAN (1:200)", "1:200", 200.0, False),
        ('1/8" = 1\'-0"', '1/8" = 1\'-0"', 96.0, False),
        ("1/4\"=1'", "1/4\"=1'", 48.0, False),
        ("N.T.S.", "N.T.S.", None, True),
        ("NTS", "NTS", None, True),
        ("NOT TO SCALE", "NOT TO SCALE", None, True),
        ("SCALE 1:0", "1:0", None, False),  # no ratio from a zero
        ("0:100", "0:100", None, False),
    ],
)
def test_a_stated_scale(text: str, stated: str, ratio: float | None, nts: bool) -> None:
    found = scales.read(text, PATTERNS)
    assert found is not None
    assert (found.stated, found.ratio, found.not_to_scale) == (stated, ratio, nts)


@pytest.mark.parametrize("text", ["GROUND FLOOR PLAN", "SECTION A-A", "CONSTANTS", "", "1" * 5000])
def test_a_text_with_no_scale(text: str) -> None:
    assert scales.read(text, PATTERNS) is None


def test_a_ratio_past_the_bound_is_kept_as_stated_with_none() -> None:
    found = scales.read("1:9999999", PATTERNS)
    assert found is not None
    assert found.ratio is None


def test_a_figure_that_is_not_one_is_none() -> None:
    assert scales._figure("1/0") is None
    assert scales._figure("x") is None
    assert scales._figure("1" * 20) is None
