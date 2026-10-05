"""Ticket f2, B3: the stamp, and the guard reading it (leakscan-cli.md 4; spec 5 item 3).

"A clean scan writes `.private/work/leakscan/ok/<sha or sha256>`, whose content is the corpus hash
and the scanned range; the guard re-checks both." The stamp is `{"corpus": <sha256 of the corpus
file>, "range": "<base40>..<head40>"}` (or `"sha256:<64 hex>"` for `file` and `text`), exactly two
fields. End to end, the scanner's own stamp lets `guard.mjs` allow a push from the main checkout and
a `gh --body-file` write. Today neither the scanner nor the guard's check exists.
"""

import hashlib
import json
import os
import subprocess
from pathlib import Path

import pytest

from ._leak import GUARD, ZEBRA, Leak, commit, git, git_env, temp_repo


@pytest.fixture
def leak(tmp_path: Path) -> Leak:
    built = Leak(tmp_path)
    built.build()
    return built


def _stamp(leak: Leak, name: str) -> dict[str, object]:
    stamp: dict[str, object] = json.loads((leak.home / "ok" / name).read_text())
    return stamp


def test_a_clean_range_writes_a_stamp_named_for_its_head(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    assert leak.run("range", f"{base}..{head}", cwd=repo).returncode == 0
    assert _stamp(leak, head) == {"corpus": leak.corpus_hash, "range": f"{base}..{head}"}


def test_a_range_stamp_pins_full_shas_when_given_revisions(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    assert leak.run("range", "origin/main..HEAD", cwd=repo).returncode == 0
    assert _stamp(leak, head) == {"corpus": leak.corpus_hash, "range": f"{base}..{head}"}


def test_a_dirty_range_writes_no_stamp(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": f"{ZEBRA}\n"}, "feat: dirty")
    assert leak.run("range", f"{base}..{head}", cwd=repo).returncode == 1
    assert leak.stamps() == []


def test_no_stamp_scans_without_writing_one(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    assert leak.run("range", f"{base}..{head}", "--no-stamp", cwd=repo).returncode == 0
    assert leak.stamps() == []


def test_a_clean_file_writes_a_stamp_named_for_its_bytes(leak: Leak) -> None:
    body = leak.tmp / "body.md"
    body.write_text("an invented, clean body\n")
    digest = hashlib.sha256(body.read_bytes()).hexdigest()
    assert leak.run("file", str(body)).returncode == 0
    assert _stamp(leak, digest) == {"corpus": leak.corpus_hash, "range": f"sha256:{digest}"}


def test_clean_text_writes_a_stamp_named_for_its_bytes(leak: Leak) -> None:
    text = "an invented, clean launch prompt\n"
    digest = hashlib.sha256(text.encode()).hexdigest()
    assert leak.run("text", "--stdin", stdin=text).returncode == 0
    assert _stamp(leak, digest) == {"corpus": leak.corpus_hash, "range": f"sha256:{digest}"}


def test_verify_stamp_accepts_a_valid_stamp_and_refuses_it_once_the_corpus_is_rebuilt(
    leak: Leak,
) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    assert leak.run("range", f"{base}..{head}", cwd=repo).returncode == 0
    assert leak.run("verify-stamp", head, cwd=repo).returncode == 0
    (leak.sources / "more.txt").write_text("Bramblewick Foundry Annex\n")
    leak.build()
    assert leak.run("verify-stamp", head, cwd=repo).returncode == 1


def test_verify_stamp_refuses_a_hand_written_stamp(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    (leak.home / "ok").mkdir(parents=True, exist_ok=True)
    (leak.home / "ok" / head).write_text(json.dumps({"corpus": "0" * 64, "range": f"{base}..{head}"}))
    assert leak.run("verify-stamp", head, cwd=repo).returncode == 1
    assert leak.run("verify-stamp", "f" * 40, cwd=repo).returncode == 1


def test_a_narrow_range_writes_no_stamp_that_would_vouch_for_unscanned_commits(leak: Leak) -> None:
    repo, _ = temp_repo(leak.tmp / "work")
    middle = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    head = commit(repo, {"c.txt": "clean\n"}, "feat: clean too")
    # middle is not on origin/main: a stamp from it fails the contract's rule 3.
    assert leak.run("range", f"{middle}..{head}", cwd=repo).returncode == 0
    assert not (leak.home / "ok" / head).exists()


# ---------------------------------------------------------------- end to end with the guard


def _guard(leak: Leak, repo: Path, command: str) -> str | None:
    env = git_env(
        CLAUDE_PROJECT_DIR=str(repo),
        VEXTRUS_MAIN_CHECKOUT=str(repo),
        VEXTRUS_LEAKSCAN_HOME=str(leak.home),
    )
    env.pop("VEXTRUS_LEAKSCAN_ALLOWLIST", None)
    event = {"tool_name": "Bash", "tool_input": {"command": command}, "cwd": str(repo)}
    done = subprocess.run(
        ["node", str(GUARD)],
        input=json.dumps(event),
        cwd=repo,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 0, done.stderr
    if not done.stdout.strip():
        return None
    reason: str = json.loads(done.stdout)["hookSpecificOutput"]["permissionDecisionReason"]
    return reason.split(":")[0]


def test_the_scanners_stamp_lets_the_guard_allow_the_push_and_a_new_leak_is_refused(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    git(repo, "checkout", "-q", "-b", "x")
    head = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    push = "git push origin HEAD:refs/heads/x"
    assert _guard(leak, repo, push) == "LEAK_STAMP"
    assert leak.run("range", f"{base}..{head}", "--ref", "x", cwd=repo).returncode == 0
    assert _guard(leak, repo, push) is None
    dirty = commit(repo, {"c.txt": f"{ZEBRA}\n"}, "feat: then a leak")
    assert leak.run("range", f"{base}..{dirty}", "--ref", "x", cwd=repo).returncode == 1
    assert _guard(leak, repo, push) == "LEAK_STAMP"


def test_a_hand_written_stamp_with_the_wrong_hash_is_refused_by_the_guard(leak: Leak) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    (leak.home / "ok").mkdir(parents=True, exist_ok=True)
    (leak.home / "ok" / head).write_text(json.dumps({"corpus": "0" * 64, "range": f"{base}..{head}"}))
    assert _guard(leak, repo, "git push origin HEAD:refs/heads/x") == "LEAK_STAMP"


def test_the_scanners_file_stamp_lets_the_guard_allow_a_body_file(leak: Leak) -> None:
    repo, _ = temp_repo(leak.tmp / "work")
    body = leak.tmp / "pr-body.md"
    body.write_text("## What is not verified\n\nAn invented body.\n")
    command = f'gh pr create --title "factory: a title" --body-file {body}'
    assert _guard(leak, repo, command) is not None
    assert leak.run("file", str(body)).returncode == 0
    assert _guard(leak, repo, command) is None
    with body.open("a") as handle:
        handle.write(f"{ZEBRA}\n")
    assert leak.run("file", str(body)).returncode == 1
    assert _guard(leak, repo, command) is not None


def test_the_guard_ignores_stamps_outside_its_leakscan_home(leak: Leak, tmp_path: Path) -> None:
    repo, base = temp_repo(leak.tmp / "work")
    head = commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    assert leak.run("range", f"{base}..{head}", cwd=repo).returncode == 0
    (tmp_path / "other").mkdir()
    other = Leak(tmp_path / "other")
    other.home.mkdir(parents=True)
    os.link(leak.home / "corpus", other.home / "corpus")
    assert _guard(other, repo, "git push origin HEAD:refs/heads/x") == "LEAK_STAMP"
