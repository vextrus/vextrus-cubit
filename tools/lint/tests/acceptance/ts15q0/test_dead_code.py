"""S15-Q0: dead code (the ticket: "vulture with a committed whitelist as a CI step (the four dead
functions clip_segments, type3_font, inputs_of, _get_key removed)"; Python over engine, vextrus,
scripts and tools).

The seam is `python -m vulture` with no argument, its paths, whitelist and confidence read from
`pyproject.toml` (see `_tree.py`). The tree as it is passes; a function planted in a copy and called
by nothing fails, named (so the gate reports unused functions, vulture's 60 % confidence class, not
only its 90-100 % ones). `_get_key` is not pinned removed: it overrides Ninja's own hook
(`APIKeyBase.__call__` calls `self._get_key`), so it is live. `labels_of` stays: issue #423 called it
dead, but sheet_list calls it (the ticket closes #423 as wrong).
"""

import importlib
import sys
from pathlib import Path

import pytest

from ._tree import REPO, ROOTS, copy_repo, output, plant, run, workflow_lines


def vulture(root: Path) -> tuple[int, str]:
    result = run(root, sys.executable, "-m", "vulture")
    return result.returncode, output(result)


def test_the_unchanged_code_has_no_dead_code(tmp_path: Path) -> None:
    root = copy_repo(tmp_path)

    code, said = vulture(root)

    assert code == 0, said


@pytest.mark.parametrize("top", ROOTS)
def test_a_planted_dead_function_fails_naming_it(tmp_path: Path, top: str) -> None:
    root = copy_repo(tmp_path)
    name = f"planted_q0_dead_{top}"
    plant(root, f"{top}/planted_q0_dead.py", f"def {name}(n: int) -> int:\n    return n + 1\n")

    code, said = vulture(root)

    assert code != 0, f"{said} (vulture passed a function nothing calls, in {top})"
    assert name in said, f"{said} (vulture did not name {name})"


def test_a_planted_function_that_is_called_passes(tmp_path: Path) -> None:
    root = copy_repo(tmp_path)
    source = "def planted_q0_used(n: int) -> int:\n    return n + 1\n\n\nTWO = planted_q0_used(1)\n"
    plant(root, "engine/planted_q0_used.py", source)
    plant(root, "engine/planted_q0_reader.py", "from engine.planted_q0_used import TWO\n\nprint(TWO)\n")

    code, said = vulture(root)

    assert code == 0, said


@pytest.mark.parametrize(
    ("module", "name"),
    [
        ("engine.render.buffers", "clip_segments"),
        ("engine.fixtures.pdf._writer", "type3_font"),
        ("vextrus.testing.jev", "inputs_of"),
    ],
)
def test_the_dead_function_is_removed(module: str, name: str) -> None:
    loaded = importlib.import_module(module)

    assert not hasattr(loaded, name), f"{name} is still defined in {module}"


def test_labels_of_stays_because_sheet_list_calls_it() -> None:
    loaded = importlib.import_module("vextrus.drawings.services.library_disciplines")

    assert callable(getattr(loaded, "labels_of", None))


def test_ci_runs_vulture() -> None:
    steps = [line for line in workflow_lines(REPO) if "-m vulture" in line or "vulture" in line.split()]

    assert steps, "no CI workflow step runs vulture"
