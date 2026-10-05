"""Ticket f2, B2: what the scanner reads and what it prints (leakscan-cli.md 2, 3, 5; spec 5 item 2).

"The tool never prints the text it found. It prints a location and a count." One `HIT <where> <n>`
line per hit, then `leakscan: hits=<N> scanned=<M> corpus=<12 hex>`. Exit 0 clean, 1 hits, 2 cannot
scan, 64 usage. Every planted string is invented; today the package does not exist.
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

from . import _gh_stub
from ._leak import (
    COPPERFIELD,
    INDIGO,
    MARIGOLD,
    SAFFRON,
    ZEBRA,
    Leak,
    assert_no_text,
    commit,
    git,
    hits,
    normalise,
    sha256_text,
    summary,
    temp_repo,
)


@pytest.fixture
def leak(tmp_path: Path) -> Leak:
    built = Leak(tmp_path)
    built.build()
    return built


def _repo(leak: Leak) -> tuple[Path, str]:
    return temp_repo(leak.tmp / "work")


# ---------------------------------------------------------------- range


def test_a_range_reports_an_added_line_and_not_a_removed_or_context_line(leak: Leak) -> None:
    repo, _ = _repo(leak)
    base = commit(
        repo,
        {"ctx.txt": f"one\n{MARIGOLD}\nthree\n", "gone.txt": f"{COPPERFIELD}\nkeep\n"},
        "base: two files",
    )
    git(repo, "update-ref", "refs/remotes/origin/main", base)
    head = commit(
        repo,
        {
            "ctx.txt": f"one\n{MARIGOLD}\nthree\nfour clean\n",
            "gone.txt": "keep\n",
            "new.txt": f"alpha\nbeta\n{ZEBRA}\n",
        },
        "feat: a clean message",
    )
    done = leak.run("range", f"{base}..{head}", cwd=repo)
    assert done.returncode == 1
    assert hits(done) == [("new.txt:3", 1)]
    assert summary(done)[1] == "1"
    assert_no_text(done)


def test_a_range_reports_a_commit_message_line(leak: Leak) -> None:
    repo, base = _repo(leak)
    head = commit(repo, {"b.txt": "clean\n"}, f"feat: clean subject\n\n{ZEBRA}")
    done = leak.run("range", f"{base}..{head}", cwd=repo)
    assert done.returncode == 1
    assert hits(done) == [(f"commit:{head[:12]}:3", 1)]
    assert_no_text(done)


def test_a_range_reports_a_file_name_by_its_index_never_the_name(leak: Leak) -> None:
    repo, base = _repo(leak)
    head = commit(repo, {f"plans/{MARIGOLD}.txt": "clean\n"}, "feat: a clean message")
    done = leak.run("range", f"{base}..{head}", cwd=repo)
    assert done.returncode == 1
    assert hits(done) == [("name:0", 1)]
    assert_no_text(done)


def test_a_range_reports_the_pushed_ref_name(leak: Leak) -> None:
    repo, base = _repo(leak)
    head = commit(repo, {"b.txt": "clean\n"}, "feat: a clean message")
    done = leak.run("range", f"{base}..{head}", "--ref", "feature/quillmoor-estates-x", cwd=repo)
    assert done.returncode == 1
    assert hits(done) == [("ref", 1)]
    assert_no_text(done)


def test_two_strings_on_one_line_count_two(leak: Leak) -> None:
    repo, base = _repo(leak)
    head = commit(repo, {"new.txt": f"{ZEBRA} and {MARIGOLD}\n"}, "feat: a clean message")
    done = leak.run("range", f"{base}..{head}", cwd=repo)
    assert done.returncode == 1
    assert hits(done) == [("new.txt:1", 2)]
    assert summary(done)[1] == "2"


def test_a_clean_range_exits_0(leak: Leak) -> None:
    repo, base = _repo(leak)
    head = commit(repo, {"b.txt": "clean\n"}, "feat: a clean message")
    done = leak.run("range", f"{base}..{head}", cwd=repo)
    assert done.returncode == 0, done.stdout + done.stderr
    assert hits(done) == []
    assert summary(done)[1] == "0"
    assert summary(done)[3] == leak.corpus_hash[:12]


def test_a_bad_range_cannot_scan(leak: Leak) -> None:
    repo, _ = _repo(leak)
    done = leak.run("range", "nosuchref..HEAD", cwd=repo)
    assert done.returncode == 2
    assert "leakscan: cannot-scan bad-range" in done.stdout


# ---------------------------------------------------------------- file, text, dir


def test_a_body_file_reports_its_line(leak: Leak) -> None:
    body = leak.tmp / "body.md"
    body.write_text(f"a clean line\n{SAFFRON}\n")
    done = leak.run("file", str(body))
    assert done.returncode == 1
    assert hits(done) == [("file:2", 1)]
    assert_no_text(done)


def test_text_on_stdin_reports_its_line(leak: Leak) -> None:
    done = leak.run("text", "--stdin", stdin=f"build ticket x\nwith care\n{INDIGO}\n")
    assert done.returncode == 1
    assert hits(done) == [("stdin:3", 1)]
    assert_no_text(done)


def test_a_folder_of_walk_outputs_reports_path_and_line(leak: Leak) -> None:
    walk = leak.tmp / "walk"
    (walk / "out").mkdir(parents=True)
    (walk / "out/report.md").write_text(f"one\ntwo\nthree\n{ZEBRA}\n")
    (walk / "clean.md").write_text("nothing here\n")
    done = leak.run("dir", str(walk))
    assert done.returncode == 1
    assert hits(done) == [("dir:out/report.md:4", 1)]
    assert_no_text(done)


def test_a_binary_file_in_a_folder_is_scanned_as_bytes_without_printing_them(leak: Leak) -> None:
    walk = leak.tmp / "walk"
    walk.mkdir()
    (walk / "blob.bin").write_bytes(b"\x00\x01\xff\xfe" + ZEBRA.upper().encode() + b"\x00\x9c")
    done = leak.run("dir", str(walk))
    assert done.returncode == 1
    assert_no_text(done)


def test_an_unreadable_file_named_with_a_string_prints_neither_name_nor_text(leak: Leak) -> None:
    body = leak.tmp / f"{ZEBRA}.md"
    body.write_text(f"{MARIGOLD}\n")
    body.chmod(0o000)
    try:
        done = leak.run("file", str(body))
    finally:
        body.chmod(0o600)
    assert done.returncode != 0
    assert "Traceback" not in done.stderr
    # The command line names the file; the output must not echo it back.
    assert MARIGOLD.upper() not in (done.stdout + done.stderr).upper()
    assert "ZEBRA" not in (done.stdout + done.stderr).upper()


def test_a_binary_body_file_prints_no_text(leak: Leak) -> None:
    body = leak.tmp / "body.bin"
    body.write_bytes(b"\xff\xfe\x00" + MARIGOLD.encode() + b"\x00\x80\x81")
    done = leak.run("file", str(body))
    assert done.returncode in (1, 2)
    assert "Traceback" not in done.stderr
    assert_no_text(done)


def test_a_clean_file_exits_0(leak: Leak) -> None:
    body = leak.tmp / "body.md"
    body.write_text("## What is not verified\n\nNothing; an invented body.\n")
    done = leak.run("file", str(body))
    assert done.returncode == 0
    assert hits(done) == []


# ---------------------------------------------------------------- the allowlist


def test_an_allowlisted_hash_is_not_a_hit(leak: Leak) -> None:
    leak.allowlist.write_text(sha256_text(normalise(INDIGO)) + "\n")
    done = leak.run("text", "--stdin", stdin=f"{INDIGO}\n")
    assert done.returncode == 0, done.stdout


def test_allow_appends_only_hashes_and_the_rescan_is_clean(leak: Leak) -> None:
    body = leak.tmp / "generic.md"
    body.write_text(f"{ZEBRA}\n")
    done = leak.run("allow", f"{body}:1")
    assert done.returncode == 0, done.stdout + done.stderr
    assert_no_text(done)
    saved = leak.allowlist.read_text()
    entries = [line for line in saved.splitlines() if line.strip()]
    assert entries
    assert all(len(line) == 64 and set(line) <= set("0123456789abcdef") for line in entries)
    assert sha256_text(normalise(ZEBRA)) in entries
    assert "ZEBRA" not in saved.upper()
    assert leak.run("file", str(body)).returncode == 0


def test_allow_on_a_line_with_no_hit_is_refused(leak: Leak) -> None:
    body = leak.tmp / "clean.md"
    body.write_text("a clean line\n")
    assert leak.run("allow", f"{body}:1").returncode != 0
    assert leak.allowlist.read_text().strip() == ""


# ---------------------------------------------------------------- no corpus, usage, json


def test_a_missing_corpus_cannot_scan(tmp_path: Path) -> None:
    leak = Leak(tmp_path)
    done = leak.run("text", "--stdin", stdin="anything\n")
    assert done.returncode == 2
    assert done.stdout.strip().splitlines()[-1] == "leakscan: cannot-scan no-corpus"


def test_a_cloud_session_without_a_corpus_skips_and_writes_no_stamp(tmp_path: Path) -> None:
    leak = Leak(tmp_path)
    done = leak.run("text", "--stdin", stdin="anything\n", remote=True)
    assert done.returncode == 0
    assert done.stdout.strip().splitlines()[-1] == "leakscan: skipped no-corpus (cloud)"
    assert leak.stamps() == []


@pytest.mark.parametrize("args", [["no-such-command"], ["text"], ["range"], []])
def test_a_usage_error_exits_64(leak: Leak, args: list[str]) -> None:
    assert leak.run(*args, stdin="x\n").returncode == 64


def test_json_prints_one_object_with_the_hits_and_the_summary(leak: Leak) -> None:
    done = leak.run("text", "--stdin", "--json", stdin=f"clean\n{ZEBRA}\n")
    assert done.returncode == 1
    report = json.loads(done.stdout)
    assert report["hits"] == [{"where": "stdin:2", "n": 1}]
    assert report["summary"]["hits"] == 1
    assert report["summary"]["corpus"] == leak.corpus_hash[:12]
    assert report["summary"]["status"] == "hits"
    assert report["summary"]["reason"] is None
    assert isinstance(report["summary"]["scanned"], int)
    assert_no_text(done)


# ---------------------------------------------------------------- GitHub, through a stub gh


def _stub(leak: Leak) -> Path:
    folder = leak.tmp / "bin"
    _gh_stub.install(folder, sys.executable)
    return folder


def test_bodies_since_reports_an_issue_body_line_without_text(leak: Leak) -> None:
    done = leak.run("bodies", "--since", "2026-10-01", path_prefix=_stub(leak))
    assert done.returncode == 1, done.stdout + done.stderr
    assert ("issue:7:body:2", 1) in hits(done)
    assert_no_text(done)


def test_pr_reports_every_part_of_a_pr_without_text_and_writes_no_stamp(leak: Leak) -> None:
    done = leak.run("pr", "12", path_prefix=_stub(leak))
    assert done.returncode == 1, done.stdout + done.stderr
    wheres = [where for where, _ in hits(done)]
    assert "pr:12:title" in wheres
    assert "pr:12:body:2" in wheres
    assert any(where.startswith("pr:12:comment:") and where.endswith(":3") for where in wheres)
    assert "pr:12:branch" in wheres
    assert "src/plan.txt:2" in wheres
    assert any(where.startswith("commit:abcdef012345:") for where in wheres)
    assert "name:1" in wheres
    assert leak.stamps() == []
    assert_no_text(done)


def test_a_gh_failure_cannot_scan(leak: Leak) -> None:
    folder = _stub(leak)
    env_fail = {"GH_STUB_FAIL": "1"}
    done = _run_with(leak, ["pr", "12"], folder, env_fail)
    assert done.returncode == 2
    assert done.stdout.strip().splitlines()[-1] == "leakscan: cannot-scan gh-failed"


def _run_with(
    leak: Leak, args: list[str], folder: Path, extra: dict[str, str]
) -> subprocess.CompletedProcess[str]:
    env = leak.env(path_prefix=folder)
    env.update(extra)
    return subprocess.run(
        [sys.executable, "-m", "tools.leakscan", *args],
        cwd=leak.tmp,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
