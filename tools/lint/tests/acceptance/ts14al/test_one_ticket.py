"""S14-AL (#458; factory-next.md 8, row 7): `acceptance-lint` on one ticket's acceptance commit:
"collect, lint-imports, mypy, red on main for the stated reason, passes non-root". Its acceptance check:
"a test red for the wrong reason fails the lint".

Each defect is a minimal change to a well-formed fixture ticket that passes, and breaks one check only.
The declarations (`red-for:`, `pin:`) and the command are this ticket's seam: `_fixture.py` says them.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from ._fixture import INNER_IMPORT, MISSING, TOP_IMPORT, changed, lint, make_repo, said, ticket

BRANCH, FOLDER = "s91-aa", "ts91aa"


def refused(root: Path) -> str:
    """The lint run on the fixture ticket: it exits 1, as a verdict (not a crash), naming the ticket's
    acceptance folder. Returns what it printed."""
    done = lint(root, "main", BRANCH)
    output = said(done)
    assert done.returncode == 1, output
    assert "Traceback" not in output, output
    assert FOLDER in output, output
    return output


@pytest.mark.parametrize(
    "test", [TOP_IMPORT, INNER_IMPORT], ids=["top-level import", "import in the test"]
)
def test_a_well_formed_acceptance_commit_passes(tmp_path: Path, test: str) -> None:
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test=test)

    done = lint(root, "main", BRANCH)

    assert done.returncode == 0, said(done)


def test_a_test_file_that_does_not_collect_fails_the_lint(tmp_path: Path) -> None:
    """The plan's "collect": a data file the test reads at import is not committed (FileNotFoundError
    at collection, before the module under test is imported)."""
    root = make_repo(tmp_path)
    cases = 'CASES = (Path(__file__).parent / "cases.json").read_text()'
    broken = changed(
        TOP_IMPORT,
        '"""\n\nfrom fixturepkg',
        f'"""\n\nfrom pathlib import Path\n\n{cases}\n\nfrom fixturepkg',
    )
    ticket(root, BRANCH, FOLDER, test=broken)

    refused(root)


def test_an_acceptance_test_importing_across_a_layer_fails_the_lint(tmp_path: Path) -> None:
    """The plan's "lint-imports": the test in `fixturepkg.low` imports `fixturepkg.high`, above it."""
    root = make_repo(tmp_path)
    crossing = changed(
        TOP_IMPORT,
        "from fixturepkg.low.units import one\n",
        "from fixturepkg.high.api import plan\nfrom fixturepkg.low.units import one\n",
    )
    crossing = changed(crossing, "== 3 * one()", "== 3 * one() * plan()")
    ticket(root, BRANCH, FOLDER, test=crossing)

    refused(root)


def test_an_acceptance_test_mypy_rejects_fails_the_lint(tmp_path: Path) -> None:
    """The plan's "mypy": a helper returns an int as a str (never called, so the test is still red
    for its stated reason)."""
    root = make_repo(tmp_path)
    mistyped = TOP_IMPORT + "\n\ndef _label(count: int) -> str:\n    return count\n"
    ticket(root, BRANCH, FOLDER, test=mistyped)

    refused(root)


def test_a_test_red_on_main_for_a_misspelt_fixture_fails_the_lint(tmp_path: Path) -> None:
    """The plan's "red on main for the stated reason": the stated reason is the module under test
    missing; the test errors first on a typo of its own (`tmp_pth`, a fixture pytest does not have)."""
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test=INNER_IMPORT.replace("tmp_path", "tmp_pth"))

    refused(root)


def test_a_test_red_on_main_for_a_misspelt_module_fails_the_lint(tmp_path: Path) -> None:
    """The same exception, another module: the test imports `fixturepkg.low.storey`, the stated reason
    names `fixturepkg.low.storeys`, the module the builder will build."""
    root = make_repo(tmp_path)
    misspelt = changed(
        INNER_IMPORT, "from fixturepkg.low.storeys import", "from fixturepkg.low.storey import"
    )
    ticket(root, BRANCH, FOLDER, test=misspelt)

    refused(root)


def test_a_red_test_with_no_stated_reason_fails_the_lint(tmp_path: Path) -> None:
    """A test red on main whose commit states no reason for its file cannot be judged red for the
    right reason."""
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, reasons=())

    refused(root)


def test_a_test_red_for_another_reason_as_a_non_root_user_fails_the_lint(tmp_path: Path) -> None:
    """The plan's "passes non-root": the test writes into a folder it made read-only. Root may (the
    cloud runs as root, and there the test is red for its stated reason); any other user is refused,
    so the test errors before the module under test is reached. The lint runs the tests as a non-root
    user wherever it runs."""
    root = make_repo(tmp_path)
    sealed = changed(
        INNER_IMPORT,
        "    assert tmp_path.is_dir()\n",
        "    sealed = tmp_path / 'sealed'\n    sealed.mkdir()\n    sealed.chmod(0o500)\n"
        "    (sealed / 'cache').write_text('3')\n",
    )
    ticket(root, BRANCH, FOLDER, test=sealed, reasons=(MISSING,))

    refused(root)
