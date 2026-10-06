"""Ticket S15-T1, "The posting cache keys on the modules the read job loads", its check: "two posting
runs on one head, second is a cache hit; a head changing only web/ hits the cache" (Rebuild T-Q16,
s13-q16b; session 14's brief: "Prove it on a PR that changes a lazily loaded reader (the cache must
miss) and on a docs-only change (it must hit)").

At the command's boundary (`scripts.real_drawings.command.run` on `world.py`'s invented repository
and fake sandbox): a read is one call of the sandbox; a cache hit is none. The invented job is
`job.py`'s. What the job loads (at the top, inside a function, in a child interpreter, by `-m`, a
conventions file beside a reader, or by a name computed at run time) reads again when it changes; what
it never loads (a test, a web file) does not. Nothing reads a DWG, the network or `.private/`.
"""

from pathlib import Path

import pytest

from scripts.real_drawings.command import run
from scripts.real_drawings.tests.acceptance.ts15_t1.job import (
    CHILD,
    CONVENTIONS,
    ENGINE_TEST,
    EXPORT,
    JOB,
    JOB_TEST,
    LAZY,
    PLAN,
    READ_FILE,
    RUNNER,
    SPARE,
    WEB,
    edits,
    job_world,
)
from scripts.real_drawings.tests.world import World, make_world


@pytest.fixture
def world(tmp_path: Path) -> World:
    return job_world(make_world(tmp_path / "world"))


def reads(world: World) -> int:
    return len(world.sandbox_runs)


def told(world: World) -> str:
    """What the command said of the cache and the reading, run by run."""
    return " | ".join(line for line in world.said if "cached" in line or "installing" in line)


def mains_run(world: World) -> int:
    """Main read once, as every later run finds it in the cache; the reads so far."""
    assert run("main", no_post=True, m=world.machine()) == 0
    return reads(world)


# The check's first half: a second posting run on one head is a cache hit -----------------------------


def test_a_second_posting_run_on_one_head_reads_nothing(world: World) -> None:
    world.pr(71, edits(world, PLAN))  # a reading change: the head and main are each read once
    assert run("71", no_post=False, m=world.machine(), accept_if_clean=True) == 0
    read = reads(world)
    assert read == 2

    assert run("71", no_post=False, m=world.machine(), accept_if_clean=True) == 0

    assert reads(world) == read, "read again: " + told(world)
    assert len(world.posted) == 2


# The check's second half: a head changing only what the job never loads hits main's cache -----------


def test_a_head_changing_only_web_reuses_mains_run(world: World) -> None:
    read = mains_run(world)
    world.pr(72, edits(world, WEB))

    assert run("72", no_post=False, m=world.machine(), accept_if_clean=True) == 0

    assert reads(world) == read, "read again: " + told(world)
    assert len(world.posted) == 1


def test_a_posting_run_of_a_head_changing_only_tests_and_web_reuses_mains_run(world: World) -> None:
    """A test beside the job's module and an engine test are engine paths, never loaded by the job."""
    read = mains_run(world)
    world.pr(73, edits(world, JOB_TEST, ENGINE_TEST, WEB))

    assert run("73", no_post=False, m=world.machine(), accept_if_clean=True) == 0

    assert reads(world) == read, "read again: " + told(world)
    assert len(world.posted) == 1


# What the job loads misses the cache, however it is loaded --------------------------------------------


@pytest.mark.parametrize(
    "path",
    [
        READ_FILE,  # the job's entry
        EXPORT,  # the export's entry
        PLAN,  # imported at the top of the entry
        LAZY,  # a lazily loaded reader: imported inside the entry's function
        CHILD,  # imported by code a child interpreter is given
        RUNNER,  # run as `python -m`
        CONVENTIONS,  # a conventions file the reader reads beside itself
    ],
)
def test_a_head_changing_what_the_job_loads_reads_again(world: World, path: str) -> None:
    read = mains_run(world)
    world.commit("tuning", edits(world, path))

    assert run("tuning", no_post=True, m=world.machine()) == 0

    assert reads(world) == read + 1, "a cache hit on a reading change: " + told(world)


LOADERS = {
    "import_module": (
        "import importlib\n\n\ndef qx_load(kind: str) -> object:\n"
        "    return importlib.import_module(kind)\n"
    ),
    "an aliased import_module": (
        "from importlib import import_module as qx_import\n\n\n"
        "def qx_load(kind: str) -> object:\n    return qx_import(kind)\n"
    ),
    "__import__ with a fromlist": (
        'def qx_load(kind: str) -> object:\n    return __import__(kind, fromlist=["qx"])\n'
    ),
    "a module spec from a file": (
        "import importlib.util\n\n\ndef qx_load(path: str) -> object:\n"
        '    spec = importlib.util.spec_from_file_location("qx", path)\n'
        "    assert spec is not None and spec.loader is not None\n"
        "    module = importlib.util.module_from_spec(spec)\n"
        "    spec.loader.exec_module(module)\n"
        "    return module\n"
    ),
    "runpy": "import runpy\n\n\ndef qx_load(kind: str) -> object:\n    return runpy.run_module(kind)\n",
    "a package's listing": (
        "import importlib\nimport pkgutil\n\nimport engine.read\n\n\n"
        "def qx_load() -> list[object]:\n"
        "    return [\n"
        '        importlib.import_module("engine.read." + found.name)\n'
        "        for found in pkgutil.iter_modules(engine.read.__path__)\n"
        "    ]\n"
    ),
}


@pytest.mark.parametrize("form", sorted(LOADERS))
def test_a_job_loading_by_a_name_given_at_run_time_reads_again_when_an_engine_module_changes(
    tmp_path: Path, form: str
) -> None:
    """Which module such a call loads is not known before the job runs: any engine module may be it."""
    loader = str(JOB[EXPORT]) + "\n\n" + LOADERS[form]
    world = job_world(make_world(tmp_path / "world"), {EXPORT: loader})
    read = mains_run(world)
    world.commit("tuning", edits(world, SPARE))

    assert run("tuning", no_post=True, m=world.machine()) == 0

    assert reads(world) == read + 1, "a cache hit on a reading change: " + told(world)
