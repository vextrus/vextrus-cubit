"""The acceptance lint run whole on fixture repositories (S14-AL, review round 1): the defects its first
version let through, each a minimal change to a well-formed fixture ticket. The fixture repositories
are the acceptance tests' own (`tests/acceptance/ts14al/_fixture.py`), used here, never changed."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

from tools.lint.acceptance_lint import Checker, Ticket
from tools.lint.tests.acceptance.ts14al._fixture import (
    INNER_IMPORT,
    MISSING,
    REPO,
    TOP_IMPORT,
    changed,
    file_of,
    git,
    lint,
    make_repo,
    said,
    ticket,
)

BRANCH, FOLDER = "s91-aa", "ts91aa"


def refused(root: Path, *branches: str) -> str:
    done = lint(root, "main", *(branches or (BRANCH,)))
    output = said(done)
    assert done.returncode == 1, output
    assert "Traceback (most recent call last)" not in output, output  # pytest's quoted ones may show
    return output


def test_a_file_with_no_test_does_not_collect(tmp_path: Path) -> None:
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test='"""No test here."""\n')

    assert "collects no test" in refused(root)


@pytest.mark.parametrize(
    ("old", "new"),
    [
        ("def test_counts", "import pytest\n\n\n@pytest.mark.xfail\ndef test_counts"),
        ("def test_counts", "import pytest\n\n\n@pytest.mark.skip\ndef test_counts"),
        (
            "def test_counts",
            (
                "import os\n\nimport pytest\n\n\n"
                "@pytest.mark.skipif(os.geteuid() != 0, reason='root only')\ndef test_counts"
            ),
        ),
    ],
    ids=["xfail", "skip", "skipped under one user"],
)
def test_a_test_skipped_or_xfail_on_the_base_fails_the_lint(tmp_path: Path, old: str, new: str) -> None:
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test=changed(INNER_IMPORT, old, new))

    assert "skipped or xfail" in refused(root)


def test_a_file_skipped_whole_by_importorskip_fails_the_lint(tmp_path: Path) -> None:
    root = make_repo(tmp_path)
    skipped = changed(
        INNER_IMPORT,
        "from fixturepkg.low.units import one\n",
        "import pytest\n\nfrom fixturepkg.low.units import one\n\n"
        'pytest.importorskip("fixturepkg.low.storeys")\n',
    )
    ticket(root, BRANCH, FOLDER, test=skipped)

    refused(root)


def test_a_misspelt_fixture_behind_the_missing_import_fails_the_lint(tmp_path: Path) -> None:
    """Red at collection on the base for the stated reason, so only a setup plan with the module
    stubbed finds the fixture pytest does not have."""
    root = make_repo(tmp_path)
    test = changed(
        TOP_IMPORT,
        "def test_counts_three_storeys() -> None:",
        "def test_counts_three_storeys(tmp_pth: int) -> None:",
    )
    ticket(root, BRANCH, FOLDER, test=test)

    assert "cannot be set up" in refused(root)


def test_an_amendment_replaces_a_pin_and_a_stated_reason(tmp_path: Path) -> None:
    """The ticket pinned 3, the owner ruled 4, the writer's amendment re-pins 4 and restates the
    reason: the newest commit wins."""
    root = make_repo(tmp_path, rulings="ruling: storeys.count = 4\n")
    ticket(root, BRANCH, FOLDER, pins=("storeys.count = 3",), reasons=("a reason that is wrong",))
    git(root, "checkout", "-q", BRANCH)
    path = root / file_of(FOLDER)
    path.write_text(path.read_text() + "\n")
    git(root, "add", str(path))
    message = (
        f"acceptance: amend\n\nred-for: {file_of(FOLDER)} {MISSING}\npin: storeys.count = 4\n\n"
        "red-on-main: 1 failed\ngreen-on-throwaway: 1 passed\n"
    )
    git(root, "commit", "-q", "-m", message)
    git(root, "checkout", "-q", "main")

    done = lint(root, "main", BRANCH)

    assert done.returncode == 0, said(done)


def test_a_malformed_pin_fails_the_lint(tmp_path: Path) -> None:
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, pins=("storeys.count: 4",))

    assert "pin: storeys.count: 4" in refused(root)


def test_laying_out_the_tree_never_opens_a_folder_a_link_points_to(tmp_path: Path) -> None:
    outside = tmp_path / "outside"
    outside.mkdir()
    outside.chmod(0o700)
    root = make_repo(tmp_path)
    (root / "linked").symlink_to(outside)
    git(root, "add", "linked")
    git(root, "commit", "-q", "-m", "a link")
    work = tmp_path / "work"
    work.mkdir()

    Checker(root, "main", Ticket(BRANCH), work).lay_out()

    assert (work / "tree" / "linked").is_symlink()
    assert outside.stat().st_mode & 0o777 == 0o700


# Review round 2.

OPT_IN = (
    '[tool.pytest.ini_options]\npythonpath = ["."]\n'
    'addopts = ["--strict-markers", "-m", "not needs_toolchain and not live"]\n'
    'markers = ["needs_toolchain: the toolchain", "live: paid calls"]\n\n'
    "[tool.mypy]\nstrict = true\n"
)


def opt_in_repo(tmp_path: Path) -> Path:
    """The fixture repository with the base's addopts deselecting the opt-in marks, as main's do."""
    root = make_repo(tmp_path)
    (root / "pyproject.toml").write_text(OPT_IN)
    git(root, "commit", "-q", "-am", "opt-in marks")
    return root


def marked(mark: str, test: str = INNER_IMPORT) -> str:
    return changed(test, "def test_counts", f"import pytest\n\n\n@pytest.mark.{mark}\ndef test_counts")


@pytest.mark.skipif(not Path("/opt/vextrus").is_dir(), reason="judged only where the toolchain is")
def test_a_well_formed_file_marked_needs_toolchain_passes(tmp_path: Path) -> None:
    root = opt_in_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test=marked("needs_toolchain"))

    done = lint(root, "main", BRANCH)

    assert done.returncode == 0, said(done)
    assert "not judged" not in said(done)


@pytest.mark.skipif(not Path("/opt/vextrus").is_dir(), reason="judged only where the toolchain is")
def test_a_file_marked_needs_toolchain_red_for_another_reason_fails(tmp_path: Path) -> None:
    root = opt_in_repo(tmp_path)
    wrong = changed(INNER_IMPORT, "assert tmp_path.is_dir()", "assert not tmp_path.is_dir()")
    ticket(root, BRANCH, FOLDER, test=marked("needs_toolchain", wrong))

    assert "for a reason not stated" in refused(root)


def test_a_file_marked_live_is_refused_naming_its_tests(tmp_path: Path) -> None:
    """Review round 3: CI's acceptance check never runs a live test, so the built branch would fail
    it as deselected; the lint refuses the test at the writer (and never runs it)."""
    root = opt_in_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test=marked("live"))

    output = refused(root)

    assert "marked live" in output
    assert "test_counts_three_storeys" in output


def amend(root: Path, message: str) -> None:
    """A newer `acceptance:` commit on the ticket's branch touching its test file."""
    git(root, "checkout", "-q", BRANCH)
    path = root / file_of(FOLDER)
    path.write_text(path.read_text() + "\n")
    git(root, "add", str(path))
    git(root, "commit", "-q", "-m", f"acceptance: amend\n\n{message}\nred-on-main: 1 failed\n")
    git(root, "checkout", "-q", "main")


def test_a_malformed_pin_is_superseded_by_a_newer_pin_of_its_key(tmp_path: Path) -> None:
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, pins=("storeys.count: 3",))
    amend(root, "pin: storeys.count = 3\n")

    done = lint(root, "main", BRANCH)

    assert done.returncode == 0, said(done)


def test_a_mistyped_red_for_path_is_superseded_by_a_newer_red_for(tmp_path: Path) -> None:
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, reasons=())
    amend(root, f"red-for: {FOLDER}/tset.py {MISSING}\n")
    amend(root, f"red-for: {file_of(FOLDER)} {MISSING}\n")

    done = lint(root, "main", BRANCH)

    assert done.returncode == 0, said(done)


def test_a_folder_the_branch_has_where_the_base_has_a_link_is_written_inside_the_tree(
    tmp_path: Path,
) -> None:
    outside = tmp_path / "outside"
    outside.mkdir()
    root = make_repo(tmp_path)
    (root / "fixturepkg/low/tests/acceptance" / FOLDER).symlink_to(outside)
    git(root, "add", "fixturepkg")
    git(root, "commit", "-q", "-m", "a link where the ticket's folder will be")
    git(root, "checkout", "-q", "-b", BRANCH)
    git(root, "rm", "-q", f"fixturepkg/low/tests/acceptance/{FOLDER}")
    (root / file_of(FOLDER)).parent.mkdir()
    (root / file_of(FOLDER)).write_text(TOP_IMPORT)
    git(root, "add", file_of(FOLDER))
    git(root, "commit", "-q", "-m", "acceptance: a folder for the link")
    git(root, "checkout", "-q", "main")
    work = tmp_path / "work"
    work.mkdir()
    from tools.lint.acceptance_lint import read_ticket

    Checker(root, "main", read_ticket(root, "main", BRANCH), work).lay_out()

    assert list(outside.iterdir()) == []
    assert (work / "tree" / file_of(FOLDER)).read_text() == TOP_IMPORT


def test_a_stub_is_never_written_through_a_linked_package(tmp_path: Path) -> None:
    outside = tmp_path / "outside"
    outside.mkdir()
    root = make_repo(tmp_path)
    (root / "fixturepkg/linked").symlink_to(outside)
    git(root, "add", "fixturepkg/linked")
    git(root, "commit", "-q", "-m", "a linked package")
    work = tmp_path / "work"
    work.mkdir()
    checker = Checker(root, "main", Ticket(BRANCH), work)
    checker.lay_out()

    assert not checker.stub("fixturepkg.linked.storeys", None, {})
    assert list(outside.iterdir()) == []


DB_TEST = '''"""A database test, red on the base for the module not built."""

import pytest


@pytest.mark.django_db
def test_counts_storeys() -> None:
    from vextrus.storeys_not_built import count  # type: ignore[import-not-found, unused-ignore]

    assert count() == 3
'''


def _test_databases() -> set[str] | None:
    """The test databases on the server, or None when it cannot be reached."""
    from django.conf import settings

    psycopg = pytest.importorskip("psycopg")
    owner = settings.DATABASES["owner"]
    try:
        connection = psycopg.connect(
            host=owner["HOST"],
            port=owner["PORT"],
            user=owner["USER"],
            password=owner["PASSWORD"] or None,
            dbname="postgres",
        )
    except psycopg.OperationalError:
        return None
    with connection:
        rows = connection.execute("SELECT datname FROM pg_database WHERE datname LIKE '%%_test_%%'")
        return {row[0] for row in rows.fetchall()}


def test_a_run_with_a_database_test_leaves_no_test_database(tmp_path: Path) -> None:
    before = _test_databases()
    if before is None:
        pytest.skip("no PostgreSQL reachable")
    clone = tmp_path / "clone"
    subprocess.run(
        ["git", "clone", "-q", "--shared", "--no-checkout", str(REPO), str(clone)], check=True
    )
    git(clone, "config", "user.email", "test@example.invalid")
    git(clone, "config", "user.name", "test")
    git(clone, "config", "commit.gpgsign", "false")
    head = git(Path(REPO), "rev-parse", "HEAD")
    git(clone, "checkout", "-q", "-b", BRANCH, head)
    path = "vextrus/storeys_tests/tests/acceptance/ts91aa/test_storeys.py"
    for name, text in {
        "vextrus/storeys_tests/__init__.py": "",
        "vextrus/storeys_tests/tests/__init__.py": "",
        "vextrus/storeys_tests/tests/acceptance/__init__.py": "",
        "vextrus/storeys_tests/tests/acceptance/ts91aa/__init__.py": "",
        path: DB_TEST,
    }.items():
        (clone / name).parent.mkdir(parents=True, exist_ok=True)
        (clone / name).write_text(text)
        git(clone, "add", name)
    reason = "ModuleNotFoundError: No module named 'vextrus.storeys_not_built'"
    git(clone, "commit", "-q", "-m", f"acceptance: a database test\n\nred-for: {path} {reason}\n")
    env = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith("PYTEST_") and key not in {"DJANGO_SETTINGS_MODULE", "PYTHONPATH"}
    }
    env["PYTHONPATH"] = str(REPO)

    # -P: this checkout's lint, not the clone's (`-m` would put the clone first on the path).
    done = subprocess.run(
        [sys.executable, "-P", "-m", "tools.lint.acceptance_lint", head, BRANCH],
        cwd=clone,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert "Traceback" not in done.stdout, done.stdout
    assert "database was not dropped" not in done.stdout, done.stdout
    assert _test_databases() == before, done.stdout


# Review round 3.


def linked_repo(tmp_path: Path, link: str, target: Path) -> Path:
    """The fixture repository with `link` (a path under it) committed as a symlink to `target`."""
    root = make_repo(tmp_path)
    (root / link).parent.mkdir(parents=True, exist_ok=True)
    (root / link).symlink_to(target)
    git(root, "add", link)
    git(root, "commit", "-q", "-m", "a link")
    return root


def laid_out(root: Path, tmp_path: Path) -> Checker:
    work = tmp_path / "work"
    work.mkdir()
    checker = Checker(root, "main", Ticket(BRANCH), work)
    checker.lay_out()
    return checker


def test_a_stub_never_writes_a_package_init_that_is_a_dangling_link(tmp_path: Path) -> None:
    outside = tmp_path / "outside"
    outside.mkdir()
    target = outside / "made.py"
    root = linked_repo(tmp_path, "fixturepkg/side/__init__.py", target)
    checker = laid_out(root, tmp_path)

    assert not checker.stub("fixturepkg.side.storeys", None, {})
    assert not target.exists()


def test_a_stub_never_writes_through_a_link_to_an_outside_folder(tmp_path: Path) -> None:
    outside = tmp_path / "outside"
    outside.mkdir()
    root = linked_repo(tmp_path, "fixturepkg/deep", outside)
    checker = laid_out(root, tmp_path)

    assert not checker.stub("fixturepkg.deep.more.storeys", None, {})
    assert list(outside.iterdir()) == []


def test_a_lint_run_never_creates_a_dangling_link_target(tmp_path: Path) -> None:
    outside = tmp_path / "outside"
    outside.mkdir()
    target = outside / "made.py"
    root = linked_repo(tmp_path, "fixturepkg/side/__init__.py", target)
    test = TOP_IMPORT.replace("fixturepkg.low.storeys", "fixturepkg.side.storeys")
    ticket(root, BRANCH, FOLDER, test=test, reasons=("No module named 'fixturepkg.side'",))

    done = lint(root, "main", BRANCH)

    assert "Traceback (most recent call last)" not in said(done), said(done)
    assert "does not collect" in said(done), said(done)
    assert not target.exists(), said(done)


def test_a_stub_never_appends_to_a_package_init_linked_to_an_outside_file(tmp_path: Path) -> None:
    """A name missing from a package whose own `__init__.py` links to a file in an existing outside
    folder: the stub would be appended to that file."""
    outside = tmp_path / "outside"
    outside.mkdir()
    target = outside / "init.py"
    target.write_text("")
    root = linked_repo(tmp_path, "fixturepkg/side/__init__.py", target)
    checker = laid_out(root, tmp_path)

    assert not checker.stub("fixturepkg.side", "count_storeys", {})
    assert target.read_text() == ""


# PR #482, review round 1.

NEW_PACKAGE = '''"""A fixture ticket: the walls of a package not built yet."""

from fixturepkg.low.assemble_nb.walls import count_walls  # type: ignore[import-not-found, unused-ignore]


def test_counts_walls() -> None:
    assert count_walls(4) == 4
'''


@pytest.mark.parametrize(
    "named",
    ["fixturepkg.low.assemble_nb", "fixturepkg.low.assemble_nb.walls"],
    ids=["package", "module"],
)
def test_a_test_of_a_package_not_built_yet_passes(tmp_path: Path, named: str) -> None:
    """The base names the first part it cannot find (`fixturepkg.low.assemble_nb`), as the writer saw
    it; a reason naming the module under test is accepted too. The stub's folder is gone before the
    base run, so the base run fails as on the base itself."""
    root = make_repo(tmp_path)
    reason = f"ModuleNotFoundError: No module named '{named}'"
    ticket(root, BRANCH, FOLDER, test=NEW_PACKAGE, reasons=(reason,))

    done = lint(root, "main", BRANCH)

    assert done.returncode == 0, said(done)


def test_undoing_a_stub_removes_the_folders_it_made(tmp_path: Path) -> None:
    from tools.lint.acceptance_lint import _undo

    root = make_repo(tmp_path)
    checker = laid_out(root, tmp_path)
    made: dict[Path, bytes | None] = {}

    assert checker.stub("fixturepkg.low.assemble_nb.deeper.walls", None, made)
    _undo(made)

    assert not (checker.tree / "fixturepkg/low/assemble_nb").exists()
    assert (checker.tree / "fixturepkg/low/units.py").is_file()


def test_a_file_still_failing_after_the_stub_limit_does_not_collect(tmp_path: Path) -> None:
    """21 modules not built (one stub each), then a data file the test reads at import."""
    from tools.lint.acceptance_lint import STUBS

    imports = "".join(
        f"from fixturepkg.low.m{n} import x{n}  # type: ignore[import-not-found, unused-ignore]\n"
        for n in range(STUBS + 1)
    )
    test = (
        '"""Too many modules."""\n\nfrom pathlib import Path\n\n'
        + imports
        + '\nCASES = (Path(__file__).parent / "cases.json").read_text()\n\n\n'
        "def test_counts() -> None:\n    assert x0 == CASES\n"
    )
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test=test, reasons=("No module named 'fixturepkg.low.m0'",))

    assert "stub limit reached" in refused(root)


# PR #482, review round 2.

NEW_TOP = '''"""A fixture ticket: walls deep in a package not built yet."""

from fixturepkg.newtop.a.b.walls import count_walls  # type: ignore[import-not-found, unused-ignore]


def test_counts_walls() -> None:
    assert count_walls(4) == 4
'''


@pytest.mark.parametrize(
    ("named", "accepted"),
    [
        ("fixturepkg.newtop.a.b.walls", True),
        ("fixturepkg.newtop.a.c", False),
        ("fixturepkg.newtop.a.b.wals", False),
    ],
    ids=["the module under test", "a sibling never imported", "a misspelling"],
)
def test_only_an_imported_module_widens_to_its_parent_package(
    tmp_path: Path, named: str, accepted: bool
) -> None:
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test=NEW_TOP, reasons=(f"No module named '{named}'",))

    done = lint(root, "main", BRANCH)

    assert (done.returncode == 0) is accepted, said(done)


def many_modules(count: int) -> str:
    imports = "".join(
        f"from fixturepkg.low.m{n} import x{n}  # type: ignore[import-not-found, unused-ignore]\n"
        for n in range(count)
    )
    test = "def test_counts() -> None:\n    assert x0 == 1\n"
    return f'"""{count} modules not built."""\n\n{imports}\n\n{test}'


@pytest.mark.parametrize(("count", "accepted"), [(20, True), (21, False)])
def test_the_stub_limit_is_exactly_its_count(tmp_path: Path, count: int, accepted: bool) -> None:
    from tools.lint.acceptance_lint import STUBS

    assert count in (STUBS, STUBS + 1)
    root = make_repo(tmp_path)
    ticket(
        root, BRANCH, FOLDER, test=many_modules(count), reasons=("No module named 'fixturepkg.low.m0'",)
    )

    done = lint(root, "main", BRANCH)

    assert (done.returncode == 0) is accepted, said(done)
    assert ("stub limit reached" in said(done)) is not accepted, said(done)


# PR #482, review round 3.

BY_NAME = '''"""A fixture ticket: walls in a new package, loaded by name."""

import importlib


def test_counts_walls() -> None:
    walls = importlib.import_module("fixturepkg.newtop.walls")
    assert walls.count_walls(4) == 4
'''

HELPER = '''"""Loads the module under test by name."""

import importlib
from types import ModuleType


def walls() -> ModuleType:
    return importlib.import_module("fixturepkg.newtop.walls")
'''

THROUGH_HELPER = '''"""A fixture ticket: walls in a new package, loaded by a helper beside the test."""

from ._load import walls


def test_counts_walls() -> None:
    assert walls().count_walls(4) == 4
'''


@pytest.mark.parametrize(
    ("named", "accepted"),
    [("fixturepkg.newtop.walls", True), ("fixturepkg.newtop.wals", False)],
    ids=["the module loaded", "a misspelling"],
)
def test_a_module_loaded_by_name_in_the_test_widens_to_its_parent(
    tmp_path: Path, named: str, accepted: bool
) -> None:
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test=BY_NAME, reasons=(f"No module named '{named}'",))

    done = lint(root, "main", BRANCH)

    assert (done.returncode == 0) is accepted, said(done)


def test_a_module_loaded_by_name_in_a_helper_beside_the_test_widens_to_its_parent(
    tmp_path: Path,
) -> None:
    root = make_repo(tmp_path)
    ticket(
        root, BRANCH, FOLDER, test=THROUGH_HELPER, reasons=("No module named 'fixturepkg.newtop.walls'",)
    )
    git(root, "checkout", "-q", BRANCH)
    helper = root / file_of(FOLDER).replace("test_storeys.py", "_load.py")
    helper.write_text(HELPER)
    git(root, "add", str(helper))
    git(root, "commit", "-q", "-m", "acceptance: the helper\n\nred-on-main: 1 failed\n")
    git(root, "checkout", "-q", "main")

    done = lint(root, "main", BRANCH)

    assert done.returncode == 0, said(done)


# PR #499, review round 1.

FROM_PACKAGE = "from fixturepkg.newpkg import thing  # type: ignore[import-not-found, unused-ignore]\n"
FROM_SUBMODULE = (
    "from fixturepkg.newpkg.sub import other  # type: ignore[import-not-found, unused-ignore]\n"
)


@pytest.mark.parametrize(
    "imports",
    [FROM_PACKAGE + FROM_SUBMODULE, FROM_SUBMODULE + FROM_PACKAGE],
    ids=["package first", "submodule first"],
)
def test_a_name_and_a_submodule_of_one_new_package_collect(tmp_path: Path, imports: str) -> None:
    test = f'"""Both."""\n\n{imports}\n\ndef test_both() -> None:\n    assert thing(other) == 1\n'
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test=test, reasons=("No module named 'fixturepkg.newpkg'",))

    done = lint(root, "main", BRANCH)

    assert done.returncode == 0, said(done)


MODULE_LEVEL = {
    "range": "for _n in range(MAX + 1):\n    pass\n",
    "subscript": "FIRST = CASES[0]\n",
    "arithmetic": "LIMIT = MAX * 2\nBELOW = LIMIT > 3\n",
    "length": "COUNT = len(CASES)\n",
}


@pytest.mark.parametrize("use", list(MODULE_LEVEL.values()), ids=list(MODULE_LEVEL))
def test_module_level_use_of_a_stubbed_value_collects(tmp_path: Path, use: str) -> None:
    test = (
        '"""Module-level use."""\n\n'
        "from fixturepkg.low.storeys import CASES, MAX"
        "  # type: ignore[import-not-found, unused-ignore]\n\n"
        f"{use}\n\ndef test_counts() -> None:\n    assert MAX == len(CASES)\n"
    )
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test=test, reasons=(MISSING,))

    done = lint(root, "main", BRANCH)

    assert done.returncode == 0, said(done)


def test_a_decorator_from_a_stubbed_module_keeps_the_test(tmp_path: Path) -> None:
    test = (
        '"""A decorator from the module under test."""\n\n'
        "from fixturepkg.low.storeys import registered"
        "  # type: ignore[import-not-found, unused-ignore]\n\n\n"
        "@registered  # type: ignore[untyped-decorator, unused-ignore]\n"
        "def test_counts() -> None:\n    assert registered\n"
    )
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test=test, reasons=(MISSING,))

    done = lint(root, "main", BRANCH)

    assert done.returncode == 0, said(done)


def test_another_branch_named_is_read_for_its_pins_only(tmp_path: Path) -> None:
    """An open ticket's older acceptance commit, with no `red-for:` line, is not judged with the new
    one; its pin still counts."""
    root = make_repo(tmp_path)
    ticket(root, "s91-old", "ts91old", reasons=(), pins=("storeys.count = 3",))
    ticket(root, BRANCH, FOLDER, pins=("storeys.count = 3",))

    done = lint(root, "main", BRANCH, "s91-old")

    assert done.returncode == 0, said(done)
    (tmp_path / "second").mkdir()
    contradicting = make_repo(tmp_path / "second")
    ticket(contradicting, "s91-old", "ts91old", reasons=(), pins=("storeys.count = 4",))
    ticket(contradicting, BRANCH, FOLDER, pins=("storeys.count = 3",))
    assert "s91-old" in refused(contradicting, BRANCH, "s91-old")


# PR #499, review round 2.


def parametrized(fixture: str, cases: str = "CASES") -> str:
    return (
        '"""A parametrize over a stubbed value."""\n\n'
        "from pathlib import Path\n\nimport pytest\n\n"
        "from fixturepkg.low.storeys import CASES"
        "  # type: ignore[import-not-found, unused-ignore]\n\n\n"
        f'@pytest.mark.parametrize("case", {cases})\n'
        f"def test_counts(case: int, {fixture}: Path) -> None:\n    assert case in CASES\n"
    )


def test_a_parametrize_over_a_stubbed_value_with_a_misspelt_fixture_is_refused(tmp_path: Path) -> None:
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test=parametrized("tmp_pth"), reasons=(MISSING,))

    output = refused(root)

    assert "cannot be set up" in output
    assert "tmp_pth" in output


def test_a_parametrize_over_a_stubbed_value_with_its_fixtures_is_clean(tmp_path: Path) -> None:
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test=parametrized("tmp_path"), reasons=(MISSING,))

    done = lint(root, "main", BRANCH)

    assert done.returncode == 0, said(done)


def test_a_test_with_an_empty_parameter_set_is_named(tmp_path: Path) -> None:
    root = make_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test=parametrized("tmp_path", cases="[]"), reasons=(MISSING,))

    assert "empty parameter set" in refused(root)
