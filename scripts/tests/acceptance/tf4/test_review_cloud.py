"""Ticket f4, tier 2: a cloud reviewer or refuter is launched on a fresh review branch with a nonce only
its prompt and its launch record hold (docs/specs/factory.md 2.2 "Launch, cloud review";
`contracts/review-verdict.schema.json`, `contracts/launch-cli.md` 2 `--review-file`).

Seam (fixed by the ticket): `scripts.factory.review_cloud.main(argv, *, push, launch, records_dir)`;
`push(argv) -> exit code`; `launch(argv, prompt) -> exit code`. Argv: `--pr 12 --head <40-hex> --agent
pr-reviewer|refuter [--claim-file f --claim-n n]`.
"""

import json
import re
import stat
from pathlib import Path
from typing import Any

import pytest

HEAD = "0123456789abcdef0123456789abcdef01234567"


class Recorder:
    def __init__(self, push_code: int = 0) -> None:
        self.pushes: list[list[str]] = []
        self.launches: list[tuple[list[str], str]] = []
        self.push_code = push_code

    def push(self, argv: list[str]) -> int:
        self.pushes.append(list(argv))
        return self.push_code

    def launch(self, argv: list[str], prompt: str) -> int:
        self.launches.append((list(argv), prompt))
        return 0


def review(argv: list[str], records: Path, recorder: Recorder) -> int:
    from scripts.factory.review_cloud import main

    return main(argv, push=recorder.push, launch=recorder.launch, records_dir=records)


def after(argv: list[str], flag: str) -> str:
    assert flag in argv, flag
    return argv[argv.index(flag) + 1]


def nonce8_of(push: list[str]) -> str:
    found = re.fullmatch(rf"{HEAD}:refs/heads/review/12-([0-9a-f]{{8}})", push[-1])
    assert found, push
    return found[1]


def test_the_head_is_pushed_once_to_a_fresh_review_branch(tmp_path: Path) -> None:
    recorder = Recorder()
    argv = ["--pr", "12", "--head", HEAD, "--agent", "pr-reviewer"]
    assert review(argv, tmp_path, recorder) == 0
    assert review(argv, tmp_path, recorder) == 0
    first, second = recorder.pushes
    assert first[:3] == ["git", "push", "origin"]
    assert len(first) == 4
    assert nonce8_of(first) != nonce8_of(second)


def test_the_review_file_holds_exactly_pr_head_and_nonce_private_to_the_owner(tmp_path: Path) -> None:
    recorder = Recorder()
    assert review(["--pr", "12", "--head", HEAD, "--agent", "pr-reviewer"], tmp_path, recorder) == 0
    nonce8 = nonce8_of(recorder.pushes[0])
    path = tmp_path / f"review-12-{nonce8}.json"
    record: dict[str, Any] = json.loads(path.read_text())
    assert set(record) == {"pr", "head_sha", "nonce"}
    assert (record["pr"], record["head_sha"]) == (12, HEAD)
    assert re.fullmatch(r"[0-9a-f]{32}", record["nonce"])
    assert record["nonce"][:8] == nonce8
    assert stat.S_IMODE(path.stat().st_mode) == 0o600


@pytest.mark.parametrize(("agent", "role"), [("pr-reviewer", "reviewer"), ("refuter", "refuter")])
def test_the_launch_names_the_branch_role_and_review_file_but_never_the_nonce(
    tmp_path: Path, agent: str, role: str
) -> None:
    recorder = Recorder()
    argv = ["--pr", "12", "--head", HEAD, "--agent", agent]
    if agent == "refuter":
        claim = tmp_path / "claim.txt"
        claim.write_text("The ledger accepts a PASS marker posted by anyone.\n")
        argv += ["--claim-file", str(claim), "--claim-n", "1"]
    assert review(argv, tmp_path, recorder) == 0
    nonce8 = nonce8_of(recorder.pushes[0])
    [(launched, prompt)] = recorder.launches
    nonce = json.loads((tmp_path / f"review-12-{nonce8}.json").read_text())["nonce"]
    assert "scripts.factory.launch" in launched
    assert "cloud" in launched
    assert after(launched, "--branch") == f"review/12-{nonce8}"
    assert after(launched, "--role") == role
    assert after(launched, "--effort") == "high"
    assert after(launched, "--ticket")
    assert after(launched, "--prompt-file")
    review_file = json.loads(Path(after(launched, "--review-file")).read_text())
    assert review_file == {"pr": 12, "head_sha": HEAD, "nonce": nonce}
    assert nonce not in " ".join(launched)
    opening = "\n".join(prompt.splitlines()[:2])
    assert "git remote get-url origin" in opening
    assert "git rev-parse HEAD" in opening
    assert HEAD in prompt
    assert nonce in prompt
    if agent == "refuter":
        assert "The ledger accepts a PASS marker posted by anyone." in prompt
        assert f".review/refute-12-{nonce8}-1.json" in prompt
    else:
        assert f".review/12-{nonce8}.json" in prompt


def test_a_failed_push_launches_nothing(tmp_path: Path) -> None:
    recorder = Recorder(push_code=1)
    assert review(["--pr", "12", "--head", HEAD, "--agent", "pr-reviewer"], tmp_path, recorder) == 3
    assert recorder.launches == []


@pytest.mark.parametrize("head", ["abc123", HEAD.upper(), HEAD + "0", "main"])
def test_a_head_that_is_not_a_full_sha_is_bad_input(tmp_path: Path, head: str) -> None:
    recorder = Recorder()
    assert review(["--pr", "12", "--head", head, "--agent", "pr-reviewer"], tmp_path, recorder) == 2
    assert recorder.pushes == []
    assert recorder.launches == []
