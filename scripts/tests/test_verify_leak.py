"""#412: verify leak-scans `<merge-base>..<the staged tree>` and writes no record on a hit.

A fixture repository with an `origin/main`, a fake corpus built by the scanner's own test seam (an
INVENTED string no drawing holds), and verify's checks replaced by a run that passes, so only the scan
decides.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from scripts import verify

REPO = Path(__file__).resolve().parents[2]
INVENTED = "Marrowgate Tannery Close 4"
WORD = "MARROWGATE"


def _git(cwd: Path, *args: str) -> str:
    done = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, check=True)
    return done.stdout.strip()


@pytest.fixture
def repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    for key in list(os.environ):
        if key.startswith(("GIT_", "VEXTRUS_")) or key == "CLAUDE_CODE_REMOTE":
            monkeypatch.delenv(key)
    config = tmp_path / "gitconfig"
    config.write_text("[user]\n\tname = t\n\temail = t@example.invalid\n[commit]\n\tgpgsign = false\n")
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", str(config))
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    home, allowlist, sources = tmp_path / "leakhome", tmp_path / "allowlist.txt", tmp_path / "src"
    allowlist.write_text("")
    sources.mkdir()
    (sources / "notes.txt").write_text(f"{INVENTED}\n")
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_HOME", str(home))
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_ALLOWLIST", str(allowlist))
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_CMD", f"{sys.executable} -m tools.leakscan")
    monkeypatch.setenv("PYTHONPATH", str(REPO))
    built = subprocess.run(
        [sys.executable, "-m", "tools.leakscan", "build", "--source", str(sources)],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )
    assert built.returncode == 0, built.stdout + built.stderr

    work = tmp_path / "work"
    work.mkdir()
    _git(work, "init", "-q", "-b", "main")
    (work / "README").write_text("seed\n")
    _git(work, "add", "README")
    _git(work, "commit", "-q", "-m", "seed")
    _git(work, "update-ref", "refs/remotes/origin/main", "HEAD")
    _git(work, "checkout", "-q", "-b", "t1")
    monkeypatch.chdir(work)
    return work


def _record(repo: Path) -> list[Path]:
    return sorted((repo / ".git" / "vextrus").glob("verify-*.json"))


def _passes(check: verify.Check) -> tuple[int, str]:
    return 0, ""


def test_a_last_commit_adding_a_corpus_string_gets_no_verify_record(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    (repo / "plan.md").write_text(f"clean\nthe yard at {INVENTED}\n")
    _git(repo, "add", "plan.md")
    _git(repo, "commit", "-q", "-m", "feat: the plan")

    code = verify.main([], run=_passes)

    said = capsys.readouterr()
    assert WORD not in (said.out + said.err).upper()
    assert code == 1
    assert "plan.md:2" in said.err
    assert f"local commit {_git(repo, 'rev-parse', 'HEAD')[:12]}, not pushed" in said.err
    assert "amend or soft-reset" in said.err
    assert _record(repo) == []


def test_a_hit_in_a_pushed_commit_names_it_with_the_fresh_branch_remedy(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    (repo / "plan.md").write_text(f"the yard at {INVENTED}\n")
    _git(repo, "add", "plan.md")
    _git(repo, "commit", "-q", "-m", "feat: the plan")
    _git(repo, "update-ref", "refs/remotes/origin/t1", "HEAD")
    (repo / "later.md").write_text("an invented stand-in\n")
    _git(repo, "add", "later.md")

    code = verify.main([], run=_passes)

    said = capsys.readouterr()
    assert WORD not in (said.out + said.err).upper()
    assert code == 1
    pushed = _git(repo, "rev-parse", "HEAD")[:12]
    assert f"commit {pushed} (already pushed): start a fresh branch from main" in said.err
    assert "amend" not in said.err
    assert _record(repo) == []


def test_a_staged_but_uncommitted_hit_is_found_before_the_ready_commit(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    (repo / "notes.txt").write_text(f"{INVENTED}\n")
    _git(repo, "add", "notes.txt")

    code = verify.main([], run=_passes)

    said = capsys.readouterr()
    assert WORD not in (said.out + said.err).upper()
    assert code == 1
    assert "notes.txt:1" in said.err
    assert "the staged changes, not committed" in said.err
    assert _record(repo) == []


def test_a_staged_hit_is_found_with_no_git_identity_configured(
    repo: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    bare = tmp_path / "no-identity"
    bare.write_text("[user]\n\tuseConfigOnly = true\n")
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", str(bare))
    (repo / "notes.txt").write_text(f"{INVENTED}\n")
    _git(repo, "add", "notes.txt")

    code = verify.main([], run=_passes)

    said = capsys.readouterr()
    assert WORD not in (said.out + said.err).upper()
    assert code == 1
    assert "notes.txt:1" in said.err
    assert _record(repo) == []


def test_a_clean_range_writes_the_record_and_stamps_nothing(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    (repo / "plan.md").write_text("an invented stand-in\n")
    _git(repo, "add", "plan.md")

    code = verify.main([], run=_passes)

    assert code == 0, capsys.readouterr()
    [record] = _record(repo)
    assert json.loads(record.read_text())["ok"] is True
    assert not (Path(os.environ["VEXTRUS_LEAKSCAN_HOME"]) / "ok").exists()


def test_with_no_corpus_the_scan_is_a_note_and_verify_goes_on(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    (Path(os.environ["VEXTRUS_LEAKSCAN_HOME"]) / "corpus").unlink()
    (repo / "plan.md").write_text("clean\n")
    _git(repo, "add", "plan.md")

    assert verify.main([], run=_passes) == 0
    assert "leak scan not run: no corpus" in capsys.readouterr().out
