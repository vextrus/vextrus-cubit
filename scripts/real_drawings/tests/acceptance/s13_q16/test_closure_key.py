"""Ticket T-Q16 (the owner's Q16 ruling, "Yes, in #249's re-run": key the posting run's cache by the read
job's import closure), T-249's B3 cases 1 to 6 as this ticket restates them (section 3 and its approach,
section 4):

- the seam `scripts.real_drawings.source.read_key(repo, commit, files) -> tuple[str, str]`: the key, and
  why it is the whole engine paths' hash ("" when it is the closure's);
- the key covers the read job's entries (`vextrus/takeoff/tasks/read_file.py`,
  `vextrus/takeoff/services/export.py`) and every module they import, the job's installed apps'
  `models`, `apps.py`, `migrations/` and `management/`, and the always-in set (`pyproject.toml`,
  `uv.lock`, `.python-version`, `toolchain/**`, `tools/acadsharp-dump/**`, `.github/engine-paths.txt`,
  `.github/checkout-also.txt`, `vextrus/settings/**`, `engine/export.schema.json`), hashed as `code_hash`
  does (each file's mode, object id and path);
- a closure that cannot be found (a `ClosureError`) gives the whole hash, and says why;
- the command keys its cache path and its "head != main" rule by it, so a PR whose closure is unchanged
  reuses main's run and posts as main's reading does.

Cases: 1, a PR changing an engine-path file outside the closure reads nothing new; 2, the key moves for
each closure or always-in file and stays for each file outside it; 3, the key is a sha256 like the code
hash, the same twice, not the whole hash, with no reason given; 4, a missing entry or a closure file
that does not parse gives the whole hash and names the file; 5, the cache's folder is the key; 6, an
unscored PR whose closure is main's still posts, and one whose closure differs posts nothing.

`world.py`'s invented git repository, given an invented read job (no real module, no drawing text), and
its fake sandbox. Nothing here reads a DWG, the network or `.private/`.
"""

import dataclasses
import json
import re
from pathlib import Path

import pytest

from scripts.real_drawings import source
from scripts.real_drawings.command import run
from scripts.real_drawings.source import code_hash, engine_files
from scripts.real_drawings.tests.world import REPO, World, make_world, run_git

PATTERNS = (REPO / ".github" / "engine-paths.txt").read_text(encoding="utf-8")
SHA256 = re.compile(r"[0-9a-f]{64}")
READ_FILE = "vextrus/takeoff/tasks/read_file.py"
EXPORT = "vextrus/takeoff/services/export.py"

JOB: dict[str, str | None] = {
    "vextrus/__init__.py": "",
    "vextrus/settings/__init__.py": 'INSTALLED_APPS = ["vextrus.drawings", "vextrus.takeoff"]\n',
    "vextrus/settings/job.py": (REPO / "vextrus" / "settings" / "job.py").read_text(encoding="utf-8"),
    ".github/checkout-also.txt": (REPO / ".github" / "checkout-also.txt").read_text(encoding="utf-8"),
    ".python-version": "3.14\n",
    "tools/acadsharp-dump/QxDump.cs": "// an invented dumper\n",
    "engine/read/__init__.py": "",
    "engine/read/qx_core.py": "def qx_first(name: str) -> str:\n    return name\n",
    "engine/read/tests/__init__.py": "",
    "engine/read/tests/test_qx_core.py": "from engine.read import qx_core\n\nQX = qx_core\n",
    "engine/qx_unused.py": "QX_UNUSED = 7\n",
    "vextrus/drawings/__init__.py": "",
    "vextrus/drawings/apps.py": "QX_DRAWINGS_APP = 1\n",
    "vextrus/drawings/models.py": "QX_DRAWINGS_MODEL = 2\n",
    "vextrus/drawings/admin.py": "QX_DRAWINGS_ADMIN = 3\n",
    "vextrus/drawings/migrations/__init__.py": "",
    "vextrus/drawings/migrations/0001_initial.py": "QX_DRAWINGS_STEP = 4\n",
    "vextrus/takeoff/__init__.py": "",
    "vextrus/takeoff/apps.py": "QX_TAKEOFF_APP = 5\n",
    "vextrus/takeoff/models.py": "QX_TAKEOFF_MODEL = 6\n",
    "vextrus/takeoff/admin/__init__.py": "from vextrus.takeoff import models\n\nQX = models\n",
    "vextrus/takeoff/http/__init__.py": "",
    "vextrus/takeoff/http/qx_views.py": "from vextrus.takeoff import models\n\nQX = models\n",
    "vextrus/takeoff/migrations/__init__.py": "",
    "vextrus/takeoff/migrations/0001_initial.py": "QX_TAKEOFF_STEP = 8\n",
    "vextrus/takeoff/management/__init__.py": "",
    "vextrus/takeoff/management/commands/__init__.py": "",
    "vextrus/takeoff/management/commands/qx_tidy.py": "QX_TIDY = 9\n",
    "vextrus/takeoff/tasks/__init__.py": "",
    READ_FILE: (
        "from vextrus.takeoff.services import qx_steps\n\n\n"
        "def read(name: str) -> str:\n    return qx_steps.qx_step(name)\n"
    ),
    "vextrus/takeoff/services/__init__.py": "",
    EXPORT: (
        "from vextrus.takeoff.tasks import read_file\n\n\n"
        "def main() -> str:\n"
        "    from vextrus.takeoff.services import qx_later\n\n"
        "    return read_file.read(qx_later.QX_LATER)\n"
    ),
    "vextrus/takeoff/services/qx_steps.py": (
        "from engine.read.qx_core import qx_first\n\n\n"
        "def qx_step(name: str) -> str:\n    return qx_first(name)\n"
    ),
    "vextrus/takeoff/services/qx_later.py": 'QX_LATER = "an invented name"\n',
    "vextrus/takeoff/tests/__init__.py": "",
    "vextrus/takeoff/tests/test_qx_steps.py": (
        "from vextrus.takeoff.services import qx_steps\n\nQX = qx_steps\n"
    ),
}
"""An invented read job, its installed apps (drawings and takeoff, both in the job's modules) and the
files around it, committed on main over `world.py`'s own."""

IN_THE_KEY = [
    READ_FILE,  # an entry
    EXPORT,  # the other entry
    "vextrus/takeoff/services/qx_steps.py",  # imported by an entry
    "vextrus/takeoff/services/qx_later.py",  # imported inside a function
    "engine/read/qx_core.py",  # an engine module the job imports, at depth
    "vextrus/takeoff/models.py",  # an installed app's models
    "vextrus/takeoff/apps.py",
    "vextrus/takeoff/migrations/0001_initial.py",
    "vextrus/takeoff/management/commands/qx_tidy.py",
    "vextrus/drawings/models.py",  # an installed app the entries never import
    "vextrus/drawings/apps.py",
    "vextrus/drawings/migrations/0001_initial.py",
    "pyproject.toml",  # the always-in set
    "uv.lock",
    ".python-version",
    "toolchain/libredwg.version",
    "tools/acadsharp-dump/QxDump.cs",
    ".github/engine-paths.txt",
    ".github/checkout-also.txt",
    "vextrus/settings/job.py",
    "engine/export.schema.json",
]
OUTSIDE_THE_KEY = [
    "vextrus/takeoff/tests/test_qx_steps.py",  # a test under vextrus/takeoff/tests/
    "vextrus/takeoff/admin/__init__.py",  # an admin module
    "vextrus/takeoff/http/qx_views.py",  # a view the read job never imports
    "vextrus/drawings/admin.py",
    "engine/read/tests/test_qx_core.py",  # an engine test
    "engine/qx_unused.py",  # an engine module the job never imports
    "README.md",  # no engine path at all
]


def edited(path: str, text: str) -> str:
    """The file with one invented change that keeps it what it was (Python, JSON or text)."""
    if path.endswith(".py"):
        return text + "\nQX_EDITED = True\n"
    if path.endswith(".json"):
        return json.dumps({**json.loads(text), "description": "an invented edit"})
    return text + "\n# an invented edit\n"


@pytest.fixture
def world(tmp_path: Path) -> World:
    world = make_world(tmp_path / "world")
    world.commit("main", JOB)
    return world


def read_key(world: World, commit: str) -> tuple[str, str]:
    """The seam, called as the command calls it: on the engine paths' files of the commit."""
    seam = vars(source)["read_key"]
    key, why = seam(world.repo, commit, engine_files(world.repo, commit, PATTERNS))
    assert isinstance(key, str)
    assert isinstance(why, str)
    return key, why


def text_at(world: World, commit: str, path: str) -> str:
    return run_git(world.repo, "show", f"{commit}:{path}")


def whole_hash(world: World, commit: str) -> str:
    return code_hash(engine_files(world.repo, commit, PATTERNS))


# Case 1: a PR changing only engine-path files outside the closure reads nothing new ------------------


@pytest.mark.parametrize(
    "path",
    [
        "vextrus/takeoff/tests/test_qx_steps.py",
        "vextrus/takeoff/admin/__init__.py",
        "vextrus/takeoff/http/qx_views.py",
    ],
)
def test_a_pr_changing_only_files_outside_the_closure_reuses_mains_run(world: World, path: str) -> None:
    run("main", no_post=True, m=world.machine())
    assert len(world.sandbox_runs) == 1
    main = world.repo_commit("main")
    world.commit("tuning", {path: edited(path, text_at(world, main, path))})

    assert run("tuning", no_post=True, m=world.machine()) == 0

    assert len(world.sandbox_runs) == 1  # one key for the head and main: main's cached run, no reading


# Case 2: the key moves with the closure and the always-in set, and with nothing else ------------------


@pytest.mark.parametrize("path", IN_THE_KEY)
def test_the_key_moves_when_a_file_in_the_closure_changes(world: World, path: str) -> None:
    main = world.repo_commit("main")
    before, _ = read_key(world, main)

    head = world.commit("tuning", {path: edited(path, text_at(world, main, path))})

    after, why = read_key(world, head)
    assert after != before
    assert why == ""


@pytest.mark.parametrize("path", OUTSIDE_THE_KEY)
def test_the_key_stays_when_a_file_outside_the_closure_changes(world: World, path: str) -> None:
    main = world.repo_commit("main")
    before, _ = read_key(world, main)

    head = world.commit("tuning", {path: edited(path, text_at(world, main, path))})

    assert (whole_hash(world, head) != whole_hash(world, main)) is (path != "README.md")
    after, why = read_key(world, head)
    assert after == before
    assert why == ""


def test_the_key_moves_when_an_entrys_mode_changes(world: World) -> None:
    """Hashed as `code_hash` does: a file's mode is part of what the key covers."""
    main = world.repo_commit("main")
    before, _ = read_key(world, main)
    index = world.root / "mode-index"
    env = {"GIT_INDEX_FILE": str(index)}
    run_git(world.repo, "read-tree", main, env=env)
    oid = run_git(world.repo, "rev-parse", f"{main}:{READ_FILE}")
    run_git(world.repo, "update-index", "--cacheinfo", f"100755,{oid},{READ_FILE}", env=env)
    tree = run_git(world.repo, "write-tree", env=env)
    head = run_git(world.repo, "commit-tree", tree, "-p", main, "-m", "mode")

    after, why = read_key(world, head)

    assert after != before
    assert why == ""


# Case 3: the closure's key is a sha256, the same each time, and not the whole hash --------------------


def test_the_closures_key_is_a_stable_sha256_apart_from_the_whole_hash(world: World) -> None:
    main = world.repo_commit("main")

    key, why = read_key(world, main)

    assert SHA256.fullmatch(key), key
    assert read_key(world, main) == (key, why)
    assert why == ""
    assert key != whole_hash(world, main)


# Case 4: a closure that cannot be found gives the whole hash, and says why ----------------------------


def test_a_missing_entry_gives_the_whole_hash_and_names_it(world: World) -> None:
    head = world.commit("tuning", {READ_FILE: None})

    key, why = read_key(world, head)

    assert key == whole_hash(world, head)
    assert READ_FILE in why


def test_a_closure_file_that_does_not_parse_gives_the_whole_hash_and_names_it(world: World) -> None:
    broken = "vextrus/takeoff/services/qx_steps.py"
    head = world.commit("tuning", {broken: "def qx_step(name:\n"})

    key, why = read_key(world, head)

    assert key == whole_hash(world, head)
    assert broken in why


# Case 5: the cache's folder is the key ----------------------------------------------------------------


def test_the_cached_exports_are_filed_under_the_key(world: World) -> None:
    key, _ = read_key(world, world.repo_commit("main"))

    run("main", no_post=True, m=world.machine())

    assert [p.name for p in (world.cache / "exports").iterdir()] == [key]


# Case 6: "head != main" is the key's: an unscored PR posts only when its closure is main's -----------


def test_an_unscored_pr_whose_closure_is_mains_still_posts(world: World) -> None:
    path = "vextrus/takeoff/tests/test_qx_steps.py"
    world.pr(71, {path: edited(path, text_at(world, world.repo_commit("main"), path))})
    m = dataclasses.replace(world.machine(), score=lambda run_id: 2)

    assert run("71", no_post=False, m=m, accept_if_clean=True) == 0

    assert len(world.posted) == 1
    assert len(world.sandbox_runs) == 1


def test_an_unscored_pr_whose_closure_differs_posts_nothing(world: World) -> None:
    path = "engine/read/qx_core.py"
    world.pr(72, {path: edited(path, text_at(world, world.repo_commit("main"), path))})
    m = dataclasses.replace(world.machine(), score=lambda run_id: 2)

    assert run("72", no_post=False, m=m, accept_if_clean=True) == 3

    assert world.posted == []
