"""The time-bomb lint (#308) at its seams: what a hit is, how commits are pinned, and how narrowly
the allowlist excuses. Every fixture is a string written to a tmp tree; the regression cases copy
real test files and the real allowlist into one."""

import shutil
from pathlib import Path

import pytest

from tools.lint.time_bombs import ALLOWLIST, hits, main, problems

REPO = Path(__file__).resolve().parents[3]
STAMP = 'T1 = "2026-10-05T01:00:00Z"\n'
TEST = "x/tests/test_a.py"


def write(root: Path, name: str, text: str) -> None:
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def kinds(text: str, name: str = TEST) -> list[tuple[str, str]]:
    return [(hit.kind, hit.function) for hit in hits(name, text)]


def with_real_allowlist(root: Path) -> None:
    (root / ALLOWLIST).parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(REPO / ALLOWLIST, root / ALLOWLIST)


def reported(found: list[str], name: str) -> bool:
    return any(line.startswith(f"{name}:") and "wall clock (" in line for line in found)


# --- the regressions the review found ------------------------------------------------------------

WALK = "scripts/walk/tests/test_walk.py"
F5 = "scripts/walk/tests/acceptance/test_f5_ready.py"
PIN = '"GIT_AUTHOR_DATE": COMMITTED, "GIT_COMMITTER_DATE": COMMITTED'


def test_the_pre_fix_293_walk_test_is_reported_under_the_real_allowlist(tmp_path: Path) -> None:
    text = (REPO / WALK).read_text()
    assert PIN in text
    write(tmp_path, WALK, text.replace(PIN, ""))  # 547ab2c13^: the `_git` helper set no dates
    with_real_allowlist(tmp_path)
    assert reported(problems(tmp_path), WALK)


def test_the_real_walk_test_is_excused_and_a_planted_second_bomb_is_not(tmp_path: Path) -> None:
    text = (REPO / WALK).read_text()
    write(tmp_path, WALK, text)
    with_real_allowlist(tmp_path)
    assert not reported(problems(tmp_path), WALK)
    write(tmp_path, WALK, text + "\n\ndef test_planted() -> None:\n    assert datetime.now()\n")
    assert reported(problems(tmp_path), WALK)


def test_an_unpinned_helper_beside_pinned_ones_is_a_commit(tmp_path: Path) -> None:
    text = (REPO / F5).read_text()
    assert kinds(text, F5) == []
    text += (
        "\n\ndef _commit_now(repo: str) -> None:\n"
        '    subprocess.run(["git", "-C", repo, "commit", "-q", "-m", "c"], check=True)\n'
    )
    assert kinds(text, F5) == [("commit", "_commit_now")]


def test_both_pin_names_in_a_comment_or_docstring_do_not_pin() -> None:
    text = (
        STAMP + '"""GIT_AUTHOR_DATE and GIT_COMMITTER_DATE"""\n# GIT_AUTHOR_DATE GIT_COMMITTER_DATE\n'
        'def go(r):\n    run(["git", "-C", r, "commit"])\n'
    )
    assert kinds(text) == [("commit", "go")]


def test_a_helper_pinned_through_its_own_env_helper_pins_its_callers() -> None:
    text = STAMP + (
        "def env():\n    return dict(GIT_AUTHOR_DATE=T1, GIT_COMMITTER_DATE=T1)\n"
        'def git(r, *a):\n    run(["git", *a], cwd=r, env=env())\n'
        'def test_it(r):\n    git(r, "commit", "-m", "c")\n'
    )
    assert kinds(text) == []


def test_a_commit_in_an_f_string_fragment_is_not_a_commit() -> None:
    assert kinds(STAMP + 'git = 1\nkey = f"{q}commit{q}"\n') == []


# --- the spellings -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        (
            "from datetime import UTC, datetime\nT = datetime(2026, 10, 5, 1, 0, tzinfo=UTC)\n"
            "N = datetime.now(UTC)\n"
        ),
        STAMP + "from django.utils import timezone\nN = timezone.now()\n",
        STAMP + "N = timezone.now()\n",
        STAMP + "N = datetime.today()\n",
        STAMP + "N = date.today()\n",
        STAMP + "import datetime as dt\nN = dt.datetime.now()\n",
        STAMP + "from datetime import datetime as dt\nN = dt.now()\n",
        STAMP + "from datetime import datetime as D\nN = D.now()\n",
        STAMP + "import time as clock\nN = clock.time()\n",
        STAMP + "from time import time\nN = time()\n",
        'DAY = "2026-10-05"\nN = date.today()\n',
        "D = date(2026, 10, 5)\nN = date.today()\n",
    ],
)
def test_each_clock_spelling_beside_a_fixed_time_is_a_read(text: str) -> None:
    assert [kind for kind, _ in kinds(text)] == ["read"]


@pytest.mark.parametrize(
    "text",
    [
        "N = datetime.now()\n",
        'DAY = "2026-10-05"\nN = time.time()\n',
        STAMP + "T = datetime.time(1, 2)\nD = datetime.date.today\n",
        STAMP + "N = clock.now()\n",
    ],
)
def test_not_a_read(text: str) -> None:
    assert kinds(text) == []


@pytest.mark.parametrize(
    "call",
    [
        'run("git commit -q -m x", shell=True)',
        'run(["bash", "-c", "cd r && git -C r commit -m x"])',
        'run(["sh", "-c", "git add -A; git commit --allow-empty -m x"])',
    ],
)
def test_a_shell_string_commit_is_a_commit(call: str) -> None:
    assert kinds(STAMP + f"def go():\n    {call}\n") == [("commit", "go")]


def test_a_shell_string_commit_with_both_dates_set_beside_it_is_pinned() -> None:
    text = STAMP + (
        "def go():\n    env = {'GIT_AUTHOR_DATE': T1, 'GIT_COMMITTER_DATE': T1}\n"
        '    run("git commit -m x", shell=True, env=env)\n'
    )
    assert kinds(text) == []


def test_a_commit_in_a_file_that_never_names_git_is_not_a_commit() -> None:
    assert kinds(STAMP + 'run("commit", "-m", "x")\n') == []


def test_a_commit_key_or_subscript_is_data() -> None:
    assert kinds(STAMP + 'git = {"commit" : 1}\nx = git["commit"]\n') == []


def test_every_hit_is_found_in_line_order() -> None:
    text = STAMP + 'N = time.time()\ndef go():\n    run(["git", "commit"])\n    M = datetime.now()\n'
    assert [(hit.line, hit.kind) for hit in hits(TEST, text)] == [
        (2, "read"),
        (4, "commit"),
        (5, "read"),
    ]


def test_a_file_that_does_not_parse_is_read_as_text() -> None:
    assert kinds(STAMP + "def (:\nN = time.time()\n") == [("read", "<module>")]


@pytest.mark.parametrize(
    ("fixed", "read"),
    [
        ('new Date("2026-10-05T01:00:00Z")', "Date.now()"),
        ("Date.parse('2026-10-05')", "new Date()"),
    ],
)
def test_a_script_test_comparing_a_fixed_date_with_the_clock_is_a_read(fixed: str, read: str) -> None:
    text = f"const t = {fixed}\ntest('x', () => expect({read} > t).toBe(true))\n"
    assert kinds(text, "web/src/a.test.ts") == [("read", "<module>")]
    assert kinds(text, "scripts/factory/b.test.mjs") == [("read", "<module>")]


def test_a_script_test_without_a_fixed_date_is_clean() -> None:
    assert kinds("const t = Date.now()\n", "web/src/a.test.ts") == []


def test_a_script_file_that_is_not_a_test_is_not_read(tmp_path: Path) -> None:
    write(tmp_path, "web/src/a.ts", 'const t = new Date("2026-10-05")\nconst n = Date.now()\n')
    assert problems(tmp_path) == []


# --- the allowlist -------------------------------------------------------------------------------

TWO = STAMP + "def a():\n    return time.time()\ndef b():\n    return time.time()\n"


def test_a_narrow_entry_excuses_only_its_function(tmp_path: Path) -> None:
    write(tmp_path, TEST, TWO)
    write(
        tmp_path,
        ALLOWLIST,
        f'[[allow]]\npath = "{TEST}"\nkind = "read"\nfunction = "a"\nreason = "relative"\n',
    )
    assert problems(tmp_path) == [
        (
            f"{TEST}:5: wall clock (time.time()) in a file that holds a fixed timestamp: "
            "pin the date or pass the time in"
        )
    ]


def test_a_line_entry_excuses_only_its_line(tmp_path: Path) -> None:
    write(tmp_path, TEST, TWO)
    entries = "".join(
        f'[[allow]]\npath = "{TEST}"\nkind = "read"\nline = {line}\nreason = "relative"\n'
        for line in (3, 5)
    )
    write(tmp_path, ALLOWLIST, entries)
    assert problems(tmp_path) == []


def test_a_wrong_kind_does_not_excuse(tmp_path: Path) -> None:
    write(tmp_path, TEST, STAMP + "N = time.time()\n")
    write(
        tmp_path,
        ALLOWLIST,
        f'[[allow]]\npath = "{TEST}"\nkind = "commit"\nfunction = "<module>"\nreason = "r"\n',
    )
    found = problems(tmp_path)
    assert len(found) == 2
    assert reported(found, TEST)
    assert "stale" in found[1]


def test_a_path_only_entry_excuses_a_file_only_while_it_holds_one_hit(tmp_path: Path) -> None:
    write(tmp_path, TEST, STAMP + "N = time.time()\n")
    write(tmp_path, ALLOWLIST, f'[[allow]]\npath = "{TEST}"\nreason = "relative"\n')
    assert problems(tmp_path) == []
    write(tmp_path, TEST, TWO)
    found = problems(tmp_path)
    assert reported(found, TEST)


@pytest.mark.parametrize(
    ("entry", "says"),
    [
        ('kind = "read"\n', "no function or line"),
        ('kind = "clock"\nfunction = "a"\n', "use one of"),
        ('function = "a"\n', "but no kind"),
        ('kind = "read"\nline = 0\n', "positive number"),
        ('kind = "read"\nfunction = " "\n', "blank function"),
    ],
)
def test_a_malformed_narrow_entry_is_a_problem(tmp_path: Path, entry: str, says: str) -> None:
    write(tmp_path, ALLOWLIST, f'[[allow]]\npath = "{TEST}"\n{entry}reason = "r"\n')
    found = problems(tmp_path)
    assert len(found) == 1
    assert says in found[0]


def test_an_unparsable_allowlist_is_a_problem(tmp_path: Path) -> None:
    write(tmp_path, ALLOWLIST, "[[allow]\n")
    found = problems(tmp_path)
    assert len(found) == 1
    assert "cannot be read" in found[0]


def test_an_entry_without_a_path_is_a_problem(tmp_path: Path) -> None:
    write(tmp_path, ALLOWLIST, '[[allow]]\nreason = "r"\n')
    assert problems(tmp_path) == [f"{ALLOWLIST}: an entry names no path"]


def test_main_with_no_argument_reads_the_working_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    write(tmp_path, "tests/test_x.py", STAMP + "N = time.time()\n")
    monkeypatch.chdir(tmp_path)
    assert main([]) == 1
