"""Train C's join of S21-C3 and Train A's #642 fix: `title_read`'s shared `budget` (C3: one budget
the reads of a page share) is charged every comparison the read makes, the tables' building as the
walk (#642), and a read the shared budget cannot pay for is cut. Every word is invented."""

from engine.plot import registration
from engine.plot.tests.test_plot import item, page_of


def test_a_read_that_finds_no_title_still_charges_the_shared_budget_its_tables() -> None:
    page = page_of(
        *(item(f"INVENTED SLAB {k}", 7.0, (10.0, 30.0 + 10 * k, 90.0, 37.0 + 10 * k)) for k in range(5))
    )
    budget = [1000]

    read = registration.title_read(page, "INVENTED SLAB PLAN", budget)

    assert read == registration.TitleRead(False)
    assert budget[0] < 1000


def test_a_spent_shared_budget_cuts_the_next_read_unread() -> None:
    page = page_of(item("INVENTED SLAB PLAN", 7.0, (10.0, 30.0, 90.0, 37.0)))

    assert registration.title_read(page, "INVENTED SLAB PLAN", [0]) == registration.TitleRead(
        False, cut=True
    )
    assert registration.title_read(page, "INVENTED SLAB PLAN") == registration.TitleRead(True)


def test_a_shared_budget_too_small_for_the_tables_cuts_the_read() -> None:
    page = page_of(
        *(item(f"INVENTED SLAB {k}", 7.0, (10.0, 30.0 + 10 * k, 90.0, 37.0 + 10 * k)) for k in range(50))
    )

    assert registration.title_read(page, "INVENTED SLAB PLAN", [3]).cut
