"""S14-AL (#458; factory-next.md 8, row 7): `acceptance-lint` across the open tickets: "ruling register
diff, union of open tickets". Its acceptance check: "fixtures: contradictory pins in two tickets exit
non-zero naming both".

Each ticket here is well formed alone (it passes the lint by itself); the contradiction is only between
two tickets, or between a ticket and a ruling recorded on main. The `pin:` line and the register's
`ruling:` line are this ticket's seam: `_fixture.py` says them.
"""

from __future__ import annotations

from pathlib import Path

from ._fixture import lint, make_repo, said, ticket

KEY = "storeys.count"
RULINGS = (
    f'# Owner rulings\n\n## Q1, 1 Oct 2026\n\n"Count three storeys." (the owner)\n\nruling: {KEY} = 3\n'
)


def test_two_tickets_pinning_one_key_to_different_values_fail_naming_both(tmp_path: Path) -> None:
    root = make_repo(tmp_path)
    ticket(root, "s91-aa", "ts91aa", pins=(f"{KEY} = 3",))
    ticket(root, "s91-bb", "ts91bb", pins=(f"{KEY} = 4",))
    for alone in ("s91-aa", "s91-bb"):
        done = lint(root, "main", alone)
        assert done.returncode == 0, said(done)

    done = lint(root, "main", "s91-aa", "s91-bb")

    output = said(done)
    assert done.returncode == 1, output
    assert "Traceback" not in output, output
    assert "s91-aa" in output, output
    assert "s91-bb" in output, output
    assert KEY in output, output


def test_two_tickets_pinning_one_key_to_the_same_value_pass(tmp_path: Path) -> None:
    root = make_repo(tmp_path, rulings=RULINGS)
    ticket(root, "s91-aa", "ts91aa", pins=(f"{KEY} = 3",))
    ticket(root, "s91-bb", "ts91bb", pins=(f"{KEY} = 3", "storeys.basements = 1"))

    done = lint(root, "main", "s91-aa", "s91-bb")

    assert done.returncode == 0, said(done)


def test_a_pin_contradicting_a_recorded_owner_ruling_fails_naming_the_ticket_and_the_key(
    tmp_path: Path,
) -> None:
    root = make_repo(tmp_path, rulings=RULINGS)
    ticket(root, "s91-aa", "ts91aa", pins=(f"{KEY} = 4",))

    done = lint(root, "main", "s91-aa")

    output = said(done)
    assert done.returncode == 1, output
    assert "Traceback" not in output, output
    assert "s91-aa" in output, output
    assert KEY in output, output
