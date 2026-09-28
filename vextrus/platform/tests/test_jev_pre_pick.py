"""`pre_pick` (ticket 15; m0-screens 5 and 6.7, screens.md Takeoff ruling 2): an option is picked for
the QS only when two independent sources name it and no counted source names another; Jev's answer is
one source at any confidence and never counts beside a source read from a fact it was given; with Jev
unavailable, the others decide."""

from decimal import Decimal

import pytest

from engine.messages import MessageCode
from vextrus.platform.services import jev

SAYS = MessageCode("platform.jev.test_source")()
LIST = jev.Source("beam_layout", frozenset({"drawing_list"}), SAYS)
PLOT = jev.Source("beam_layout", frozenset({"plot_page"}), SAYS)
PLOT_DISSENTS = jev.Source("slab_layout", frozenset({"plot_page"}), SAYS)
TITLE_RULE = jev.Source("beam_layout", frozenset({"title"}), SAYS)
TITLE_RULE_DISSENTS = jev.Source("slab_layout", frozenset({"title"}), SAYS)
VIEWS_AND_LIST = jev.Source("beam_layout", frozenset({"view_titles", "drawing_list"}), SAYS)
LIST_PASTED = jev.Source("beam_layout", frozenset({"drawing_list"}), SAYS)
DOWN = jev.Unavailable(jev.Why.TIMED_OUT)


def answer(choice: str = "beam_layout", confidence: str = "0.97") -> jev.Judgement:
    options = ("beam_layout", "slab_layout", "other")
    probabilities = tuple(
        (option, Decimal(confidence) if option == choice else Decimal(0)) for option in options
    )
    return jev.Judgement("sheet_type", "jev-1.13.0", choice, Decimal(confidence), probabilities)


def test_jev_and_an_independent_source_agreeing_pick_the_option_naming_both() -> None:
    jev_said = answer()

    picked = jev.pre_pick(jev_said, [LIST])

    assert picked == jev.PrePick("beam_layout", (LIST, jev.jev_source(jev_said)))
    assert jev.jev_source(jev_said).says == {"code": "platform.jev.sheet_type_source", "params": {}}
    assert jev.jev_source(jev_said).read_from == frozenset({"title", "discipline", "view_titles"})


@pytest.mark.parametrize("confidence", ["0.05", "0.43", "1"])
def test_jev_counts_as_one_source_at_any_confidence(confidence: str) -> None:
    picked = jev.pre_pick(answer(confidence=confidence), [LIST])

    assert picked is not None
    assert picked.option == "beam_layout"


def test_jev_alone_picks_nothing() -> None:
    assert jev.pre_pick(answer(), []) is None


@pytest.mark.parametrize("beside", [TITLE_RULE, VIEWS_AND_LIST])
def test_a_source_read_from_a_fact_jev_was_given_never_counts_beside_it(beside: jev.Source) -> None:
    assert jev.pre_pick(answer(), [beside]) is None


def test_a_dependent_source_is_dropped_beside_jev_neither_agreeing_nor_dissenting() -> None:
    jev_said = answer()

    picked = jev.pre_pick(jev_said, [TITLE_RULE_DISSENTS, LIST])

    assert picked == jev.PrePick("beam_layout", (LIST, jev.jev_source(jev_said)))


@pytest.mark.parametrize(
    "sources",
    [[LIST, PLOT_DISSENTS], [PLOT_DISSENTS, LIST, PLOT]],
)
def test_an_independent_source_dissenting_means_no_pick(sources: list[jev.Source]) -> None:
    assert jev.pre_pick(answer(), sources) is None


def test_jev_dissenting_from_two_agreeing_sources_means_no_pick() -> None:
    assert jev.pre_pick(answer("slab_layout"), [LIST, PLOT]) is None


def test_with_jev_unavailable_the_others_decide() -> None:
    assert jev.pre_pick(DOWN, [LIST, PLOT]) == jev.PrePick("beam_layout", (LIST, PLOT))
    # the title's own reading counts when Jev has not read it
    assert jev.pre_pick(DOWN, [TITLE_RULE, LIST]) == jev.PrePick("beam_layout", (TITLE_RULE, LIST))
    assert jev.pre_pick(DOWN, [LIST]) is None
    assert jev.pre_pick(DOWN, []) is None
    assert jev.pre_pick(DOWN, [LIST, PLOT_DISSENTS]) is None


def test_two_sources_read_from_one_thing_are_one_source() -> None:
    assert jev.pre_pick(DOWN, [LIST, LIST_PASTED]) is None
    assert jev.pre_pick(DOWN, [LIST, VIEWS_AND_LIST]) is None
    assert jev.pre_pick(DOWN, [LIST, LIST_PASTED, PLOT]) == jev.PrePick(
        "beam_layout", (LIST, LIST_PASTED, PLOT)
    )


@pytest.mark.parametrize("read_from", [frozenset(), {"drawing_list"}, ("drawing_list",)])
def test_a_source_names_what_it_was_read_from(read_from: object) -> None:
    with pytest.raises(ValueError, match="what it was read from"):
        jev.Source("beam_layout", read_from, SAYS)  # type: ignore[arg-type]
