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
    assert "Traceback" not in output, output
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


def test_a_file_marked_live_is_named_not_judged_and_not_refused(tmp_path: Path) -> None:
    root = opt_in_repo(tmp_path)
    ticket(root, BRANCH, FOLDER, test=marked("live"))

    done = lint(root, "main", BRANCH)

    assert done.returncode == 0, said(done)
    assert "not judged here" in said(done)


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
