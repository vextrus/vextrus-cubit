"""The read job's import closure (`tools.lint.import_closure`) and the run cache's key built on it
(`source.read_key`, ticket T-Q16), past what the acceptance tests pin: what the closure follows and
refuses, and the key's fallback when the job's installed apps cannot be known. Invented trees and an
invented git repository only (`world.py`)."""

import ast
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.real_drawings.command import run
from scripts.real_drawings.source import (
    READ_ENTRIES,
    _installed,
    code_hash,
    engine_files,
    read_key,
)
from scripts.real_drawings.tests.world import REPO, World, make_world, run_git
from tools.lint.engine_paths import matching, read_patterns
from tools.lint.import_closure import ClosureError, closure

PATTERNS = (REPO / ".github" / "engine-paths.txt").read_text(encoding="utf-8")
CHECKOUT_ALSO_TEXT = (REPO / ".github" / "checkout-also.txt").read_text(encoding="utf-8")


def repository_tree() -> list[str]:
    """This checkout's files on the engine paths and beside them, as the run's checkout holds them."""
    listed = subprocess.run(
        ["git", "-C", str(REPO), "ls-files", "-z"], capture_output=True, check=True
    ).stdout.decode()
    patterns = [*read_patterns(PATTERNS), *read_patterns(CHECKOUT_ALSO_TEXT)]
    return matching(sorted(filter(None, listed.split("\0"))), patterns)


def read_repository(name: str) -> bytes | None:
    path = REPO / name
    return path.read_bytes() if path.is_file() else None


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
        "zq/elsewhere/__init__.py": "",  # a package: its data is its own modules'
        "zq/elsewhere/table.toml": "invented = 2\n",
    }

    found = closure_of(tree, ["zq/entry.py"])

    assert {"zq/steps/later.py", "zq/steps/rules.toml"} <= found
    assert "zq/elsewhere/table.toml" not in found


def test_data_in_a_folder_below_that_is_no_package_is_in_but_not_in_a_subpackage() -> None:
    tree = {
        "zq/__init__.py": "",
        "zq/entry.py": "",
        "zq/rules/default.json": "{}",
        "zq/rules/deeper/more.json": "{}",
        "zq/sub/__init__.py": "",
        "zq/sub/own.json": "{}",
        "zq/tests/data/case.json": "{}",
    }

    found = closure_of(tree, ["zq/entry.py"])

    assert {"zq/rules/default.json", "zq/rules/deeper/more.json"} <= found
    assert not found & {"zq/sub/own.json", "zq/tests/data/case.json"}


def test_a_package_that_lists_its_own_folder_loads_each_module() -> None:
    tree = {
        "zq/__init__.py": "",
        "zq/entry.py": "from zq import checks, quiet\n",
        "zq/checks/__init__.py": "from zq.lister import submodules\n\nsubmodules(__name__)\n",
        "zq/checks/first.py": "",
        "zq/checks/inner/__init__.py": "",
        "zq/checks/inner/deep.py": "",
        "zq/quiet/__init__.py": "import logging\n\nLOG = logging.getLogger(__name__)\n",
        "zq/quiet/unloaded.py": "",
        "zq/lister.py": "def submodules(package: str) -> list[str]:\n    return [package]\n",
    }

    found = closure_of(tree, ["zq/entry.py"])

    # Fix round 2: a package loaded by its own name joins whole, at any depth (fail wide).
    assert {"zq/checks/first.py", "zq/checks/inner/__init__.py", "zq/checks/inner/deep.py"} <= found
    assert "zq/quiet/unloaded.py" not in found  # a logger's name lists nothing


def test_a_lister_loads_each_module_of_a_package_its_file_names() -> None:
    tree = {
        "zq/__init__.py": "",
        "zq/entry.py": "from zq import catalogue\n",
        "zq/catalogue.py": (
            'from zq.lister import submodules\n\nPACKAGE = "zq.rules"\n\n\n'
            "def scan() -> object:\n    return submodules(PACKAGE)\n"
        ),
        "zq/lister.py": "def submodules(package: str) -> list[str]:\n    return [package]\n",
        "zq/rules/__init__.py": "",
        "zq/rules/one.py": "",
        "zq/other/__init__.py": "",
        "zq/other/two.py": "",
    }

    found = closure_of(tree, ["zq/entry.py"])

    assert "zq/rules/one.py" in found
    assert "zq/other/two.py" not in found


def test_an_f_string_with_a_written_root_names_each_module_it_can() -> None:
    tree = {
        "zq/__init__.py": "",
        "zq/entry.py": (
            "from importlib import import_module\n\n\n"
            "def load(part: str) -> object:\n"
            '    first = import_module(f"zq.{part}.extra")\n'
            '    return first, f"{part}.anything", f"zq.{part} is not a module"\n'
        ),
        "zq/alpha/__init__.py": "",
        "zq/alpha/extra.py": "",
        "zq/beta/__init__.py": "",
        "zq/beta/extra.py": "",
        "zq/beta/plain.py": "",
    }

    found = closure_of(tree, ["zq/entry.py"])

    assert {"zq/alpha/extra.py", "zq/beta/extra.py", "zq/beta/__init__.py"} <= found
    assert "zq/beta/plain.py" not in found


def test_an_import_written_in_a_child_processs_code_string_is_followed() -> None:
    tree = {
        "zq/__init__.py": "",
        "zq/entry.py": (
            'PRELUDE = "import sys; "\n'
            'CHILD = PRELUDE + "from zq import (child,\\n spare); child.main()"\n'
            'OTHER = "import zq.helper as h"\n'
        ),
        "zq/child.py": "",
        "zq/spare.py": "",
        "zq/helper.py": "",
        "zq/unnamed.py": "",
    }

    found = closure_of(tree, ["zq/entry.py"])

    assert {"zq/child.py", "zq/spare.py", "zq/helper.py"} <= found
    assert "zq/unnamed.py" not in found


def test_a_lazy_getattr_that_imports_by_its_own_name_loads_its_submodules() -> None:
    """Fix round 1 (review of #429): `import_module(f"{__name__}.{name}")`, as a package's lazy
    `__getattr__` writes it, names every submodule of that package, never none."""
    tree = {
        "zq/__init__.py": "",
        "zq/entry.py": "from zq import tools\n\nUSED = tools.second\n",
        "zq/tools/__init__.py": (
            "from importlib import import_module\n\n"
            '__all__ = ["first", "second"]\n\n\n'
            "def __getattr__(name: str) -> object:\n"
            "    if name in __all__:\n"
            '        return import_module(f"{__name__}.{name}")\n'
            "    raise AttributeError(name)\n"
        ),
        "zq/tools/first.py": "",
        "zq/tools/second.py": "",
        "zq/tools/inner/__init__.py": "",
        "zq/tools/inner/deep.py": "",
        "zq/elsewhere/__init__.py": "",
        "zq/elsewhere/other.py": "",
    }

    found = closure_of(tree, ["zq/entry.py"])

    assert {"zq/tools/first.py", "zq/tools/second.py", "zq/tools/inner/deep.py"} <= found
    assert "zq/elsewhere/other.py" not in found


@pytest.mark.parametrize(
    "load",
    [
        'import_module(__name__ + "." + name)',
        'import_module(__package__ + ".second")',
        'import_module(".".join([__name__, name]))',
    ],
)
def test_a_name_built_on_its_own_name_by_other_means_loads_its_submodules(load: str) -> None:
    tree = {
        "zq/__init__.py": "",
        "zq/entry.py": "from zq import tools\n",
        "zq/tools/__init__.py": (
            "from importlib import import_module\n\n\n"
            f"def __getattr__(name: str) -> object:\n    return {load}\n"
        ),
        "zq/tools/second.py": "",
    }

    assert "zq/tools/second.py" in closure_of(tree, ["zq/entry.py"])


SIBLING_FORMS = [
    ("loader.py", 'import_module("." + name, __package__)'),
    ("loader.py", 'import_module(f".{name}", package=__package__)'),
    ("loader.py", 'import_module("%s.%s" % (__package__, name))'),
    ("loader.py", 'import_module("{}.{}".format(__package__, name))'),
    ("loader.py", "import_module(f\"{__name__.rpartition('.')[0]}.{name}\")"),
    ("loader.py", "submodules(__package__)"),
    ("loader.py", 'import_module(__spec__.parent + "." + name)'),
    ("__init__.py", 'import_module("%s.%s" % (__name__, name))'),
    ("__init__.py", 'import_module(__spec__.name + "." + name)'),
    ("__init__.py", 'import_module(f"{__spec__.parent}.{name}")'),
]


@pytest.mark.parametrize(("file", "load"), SIBLING_FORMS)
def test_a_sibling_loaded_by_its_own_packages_name_in_any_read_form_is_in(file: str, load: str) -> None:
    """Fix round 2 (review of #429): every form that builds a sibling's name from the module's own
    name (`__name__`, `__package__`, `__spec__`) loads its package, in an `__init__.py` or not."""
    tree = {
        "zq/__init__.py": "",
        "zq/entry.py": "from zq.tools import loader\n",
        "zq/tools/__init__.py": "",
        "zq/tools/loader.py": "",
        "zq/tools/second.py": "",
        "zq/lister.py": "def submodules(package: str) -> list[str]:\n    return [package]\n",
        "zq/elsewhere/__init__.py": "",
        "zq/elsewhere/other.py": "",
    }
    tree[f"zq/tools/{file}"] = (
        "from importlib import import_module\n\nfrom zq.lister import submodules\n\n\n"
        f"def load(name: str) -> object:\n    return {load}\n"
    )

    found = closure_of(tree, ["zq/entry.py"])

    assert "zq/tools/second.py" in found
    assert "zq/elsewhere/other.py" not in found


@pytest.mark.parametrize(
    "load",
    [
        'import_module(__name__.split(".")[0] + ".second")',  # a split the closure does not read
        "import_module(__spec__.origin)",  # a spec field that is no module name
        "import_module(name + __name__)",  # the own name, but its root not known
    ],
)
def test_a_name_built_from_its_own_name_in_an_unread_form_is_a_closure_error(load: str) -> None:
    tree = {
        "zq/__init__.py": "",
        "zq/entry.py": "from zq import loader\n",
        "zq/loader.py": (
            "from importlib import import_module\n\n\n"
            f"def load(name: str) -> object:\n    return {load}\n"
        ),
    }

    with pytest.raises(ClosureError, match=r"zq/loader\.py:5"):
        closure_of(tree, ["zq/entry.py"])


def test_a_relative_name_resolves_against_the_package_it_is_given() -> None:
    tree = {
        "zq/__init__.py": "",
        "zq/entry.py": "from zq import loader\n",
        "zq/loader.py": (
            "from importlib import import_module\n\n\n"
            "def load(name: str) -> object:\n"
            '    return import_module(f"..tools.{name}", package="zq.other")\n'
        ),
        "zq/tools/__init__.py": "",
        "zq/tools/second.py": "",
        "zq/other/__init__.py": "",
        "zq/other/third.py": "",
    }

    found = closure_of(tree, ["zq/entry.py"])

    assert "zq/tools/second.py" in found
    assert "zq/other/third.py" not in found


def test_a_relative_name_against_no_known_package_is_a_closure_error() -> None:
    tree = {
        "zq/__init__.py": "",
        "zq/entry.py": "from zq import loader\n",
        "zq/loader.py": (
            "from importlib import import_module\n\n\n"
            'def load(name: str, where: str) -> object:\n    return import_module("." + name, where)\n'
        ),
    }

    with pytest.raises(ClosureError, match="no known package"):
        closure_of(tree, ["zq/entry.py"])


def loader_tree(load: str, head: str = "") -> dict[str, str]:
    return {
        "zq/__init__.py": "",
        "zq/entry.py": "from zq import loader\n",
        "zq/loader.py": (
            f"from importlib import import_module\n\nfrom zq.lister import submodules\n{head}\n\n"
            f"def load(name: str, table: dict[str, str]) -> object:\n    return {load}\n"
        ),
        "zq/lister.py": "def submodules(package: str) -> list[str]:\n    return [package]\n",
        "zq/readers/__init__.py": "",
        "zq/readers/first.py": "",
        "zq/readers/deep/__init__.py": "",
        "zq/readers/deep/second.py": "",
        "zq/elsewhere/__init__.py": "",
        "zq/elsewhere/other.py": "",
    }


@pytest.mark.parametrize(
    ("head", "load"),
    [
        ('READERS = "zq.readers"', 'import_module(f"{READERS}.{name}")'),
        ('READERS: str = "zq.readers"', 'import_module(READERS + "." + name)'),
        ('READERS = "zq.readers"', "submodules(READERS)"),
        ("", 'import_module("zq.readers." + name)'),
        ('KINDS = ("zq.readers.first", "zq.readers.deep.second")', "[import_module(k) for k in KINDS]"),
    ],
)
def test_a_name_with_a_literal_root_in_the_same_module_loads_what_it_can_name(
    head: str, load: str
) -> None:
    """Review round 1 of #446: a module-level string constant is a root only when it is a literal
    bound once in the same module; a variable's value then stands for any name parts."""
    found = closure_of(loader_tree(load, head), ["zq/entry.py"])

    assert {"zq/readers/first.py", "zq/readers/deep/second.py"} <= found
    assert "zq/elsewhere/other.py" not in found


@pytest.mark.parametrize(
    ("head", "load"),
    [
        ("from zq.elsewhere import READERS", 'import_module(f"{READERS}.{name}")'),  # not a literal here
        ('READERS = "zq.readers"\nREADERS = "zq.elsewhere"', 'import_module(f"{READERS}.{name}")'),
        ('READERS = "zq." + "readers"', 'import_module(f"{READERS}.{name}")'),  # not a literal
        ("", "import_module(name)"),  # a parameter
        ("", "import_module(table[name])"),  # a table's entry
        ("", 'import_module(__name__.replace("loader", name))'),  # a call on its own name
        ("", "import_module(__name__[:3] + name)"),  # a slice of its own name
        ("", "submodules(name)"),  # a lister given a parameter
        ("", "__import__(name)"),
        ("", "import_module(f'{name}.x')"),  # no root
    ],
)
def test_a_computed_name_no_recognised_form_reads_is_a_closure_error(head: str, load: str) -> None:
    """Review round 1 of #446: an import by a computed name either resolves through a recognised
    form or raises; nothing falls through to "loads nothing" or "loads the module itself"."""
    with pytest.raises(ClosureError, match=r"zq/loader\.py:\d+"):
        closure_of(loader_tree(load, head), ["zq/entry.py"])


def test_its_own_name_passed_on_in_an_unread_form_is_a_closure_error() -> None:
    tree = loader_tree('submodules(__name__.replace("loader", "readers"))')

    with pytest.raises(ClosureError, match=r"zq/loader\.py:\d+"):
        closure_of(tree, ["zq/entry.py"])


def test_a_declared_loaders_callers_must_give_a_name_a_form_reads() -> None:
    """`engine.collect.submodules` is declared: inside it nothing is refused, but a caller must give
    it a name a recognised form reads."""
    tree = {
        "engine/__init__.py": "",
        "engine/collect.py": (
            "from importlib import import_module\n\n\n"
            "def submodules(package: str) -> list[object]:\n"
            '    return [import_module(package), import_module(f"{package}.x")]\n'
        ),
        "engine/entry.py": "from engine import parts\n",
        "engine/parts/__init__.py": "from engine.collect import submodules\n\nsubmodules(__name__)\n",
        "engine/parts/one.py": "",
        "engine/bad.py": (
            "from engine.collect import submodules\n\n\ndef f(p: str) -> None:\n    submodules(p)\n"
        ),
    }

    assert "engine/parts/one.py" in closure_of(tree, ["engine/entry.py"])
    with pytest.raises(ClosureError, match=r"engine/bad\.py:5"):
        closure_of(tree, ["engine/bad.py"])


def test_admin_modules_join_when_the_jobs_settings_install_djangos_admin(world: World) -> None:
    """Review round 1 of #446: Django's admin imports each installed app's `admin` at setup when
    `django.contrib.admin` is installed; the job's settings decide it."""
    admin = "vextrus/takeoff/admin/__init__.py"
    world.commit("main", {admin: "ZQ_ADMIN = 1\n"})
    before, _ = key_at(world, world.repo_commit("main"))
    plain = world.commit("plain", {admin: "ZQ_ADMIN = 2\n"})
    assert key_at(world, plain) == (before, "")

    settings = 'INSTALLED_APPS = ["django.contrib.admin", "vextrus.takeoff"]\n'
    installed = world.commit("installed", {"vextrus/settings/__init__.py": settings})
    with_admin, _ = key_at(world, installed)
    edited = world.commit("edited", {admin: "ZQ_ADMIN = 3\n"}, parent="installed")

    after, why = key_at(world, edited)
    assert (after != with_admin, why) == (True, "")


RUNTIME = """
import importlib, json, os, pathlib, sys
os.environ["DJANGO_SETTINGS_MODULE"] = "vextrus.settings.job"
import django
django.setup()
from django.apps import apps
from django.core.management import get_commands, load_command_class
from django.db.migrations.loader import MigrationLoader
import vextrus.takeoff.tasks.read_file
import vextrus.takeoff.services.export
import vextrus.takeoff.services as services
for name in services.__all__:
    getattr(services, name)
from engine import harness, messages
from engine.check import catalogue
for stage in harness.STAGES:
    harness.resolve(stage.target)
catalogue.scan()
messages.codes()
for app in apps.get_app_configs():
    if app.name.startswith("vextrus."):
        for part in ("messages", "library", "tasks"):
            if importlib.util.find_spec(f"{app.name}.{part}") is not None:
                module = importlib.import_module(f"{app.name}.{part}")
                if part == "messages":
                    module.codes()
for command, app in get_commands().items():
    if app.startswith("vextrus."):
        load_command_class(app, command)
MigrationLoader(None, ignore_no_migrations=True)
root = pathlib.Path.cwd().resolve()
found = set()
for module in list(sys.modules.values()):
    path = getattr(module, "__file__", None)
    if path and pathlib.Path(path).resolve().is_relative_to(root):
        relative = pathlib.Path(path).resolve().relative_to(root).as_posix()
        if not relative.startswith(".venv/"):
            found.add(relative)
print(json.dumps(sorted(found)))
"""
"""The read job as the sandbox starts it, as far as importing goes (T-249's B3 case 6): Django set up
on the job's settings, both entries, every lazily loaded service, every stage target, the Checks'
catalogue, every message code, each installed app's `library` and `tasks`, every management command
and the migrations; the repository files it imported, as JSON."""


def test_every_file_the_job_imports_at_run_time_is_in_its_closure() -> None:
    """T-249's B3 case 6, committed (review round 1 of #446): the repository files the read job
    imports, run under `vextrus.settings.job`, are each in the job's closure on this checkout."""
    env = {**os.environ, "PYTHONPATH": str(REPO)}
    env.pop("DJANGO_SETTINGS_MODULE", None)
    done = subprocess.run(
        [sys.executable, "-c", RUNTIME], cwd=REPO, env=env, capture_output=True, text=True, check=False
    )
    assert done.returncode == 0, done.stderr[-2000:]
    imported = set(json.loads(done.stdout.strip().splitlines()[-1]))
    tree = repository_tree()

    found = closure(read_repository, [*READ_ENTRIES, *_installed(read_repository, tree)], tree)

    assert imported
    assert sorted(imported - found) == []


def test_every_module_the_takeoff_services_package_loads_lazily_is_in_the_jobs_closure() -> None:
    """On this repository: `vextrus/takeoff/services/__init__.py` imports each name of its `__all__`
    on first use, by its own name; each one is in the read job's closure."""
    tree = repository_tree()

    found = closure(read_repository, [*READ_ENTRIES, *_installed(read_repository, tree)], tree)

    package = "vextrus/takeoff/services"
    module = ast.parse((REPO / package / "__init__.py").read_text(encoding="utf-8"))
    [names] = [
        ast.literal_eval(node.value)
        for node in module.body
        if isinstance(node, ast.Assign) and any(getattr(t, "id", "") == "__all__" for t in node.targets)
    ]
    assert names
    for name in names:
        assert {f"{package}/{name}.py", f"{package}/{name}/__init__.py"} & found, name


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
    "vextrus/takeoff/tasks/zq_sweep.py": "ZQ_SWEEP = 9\n",
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


def test_a_task_module_procrastinate_finds_is_in_the_key(world: World) -> None:
    before, _ = key_at(world, world.repo_commit("main"))

    head = world.commit("sweep", {"vextrus/takeoff/tasks/zq_sweep.py": "ZQ_SWEEP = 10\n"})

    after, why = key_at(world, head)
    assert (after != before, why) == (True, "")


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
