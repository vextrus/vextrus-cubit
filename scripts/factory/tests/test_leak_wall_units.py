"""The S14-P7 refuter's classes, each a check: the allowlist batch's scanner runs from any folder without
PYTHONPATH, an already-allowlisted string is no new hit, and the watcher reads a hit at any path."""

from __future__ import annotations

import ast
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.factory import allowlist, publish, watch

INVENTED = "Wexmoor Glassworks Quay 11"  # invented: no drawing holds it


@pytest.fixture
def corpus(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    home, sources = tmp_path / "leakhome", tmp_path / "src"
    sources.mkdir()
    (sources / "notes.txt").write_text(f"{INVENTED}\n")
    empty = tmp_path / "empty-allowlist.txt"
    empty.write_text("")
    monkeypatch.delenv("VEXTRUS_LEAKSCAN_CMD", raising=False)
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_HOME", str(home))
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_ALLOWLIST", str(empty))
    built = subprocess.run(
        [sys.executable, "-m", "tools.leakscan", "build", "--source", str(sources)],
        cwd=publish.TREE,
        capture_output=True,
        text=True,
        check=False,
    )
    assert built.returncode == 0, built.stdout + built.stderr
    # As `uv run` runs it: no PYTHONPATH, and a current folder outside the tree.
    monkeypatch.delenv("PYTHONPATH", raising=False)
    monkeypatch.chdir(tmp_path)
    hit = tmp_path / "copies" / "plan.md"
    hit.parent.mkdir()
    hit.write_text(f"clean\nthe quay at {INVENTED}\n")
    return hit


def test_the_batch_scanner_finds_a_hit_from_any_folder_without_pythonpath(
    corpus: Path, tmp_path: Path
) -> None:
    target = tmp_path / "trial.txt"
    target.write_text("")
    assert allowlist.scanner_allow(target, f"{corpus}:2") is True
    assert len(allowlist.hashes(target)) == 1
    assert allowlist.scanner_allow(tmp_path / "other.txt", f"{corpus}:1") is False


def test_a_scanner_that_cannot_run_is_an_error_never_a_no_hit(
    corpus: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_CMD", f"{sys.executable} -m no_such_scanner_module")
    with pytest.raises(publish.Refused):
        allowlist.scanner_allow(tmp_path / "x.txt", f"{corpus}:2")


def test_the_watcher_reads_a_hit_whose_path_holds_brackets(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    scanner = tmp_path / "scanner"
    scanner.write_text(
        f"#!{sys.executable}\nprint('HIT docs/plan(1),v2.md:2 1')\n"
        "print('leakscan: hits=1 scanned=1 corpus=0123456789ab')\nraise SystemExit(1)\n"
    )
    scanner.chmod(0o755)
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_CMD", str(scanner))
    found = watch.leak_scan("a" * 40, None)
    assert found["result"] == "hit"
    assert [where for where, _ in found["found"]] == ["docs/plan(1),v2.md:2"]
    assert "docs/plan(1),v2.md:2" in watch.leak_message(found)


def test_the_watcher_and_every_factory_module_it_imports_parse_on_python_3_11() -> None:
    """watch.py runs as `python3 scripts/factory/watch.py` on the machine's own Python (3.11 or later);
    the formatter, aimed at 3.14, rewrites `except (A, B):` into 3.14-only syntax (PR #483 round 1)."""
    folder = publish.TREE / "scripts" / "factory"
    todo, seen = ["watch"], set()
    while todo:
        name = todo.pop()
        if name in seen:
            continue
        seen.add(name)
        tree = ast.parse((folder / f"{name}.py").read_text(), feature_version=(3, 11))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module == "scripts.factory":
                todo += [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and (node.module or "").startswith("scripts.factory."):
                todo.append((node.module or "").rsplit(".", 1)[1])
    assert {"watch", "leakwhere", "status"} <= seen
