"""PR #291's review round 3 (f2): `allow` hashes only what spans a line break, and the corpus cannot be
rebuilt small or from a chosen folder. Invented strings only; every corpus and folder is temporary."""

import subprocess
import sys
from pathlib import Path

import pytest

from tools.leakscan.tests.acceptance._leak import MARIGOLD, REPO, ZEBRA, Leak, git_env


@pytest.fixture
def leak(tmp_path: Path) -> Leak:
    built = Leak(tmp_path)
    built.build()
    return built


def test_allowing_a_line_leaves_a_literal_on_the_next_line_a_hit(leak: Leak) -> None:
    body = leak.tmp / "f.md"
    body.write_text(f"{MARIGOLD}\n{ZEBRA}\n")
    assert leak.run("allow", f"{body}:1").returncode == 0
    alone = leak.tmp / "alone.md"
    alone.write_text(f"{ZEBRA}\n")
    assert leak.run("file", str(alone), "--no-stamp").returncode == 1


def test_allowing_a_clean_line_before_a_literal_is_refused(leak: Leak) -> None:
    body = leak.tmp / "f.md"
    body.write_text(f"a clean line\n{ZEBRA}\n")
    assert leak.run("allow", f"{body}:1").returncode == 1
    assert leak.allowlist.read_text().strip() == ""


def _without_seam(tmp_path: Path, *args: str) -> subprocess.CompletedProcess[str]:
    # The main checkout is a temporary folder, so even the default leak home is never the real one.
    env = git_env(VEXTRUS_MAIN_CHECKOUT=str(tmp_path / "main"), PYTHONPATH=str(REPO))
    env.pop("VEXTRUS_LEAKSCAN_HOME", None)
    env["VEXTRUS_LEAKSCAN_ALLOWLIST"] = str(tmp_path / "allow.txt")
    return subprocess.run(
        [sys.executable, "-m", "tools.leakscan", *args],
        cwd=tmp_path,
        env=env,
        input="anything\n",
        capture_output=True,
        text=True,
        check=False,
    )


def test_build_from_a_chosen_folder_needs_the_test_seam(tmp_path: Path) -> None:
    source = tmp_path / "src"
    source.mkdir()
    (source / "a.txt").write_text(f"{ZEBRA}\n")
    assert _without_seam(tmp_path, "build", "--source", str(source)).returncode == 64
    assert not (tmp_path / "main/.private/work/leakscan/corpus").exists()


def test_a_corpus_under_the_floor_is_refused_outside_the_seam(tmp_path: Path) -> None:
    home = tmp_path / "main/.private/work/leakscan"
    home.mkdir(parents=True)
    (home / "corpus").write_text(f"{ZEBRA.upper()}\n")
    done = _without_seam(tmp_path, "text", "--stdin", "--no-stamp")
    assert done.returncode == 2
    assert done.stdout.strip().splitlines()[-1] == "leakscan: cannot-scan corpus-unreadable"


def test_a_rebuild_that_loses_half_the_corpus_is_refused_unless_forced(leak: Leak) -> None:
    before = leak.corpus_hash
    small = leak.tmp / "small"
    small.mkdir()
    (small / "a.txt").write_text(f"{ZEBRA}\n")
    done = leak.run("build", "--source", str(small))
    assert done.returncode == 2
    assert leak.corpus_hash == before
    assert leak.run("build", "--source", str(small), "--force").returncode == 0
    assert leak.corpus_hash != before
