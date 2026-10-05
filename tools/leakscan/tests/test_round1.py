"""PR #291's review round 1 (f2): what a push publishes, commit by commit, and what the corpus takes in.

Invented strings only (the acceptance helpers' literals); every repository and corpus is temporary.
"""

import gzip
import json
import subprocess
import sys
from pathlib import Path

import pytest

from tools.leakscan import cli, core, sources
from tools.leakscan.tests.acceptance import _gh_stub
from tools.leakscan.tests.acceptance._leak import (
    MARIGOLD,
    REPO,
    ZEBRA,
    Leak,
    assert_no_text,
    commit,
    git,
    hits,
    temp_repo,
)


@pytest.fixture
def leak(tmp_path: Path) -> Leak:
    built = Leak(tmp_path)
    built.build()
    return built


def _range(leak: Leak, repo: Path, base: str) -> subprocess.CompletedProcess[str]:
    return leak.run("range", f"{base}..HEAD", "--no-stamp", cwd=repo)


def test_a_literal_added_then_removed_is_still_found(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    commit(repo, {"a.txt": f"one\n{ZEBRA}\n"}, "feat: a")
    commit(repo, {}, "fix: remove it", remove=("a.txt",))
    done = _range(leak, repo, base)
    assert done.returncode == 1
    assert ("a.txt:2", 1) in hits(done)
    assert_no_text(done)


def test_a_file_name_added_then_renamed_is_still_found(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    commit(repo, {f"plans/{MARIGOLD}.txt": "clean\n"}, "feat: a")
    git(repo, "mv", f"plans/{MARIGOLD}.txt", "plans/renamed.txt")
    git(repo, "commit", "-q", "-m", "fix: rename")
    done = _range(leak, repo, base)
    assert done.returncode == 1
    assert_no_text(done)


def test_an_added_line_starting_plus_plus_is_scanned_and_never_printed(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    commit(repo, {"g.txt": f"++ {ZEBRA}\nsee {ZEBRA}\n"}, "feat: g")
    done = _range(leak, repo, base)
    assert done.returncode == 1
    assert ("g.txt:1", 1) in hits(done)
    assert_no_text(done)


@pytest.mark.parametrize(
    ("name", "data"),
    [
        ("b.txt", f"clean\0line\n{ZEBRA}\n".encode()),
        ("c.csv", ("﻿" + f"a,{ZEBRA}\n").encode("utf-16-le")),
        ("i.gz", gzip.compress(f"{ZEBRA}\n".encode())),
    ],
)
def test_a_binary_blob_is_scanned(leak: Leak, name: str, data: bytes) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    (repo / name).write_bytes(data)
    git(repo, "add", "--", name)
    git(repo, "commit", "-q", "-m", "feat: a binary")
    done = _range(leak, repo, base)
    assert done.returncode == 1, done.stdout
    assert_no_text(done)


def test_a_minus_diff_attribute_does_not_hide_text(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    commit(repo, {".gitattributes": "* -diff\n", "d.txt": f"{ZEBRA}\n"}, "feat: attributes")
    assert _range(leak, repo, base).returncode == 1


def test_a_string_wrapped_over_two_lines_is_found(leak: Leak) -> None:
    first, second = ZEBRA.rsplit(" ", 2)[0], " ".join(ZEBRA.rsplit(" ", 2)[1:])
    repo, base = temp_repo(leak.tmp / "work")
    commit(repo, {"docs/adr.md": f"# The lessee\n- {first}\n- {second}\n"}, "docs: wrapped")
    done = _range(leak, repo, base)
    assert done.returncode == 1
    assert ("docs/adr.md:2", 1) in hits(done)
    body = leak.tmp / "body.md"
    body.write_text(f"// {first}\n// {second}\n")
    assert leak.run("file", str(body), "--no-stamp").returncode == 1
    # A generic wrapped string is allowlisted from its first line, as a hit there is reported.
    assert leak.run("allow", f"{body}:1").returncode == 0
    assert leak.run("file", str(body), "--no-stamp").returncode == 0


def test_an_empty_corpus_refuses_every_scan(tmp_path: Path) -> None:
    leak = Leak(tmp_path)
    empty = tmp_path / "empty"
    empty.mkdir()
    assert leak.run("build", "--source", str(empty)).returncode == 0
    done = leak.run("text", "--stdin", "--no-stamp", stdin="anything\n")
    assert done.returncode == 2
    assert done.stdout.strip().splitlines()[-1] == "leakscan: cannot-scan corpus-unreadable"


@pytest.mark.parametrize(
    "args", [["build", "--sou", "x"], ["build", "--s=x"], ["range", "a..b", "--no-st"]]
)
def test_an_abbreviated_option_is_a_usage_error(leak: Leak, args: list[str]) -> None:
    assert leak.run(*args).returncode == 64


def test_a_pr_commit_missing_from_the_clone_refuses_the_scan(leak: Leak) -> None:
    repo, _ = temp_repo(leak.tmp / "work")
    folder = leak.tmp / "bin"
    _gh_stub.install(folder, sys.executable)
    done = leak.run("pr", "12", cwd=repo, path_prefix=folder)
    assert done.returncode == 2
    assert done.stdout.strip().splitlines()[-1] == "leakscan: cannot-scan gh-failed"


def test_a_walks_own_words_never_enter_the_corpus(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A walk laid out like f5's: its record, its verdict and its public drafts hold closed words only.
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_ALLOWLIST", str(tmp_path / "allow.txt"))
    walks = tmp_path / "walks"
    closed = ["reads_complete", "act_p95_during_read", "questions_per_discipline", "severity: major"]
    for sha in ("a" * 40, "b" * 40):
        walk = walks / sha
        (walk / "public").mkdir(parents=True)
        (walk / "logs").mkdir()
        (walk / "walk.json").write_text(json.dumps({"checks": closed, "screen": "takeoff-review"}))
        (walk / "verdict.json").write_text(json.dumps({"verdict": "defects", "classes": closed}))
        (walk / "public/summary.json").write_text(json.dumps({"defects": closed, "file": "new-1.md"}))
        (walk / "public/new-1.md").write_text(
            "\n".join(["## new-1.md", *closed, "CHECK READS COMPLETE"]) + "\n"
        )
        (walk / "logs/run.txt").write_text("CHECK READS COMPLETE\n")
    (walks / "_src").mkdir()
    (walks / "_src/README.md").write_text("SERVING WORKTREE TEXT\n")
    (walks / ("a" * 40) / "notes.md").write_text(f"{ZEBRA.upper()}\n")
    kept = {value for value in sources.normalised(sources.walk_strings(walks)) if core.keeps(value)}
    assert kept == {core.normalise(ZEBRA)}
    corpus = core.Corpus("".join(f"{value}\n" for value in sorted(kept)).encode())
    for path in (walks / ("b" * 40)).rglob("*"):
        if path.is_file():
            assert all(corpus.count(line) == 0 for line in path.read_text().splitlines()), path.name


def test_the_pre_push_hook_refuses_a_tag(leak: Leak) -> None:
    repo, _ = temp_repo(leak.tmp / "work")
    git(repo, "tag", "-a", "v1", "-m", "a release")
    tag = git(repo, "rev-parse", "v1")
    env = leak.env()
    env.pop("PYTHONPATH", None)
    done = subprocess.run(
        [str(REPO / "scripts/git-hooks/pre-push"), "origin", "x"],
        cwd=repo,
        env=env,
        input=f"refs/tags/v1 {tag} refs/tags/v1 {'0' * 40}\n",
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode != 0
    assert "tags are not pushed" in done.stderr


def _notes_source(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> tuple[Path, dict[str, sources.Tally]]:
    """A main checkout under `tmp_path` whose notes folder the real sources read (no other source)."""
    monkeypatch.setenv("VEXTRUS_MAIN_CHECKOUT", str(tmp_path / "main"))
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_ALLOWLIST", str(tmp_path / "allow.txt"))
    monkeypatch.setenv("HOME", str(tmp_path / "user"))
    work = tmp_path / "main/.private/work"
    work.mkdir(parents=True)
    return work, {}


def _note(work: Path, path: str, text: str) -> None:
    (work / path).parent.mkdir(parents=True, exist_ok=True)
    (work / path).write_text(text)


def test_a_nested_git_checkout_with_the_repository_markers_keeps_its_untracked_notes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    work, counts = _notes_source(tmp_path, monkeypatch)
    for name in ("plain", "checkout"):
        _note(work, f"session-1/{name}/CLAUDE.md", "COPY OF THE RULES\n")
        _note(work, f"session-1/{name}/pyproject.toml", "")
        _note(work, f"session-1/{name}/out.md", f"{name.upper()} {ZEBRA.upper()}\n")
    git(work / "session-1/checkout", "init", "-q")
    git(work / "session-1/checkout", "add", "CLAUDE.md", "pyproject.toml")
    read = {value for _, value in sources.real_sources(counts)}
    # The plain copy is skipped whole; the checkout's tracked copy is skipped, its untracked note read.
    assert read == {f"CHECKOUT {ZEBRA.upper()}"}
    assert (counts["notes"].read, counts["notes"].skipped) == (1, 2)


def test_test_output_by_its_text_and_scratch_kinds_in_any_case_give_no_string(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    work, counts = _notes_source(tmp_path, monkeypatch)
    _note(work, "session-1/f2/node.md", f"{ZEBRA.upper()}\n# tests 3\n# pass 3\n")
    _note(work, "session-1/f2/slow.md", f"{ZEBRA.upper()}\n==== 2 failed, 1 passed in 12.5s ====\n")
    _note(work, "session-1/Review/r.md", f"{ZEBRA.upper()}\n")
    _note(work, "session-1/f2/redline-notes.md", f"{MARIGOLD.upper()}\n")
    _note(work, "session-1/f2/pass.md", f"{MARIGOLD.upper()}\n# pass the slab\n")
    read = [value for _, value in sources.real_sources(counts)]
    assert read == [MARIGOLD.upper()] * 2
    assert counts["notes"].skipped == 3
    assert sources.work_rule("session-9/anything") == "read"
    assert sources.work_rule("redesign") is None


def test_a_quiet_build_prints_no_count_line_and_kept_counts_follow_the_allowlist(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    work, _ = _notes_source(tmp_path, monkeypatch)
    _note(work, "factory/a.md", f"{ZEBRA.upper()}\n{ZEBRA.upper()}\n{MARIGOLD.upper()}\n")
    (work / "mystery").mkdir()
    assert cli.run(["build", "--quiet"]) == 0
    assert capsys.readouterr().out.splitlines()[:-1] == []
    (tmp_path / "allow.txt").write_text(core.digest(core.normalise(MARIGOLD)) + "\n")
    assert cli.run(["build"]) == 0
    out = capsys.readouterr().out.splitlines()
    assert out[:2] == [
        "source notes: 3 strings read, 1 kept, 0 files skipped",
        "leakscan: work folders without a rule: 1",
    ]
