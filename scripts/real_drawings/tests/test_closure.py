"""The read job's import closure (`tools.lint.import_closure`) and the run cache's key built on it
(`source.read_key`, ticket T-Q16), past what the acceptance tests pin: what the closure follows and
refuses, and the key's fallback when the job's installed apps cannot be known. Invented trees and an
invented git repository only (`world.py`)."""

from pathlib import Path

import pytest

from scripts.real_drawings.command import run
from scripts.real_drawings.source import code_hash, engine_files, read_key
from scripts.real_drawings.tests.world import REPO, World, make_world, run_git
from tools.lint.import_closure import ClosureError, closure

PATTERNS = (REPO / ".github" / "engine-paths.txt").read_text(encoding="utf-8")


def closure_of(tree: dict[str, str], entries: list[str]) -> frozenset[str]:
    def read(name: str) -> bytes | None:
        return tree[name].encode() if name in tree else None

    return closure(read, entries, sorted(tree))


# The closure ------------------------------------------------------------------------------------------


def test_a_type_checking_import_is_not_followed_but_its_else_is() -> None:
    tree = {
        "zq/__init__.py": "",
        "zq/entry.py": (
            "from typing import TYPE_CHECKING\n\n"
            "if TYPE_CHECKING:\n    from zq import typed_only\nelse:\n    from zq import at_run\n"
        ),
        "zq/typed_only.py": "",
        "zq/at_run.py": "",
    }

    found = closure_of(tree, ["zq/entry.py"])

    assert "zq/at_run.py" in found
    assert "zq/typed_only.py" not in found


def test_relative_imports_resolve_from_the_files_own_package() -> None:
    tree = {
        "zq/__init__.py": "",
        "zq/inner/__init__.py": "",
        "zq/inner/entry.py": "from . import sibling\nfrom ..outer import helper\n",
        "zq/inner/sibling.py": "",
        "zq/outer/__init__.py": "",
        "zq/outer/helper.py": "",
        "zq/outer/stranger.py": "",
    }

    found = closure_of(tree, ["zq/inner/entry.py"])

    assert {"zq/inner/sibling.py", "zq/outer/helper.py", "zq/outer/__init__.py"} <= found
    assert "zq/outer/stranger.py" not in found


def test_a_string_target_and_a_data_file_beside_a_followed_module_are_in() -> None:
    tree = {
        "zq/__init__.py": "",
        "zq/entry.py": 'STEP = "zq.steps.later:go"\n',
        "zq/steps/__init__.py": "",
        "zq/steps/later.py": "def go() -> None: ...\n",
        "zq/steps/rules.toml": "invented = 1\n",
        "zq/elsewhere/table.toml": "invented = 2\n",
    }

    found = closure_of(tree, ["zq/entry.py"])

    assert {"zq/steps/later.py", "zq/steps/rules.toml"} <= found
    assert "zq/elsewhere/table.toml" not in found


def test_a_test_is_never_followed_and_never_an_entry() -> None:
    tree = {
        "zq/__init__.py": "",
        "zq/entry.py": "from zq.tests import helpers\nfrom zq import conftest\n",
        "zq/tests/__init__.py": "",
        "zq/tests/helpers.py": "",
        "zq/conftest.py": "",
    }

    assert closure_of(tree, ["zq/entry.py"]) == {"zq/__init__.py", "zq/entry.py"}
    with pytest.raises(ClosureError, match="is a test"):
        closure_of(tree, ["zq/tests/helpers.py"])


def test_a_followed_file_that_cannot_be_read_is_a_closure_error() -> None:
    tree = {"zq/__init__.py": "", "zq/entry.py": "from zq import gone\n", "zq/gone.py": ""}

    def read(name: str) -> bytes | None:
        return None if name == "zq/gone.py" else tree[name].encode()

    with pytest.raises(ClosureError, match=r"zq/gone\.py"):
        closure(read, ["zq/entry.py"], sorted(tree))


# The key ----------------------------------------------------------------------------------------------

READ_FILE = "vextrus/takeoff/tasks/read_file.py"
EXPORT = "vextrus/takeoff/services/export.py"
JOB_SETTINGS = "vextrus/settings/job.py"

JOB: dict[str, str | None] = {
    "vextrus/__init__.py": "",
    "vextrus/settings/__init__.py": "",
    JOB_SETTINGS: 'JOB_MODULES = ("takeoff",)\n',
    "vextrus/takeoff/__init__.py": "",
    "vextrus/takeoff/tasks/__init__.py": "",
    READ_FILE: "ZQ_READ = 1\n",
    "vextrus/takeoff/services/__init__.py": "",
    EXPORT: "from vextrus.takeoff.tasks import read_file\n",
    "vextrus/takeoff/migrations/__init__.py": "",
    "vextrus/takeoff/migrations/0001_zq.py": "from vextrus.takeoff import zq_fields\n",
    "vextrus/takeoff/zq_fields.py": "ZQ_FIELD = 2\n",
    "vextrus/takeoff/zq_page.py": "ZQ_PAGE = 3\n",
    "vextrus/projects/__init__.py": "",
    "vextrus/projects/models.py": "ZQ_NOT_INSTALLED = 4\n",
}


@pytest.fixture
def world(tmp_path: Path) -> World:
    world = make_world(tmp_path / "world")
    world.commit("main", JOB)
    return world


def key_at(world: World, commit: str) -> tuple[str, str]:
    return read_key(world.repo, commit, engine_files(world.repo, commit, PATTERNS))


def whole_hash(world: World, commit: str) -> str:
    return code_hash(engine_files(world.repo, commit, PATTERNS))


def test_a_module_an_installed_apps_migration_imports_is_in_the_key(world: World) -> None:
    before, _ = key_at(world, world.repo_commit("main"))

    moved = world.commit("fields", {"vextrus/takeoff/zq_fields.py": "ZQ_FIELD = 5\n"})
    stayed = world.commit("page", {"vextrus/takeoff/zq_page.py": "ZQ_PAGE = 6\n"})

    after, why = key_at(world, moved)
    assert (after != before, why) == (True, "")
    assert key_at(world, stayed) == (before, "")


def test_an_app_job_modules_does_not_name_is_not_in_the_key(world: World) -> None:
    before, _ = key_at(world, world.repo_commit("main"))

    head = world.commit("projects", {"vextrus/projects/models.py": "ZQ_NOT_INSTALLED = 7\n"})

    assert whole_hash(world, head) != whole_hash(world, world.repo_commit("main"))
    assert key_at(world, head) == (before, "")


@pytest.mark.parametrize(
    "settings",
    [
        "ZQ_OTHER = 1\n",  # no JOB_MODULES
        "JOB_MODULES = tuple(ZQ_NAMES)\n",  # not a literal
        'JOB_MODULES = ("takeoff", "*")\n',  # a glob, not a module's name
        'JOB_MODULES = ("takeoff/../projects",)\n',  # a path, not a module's name
        "JOB_MODULES = (\n",  # does not parse
        None,  # no job settings at all
    ],
)
def test_job_settings_that_name_no_plain_modules_give_the_whole_hash(
    world: World, settings: str | None
) -> None:
    head = world.commit("settings", {JOB_SETTINGS: settings})

    key, why = key_at(world, head)

    assert key == whole_hash(world, head)
    assert JOB_SETTINGS in why
    assert "whole code hash" in why


def test_the_command_says_why_it_keys_by_the_whole_hash(world: World) -> None:
    world.commit("main", {READ_FILE: None})

    assert run("main", no_post=True, m=world.machine()) == 0

    assert any(READ_FILE in line and "whole code hash" in line for line in world.said)
    main = world.repo_commit("main")
    assert [p.name for p in (world.cache / "exports").iterdir()] == [whole_hash(world, main)]


def test_a_cached_run_is_reused_across_a_change_outside_the_key(world: World) -> None:
    run("main", no_post=True, m=world.machine())
    world.commit("page", {"vextrus/takeoff/zq_page.py": "ZQ_PAGE = 8\n"})

    assert run("page", no_post=True, m=world.machine()) == 0

    assert len(world.sandbox_runs) == 1
    assert any("is cached; not run again" in line for line in world.said)
    assert run_git(world.repo, "rev-parse", "page") != world.repo_commit("main")
