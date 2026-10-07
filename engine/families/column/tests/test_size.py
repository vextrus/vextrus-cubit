"""The size label's grammar and its units (engine/families/column/size.py)."""

from decimal import Decimal

import pytest

from engine.families.column import size


@pytest.mark.parametrize(
    ("text", "b", "d", "unit"),
    [
        ("250x500", "250", "500", None),
        ("250 X 500", "250", "500", None),
        ("250\u00d7500", "250", "500", None),
        ('10"x20"', "10", "20", "in"),
        ('10x20"', "10", "20", "in"),
        ("10''x20''", "10", "20", "in"),
        ("300mm x 600mm", "300", "600", "mm"),
        ("0.3m x 0.6m", "0.3", "0.6", "m"),
        ("1'-0\" x 1'-6\"", "12", "18", "in"),
        ('C1 (12"x18")', "12", "18", "in"),
        ("12.5x18", "12.5", "18", None),
    ],
)
def test_a_size_label_gives_b_then_d_as_written(text: str, b: str, d: str, unit: str | None) -> None:
    found = size.parse(text)

    assert found is not None
    assert (found.b, found.d, found.unit) == (Decimal(b), Decimal(d), unit)
    assert found.text == text


@pytest.mark.parametrize("text", ["C1", "A", "12", "GF", "x", "250 x", "0x500", "1.2.3x4"])
def test_a_text_without_two_lengths_states_no_size(text: str) -> None:
    assert size.parse(text) is None


def test_mixed_units_on_one_label_meet_in_millimetres() -> None:
    found = size.parse('10" x 500mm')

    assert found is not None
    assert (found.b, found.d, found.unit) == (Decimal("254.0"), Decimal("500"), "mm")


def test_inches_convert_exactly_into_millimetre_drawing_units() -> None:
    found = size.parse('10"x20"')
    assert found is not None

    assert size.to_drawing(found, "in", "mm") == (Decimal("254"), Decimal("508"))


def test_millimetres_convert_into_inch_drawing_units_to_six_places() -> None:
    found = size.parse("250x500")
    assert found is not None

    assert size.to_drawing(found, "mm", "in") == (Decimal("9.84252"), Decimal("19.685039"))


def test_a_bare_label_takes_the_unit_nearer_its_outline() -> None:
    bare = size.parse("10x20")
    assert bare is not None

    assert size.resolve(bare, "mm", (254.0, 508.0)) == "in"
    assert size.resolve(bare, "mm", (10.0, 20.0)) == "mm"


def test_a_bare_label_without_an_outline_goes_by_its_magnitude() -> None:
    small, large = size.parse("12x18"), size.parse("300x600")
    assert small is not None
    assert large is not None

    assert size.resolve(small, "mm", None) == "in"
    assert size.resolve(large, "mm", None) == "mm"


def test_the_plans_unit_follows_its_labels_not_a_wrong_insunits() -> None:
    labelled = [(size.parse("250x500"), (250.0, 500.0)), (size.parse('10"x20"'), (254.0, 508.0))]

    assert size.drawing_unit(6, [(s, o) for s, o in labelled if s is not None]) == "mm"


def test_an_inch_plan_is_read_as_inches() -> None:
    sized = size.parse('12"x18"')
    assert sized is not None

    assert size.drawing_unit(0, [(sized, (18.0, 12.0))]) == "in"


def test_with_no_label_the_plan_keeps_its_insunits_or_millimetres() -> None:
    assert size.drawing_unit(1, []) == "in"
    assert size.drawing_unit(0, []) == "mm"


def test_plain_writes_no_exponent_or_trailing_zero() -> None:
    assert str(size.plain(Decimal("254.000"))) == "254"
    assert str(size.plain(Decimal("0.2540"))) == "0.254"
    assert str(size.plain(Decimal("1200"))) == "1200"


def test_a_long_hostile_text_is_parsed_in_linear_time() -> None:
    import time

    started = time.perf_counter()
    assert size.parse("1" * 5000 + "x" + " " * 5000 + "y") is None
    assert size.parse("1'" * 3000) is None
    assert time.perf_counter() - started < 1.0


def test_a_label_ending_a_sentence_keeps_its_size_and_unit() -> None:
    feet = size.parse("1'-0\" x 1'-6\".")
    metric = size.parse("300x600mm.")
    bare = size.parse("250 x 500.")

    assert feet is not None
    assert (feet.b, feet.d, feet.unit) == (Decimal(12), Decimal(18), "in")
    assert metric is not None
    assert metric.unit == "mm"
    assert bare is not None
    assert (bare.b, bare.d) == (Decimal(250), Decimal(500))


def test_a_text_far_longer_than_a_label_is_not_parsed() -> None:
    import time

    started = time.perf_counter()
    assert size.parse("1" + " " * 20000 + "x") is None
    assert size.parse("1'" + " " * 20000 + "x") is None
    assert time.perf_counter() - started < 0.5


def test_a_length_no_column_has_is_no_size() -> None:
    assert size.parse("9" * 40 + "x1") is None
    assert size.parse("100000x300") is None
