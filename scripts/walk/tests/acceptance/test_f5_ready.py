"""f5 acceptance: `scripts/walk/ready.py`, "is main walk-ready" (docs/specs/factory.md 5 "G1").

"`scripts/walk/ready.py <ref>` passes only when the two most recent G1 verdicts on main are both
PASS with no FAIL between them, and the newer one is on `<ref>`'s current head or on an earlier head
whose diff to it touches no product path (`vextrus/`, `engine/`, `web/src/`, `pyproject.toml`,
`uv.lock`). A second walk on the same product code counts (a repeat). Each case has a test."

Exit codes (the ticket): 0 ready, 1 not ready, 2 unreadable or malformed input (fail closed). Every
genuine verdict written here is a valid walk-verdict.schema.json object made by one helper.
"""

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest
from _f5_contract import (  # type: ignore[import-not-found, unused-ignore]
    ROOT,
    WALKED_ITEMS,
    assert_valid_verdict,
)

T1, T2, T3 = "2026-10-05T01:00:00Z", "2026-10-05T03:00:00Z", "2026-10-05T05:00:00Z"


def _git(repo: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True)
    return done.stdout.strip()


def _repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.email", "walk-test@example.invalid")
    _git(repo, "config", "user.name", "walk test")
    _git(repo, "config", "commit.gpgsign", "false")
    return repo


def _commit(repo: Path, path: str, text: str = "x") -> str:
    file = repo / path
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(f"{text}\n{path}\n")
    _git(repo, "add", "--", path)
    _git(repo, "commit", "-q", "--no-verify", "-m", f"change {path}")
    return _git(repo, "rev-parse", "HEAD")


def verdict(sha: str, result: str, finished_at: str, **change: Any) -> dict[str, Any]:
    """A genuine contract verdict for `sha` (PASS: every check and item PASS, no finding)."""
    status = "PASS" if result == "PASS" else "FAIL"
    body: dict[str, Any] = {
        "schema_version": 1,
        "sha": sha,
        "ref": "main",
        "started_at": "2026-10-05T00:00:00Z",
        "finished_at": finished_at,
        "result": result,
        "checks": [
            {
                "check": "reads_complete",
                "set": "set-a",
                "status": "PASS",
                "measured": {"files": 2, "completed": 2},
                "expected": {"files": 2},
            },
            {
                "check": "act_p95_during_read",
                "set": "set-a",
                "status": status,
                "measured": {"p95_ms": 200 if status == "PASS" else 2400, "samples": 20},
                "expected": {"p95_ms_max": 1000},
            },
            {
                "check": "questions_per_discipline",
                "set": "set-a",
                "status": "PASS",
                "measured": {"questions_max_per_discipline": 2, "disciplines": 2},
                "expected": {"questions_max_per_discipline": 3},
            },
        ],
        "burden": [],
        "agent_layer": {
            "items": [{"item": item, "status": "PASS"} for item in WALKED_ITEMS],
            "findings": [],
            "blocks": 0,
            "misleading": 0,
            "issues_drafted": 0,
            "dedup_comments": 0,
        },
        "leak_scan": {"hits": 0},
    }
    body.update(change)
    return body


def _write(
    walks: Path, folder: str, body: Any, name: str = "verdict.json", *, valid: bool = True
) -> None:
    if valid:
        assert_valid_verdict(body)
    (walks / folder).mkdir(parents=True, exist_ok=True)
    text = body if isinstance(body, str) else json.dumps(body)
    (walks / folder / name).write_text(text)


def _ready(repo: Path, walks: Path, ref: str = "main") -> subprocess.CompletedProcess[str]:
    # The module under test exists first, so a missing module never passes as "not ready" (exit 1).
    import scripts.walk.ready  # noqa: F401

    return subprocess.run(
        [
            sys.executable,
            "-m",
            "scripts.walk.ready",
            ref,
            "--walks-dir",
            str(walks),
            "--repo",
            str(repo),
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


def _assert_not_ready(done: subprocess.CompletedProcess[str]) -> None:
    """Exit 1 with one reason line (the ticket: "1 not ready (one reason line, no drawing text)")."""
    assert done.returncode == 1, done.stdout + done.stderr
    lines = [line for line in (done.stdout + done.stderr).splitlines() if line.strip()]
    assert len(lines) == 1, lines


def test_two_pass_verdicts_the_newer_on_head_are_ready(tmp_path: Path) -> None:
    repo, walks = _repo(tmp_path), tmp_path / "walks"
    c1 = _commit(repo, "vextrus/a.py")
    c2 = _commit(repo, "docs/a.md")
    _write(walks, c1, verdict(c1, "PASS", T1))
    _write(walks, c2, verdict(c2, "PASS", T2))

    done = _ready(repo, walks)

    assert done.returncode == 0, done.stdout + done.stderr


def test_the_function_says_ready_with_a_reason(tmp_path: Path) -> None:
    from scripts.walk.ready import ready

    repo, walks = _repo(tmp_path), tmp_path / "walks"
    c1 = _commit(repo, "vextrus/a.py")
    c2 = _commit(repo, "docs/a.md")
    _write(walks, c1, verdict(c1, "PASS", T1))
    _write(walks, c2, verdict(c2, "PASS", T2))
    yes = ready("main", walks_dir=walks, repo=repo)
    _write(walks, c2, verdict(c2, "FAIL", T3), "verdict.20261005T050000Z.json")
    no = ready("main", walks_dir=walks, repo=repo)

    assert yes.ok is True
    assert no.ok is False
    assert isinstance(no.reason, str)
    assert no.reason


def test_a_fail_between_two_passes_is_not_ready(tmp_path: Path) -> None:
    repo, walks = _repo(tmp_path), tmp_path / "walks"
    c1 = _commit(repo, "vextrus/a.py")
    c2 = _commit(repo, "vextrus/b.py")
    c3 = _commit(repo, "docs/a.md")
    _write(walks, c1, verdict(c1, "PASS", T1))
    _write(walks, c2, verdict(c2, "FAIL", T2))
    _write(walks, c3, verdict(c3, "PASS", T3))

    _assert_not_ready(_ready(repo, walks))


def test_one_pass_alone_is_not_ready(tmp_path: Path) -> None:
    repo, walks = _repo(tmp_path), tmp_path / "walks"
    c1 = _commit(repo, "vextrus/a.py")
    _write(walks, c1, verdict(c1, "PASS", T1))

    _assert_not_ready(_ready(repo, walks))


@pytest.mark.parametrize("walks_exist", [True, False], ids=["empty-walks-dir", "no-walks-dir"])
def test_no_verdict_is_not_ready(tmp_path: Path, walks_exist: bool) -> None:
    repo, walks = _repo(tmp_path), tmp_path / "walks"
    _commit(repo, "vextrus/a.py")
    if walks_exist:
        walks.mkdir()

    _assert_not_ready(_ready(repo, walks))


def _passes_then_head(tmp_path: Path, head_change: str) -> tuple[Path, Path]:
    repo, walks = _repo(tmp_path), tmp_path / "walks"
    c1 = _commit(repo, "vextrus/a.py")
    c2 = _commit(repo, "docs/b.md")
    _write(walks, c1, verdict(c1, "PASS", T1))
    _write(walks, c2, verdict(c2, "PASS", T2))
    _commit(repo, head_change)
    return repo, walks


def test_a_newer_pass_on_stale_product_code_is_not_ready(tmp_path: Path) -> None:
    repo, walks = _passes_then_head(tmp_path, "web/src/x.tsx")

    _assert_not_ready(_ready(repo, walks))


def test_a_newer_pass_on_an_earlier_head_with_only_docs_since_is_ready(tmp_path: Path) -> None:
    repo, walks = _passes_then_head(tmp_path, "docs/x.md")

    done = _ready(repo, walks)

    assert done.returncode == 0, done.stdout + done.stderr


@pytest.mark.parametrize(
    "product_path", ["vextrus/x.py", "engine/x.py", "web/src/x.tsx", "pyproject.toml", "uv.lock"]
)
def test_each_product_path_since_the_newer_pass_is_not_ready(tmp_path: Path, product_path: str) -> None:
    repo, walks = _passes_then_head(tmp_path, product_path)

    _assert_not_ready(_ready(repo, walks))


def test_two_passes_on_the_same_sha_are_a_repeat_and_ready(tmp_path: Path) -> None:
    repo, walks = _repo(tmp_path), tmp_path / "walks"
    _commit(repo, "vextrus/a.py")
    head = _commit(repo, "vextrus/b.py")
    _write(walks, head, verdict(head, "PASS", T1), "verdict.20261005T010000Z.json")
    _write(walks, head, verdict(head, "PASS", T2))

    done = _ready(repo, walks)

    assert done.returncode == 0, done.stdout + done.stderr


def _forge_unset(body: dict[str, Any]) -> None:
    body["checks"][1]["status"] = "UNSET"
    body["checks"][1]["expected"] = None


def _forge_fail(body: dict[str, Any]) -> None:
    body["checks"][2]["status"] = "FAIL"


def _forge_blocks(body: dict[str, Any]) -> None:
    body["agent_layer"]["blocks"] = 1


def _forge_misleading(body: dict[str, Any]) -> None:
    body["agent_layer"]["misleading"] = 1


@pytest.mark.parametrize(
    "forge",
    [_forge_unset, _forge_fail, _forge_blocks, _forge_misleading],
    ids=["pass-with-unset-check", "pass-with-failed-check", "pass-with-blocks", "pass-with-misleading"],
)
def test_a_contradictory_pass_is_never_counted(tmp_path: Path, forge: Any) -> None:
    repo, walks = _repo(tmp_path), tmp_path / "walks"
    c1 = _commit(repo, "vextrus/a.py")
    c2 = _commit(repo, "docs/a.md")
    _write(walks, c1, verdict(c1, "PASS", T1))
    forged = verdict(c2, "PASS", T2)
    forge(forged)
    _write(walks, c2, forged, valid=False)

    _assert_not_ready(_ready(repo, walks))


@pytest.mark.parametrize("case", ["smoke-marker", "ref-not-main", "sha-not-its-folder"])
def test_a_smoke_foreign_or_misfiled_verdict_is_not_counted(tmp_path: Path, case: str) -> None:
    repo, walks = _repo(tmp_path), tmp_path / "walks"
    c1 = _commit(repo, "vextrus/a.py")
    c2 = _commit(repo, "docs/a.md")
    _write(walks, c1, verdict(c1, "PASS", T1))
    if case == "smoke-marker":
        _write(walks, c2, {**verdict(c2, "PASS", T2), "smoke": True}, valid=False)
    elif case == "ref-not-main":
        _write(walks, c2, verdict(c2, "PASS", T2, ref="s12-some-branch"))
    else:
        _write(walks, c2, verdict(c1, "PASS", T2))

    _assert_not_ready(_ready(repo, walks))


def test_a_verdict_off_the_first_parent_history_is_ignored(tmp_path: Path) -> None:
    repo, walks = _repo(tmp_path), tmp_path / "walks"
    c1 = _commit(repo, "vextrus/a.py")
    _git(repo, "checkout", "-q", "-b", "side")
    side = _commit(repo, "docs/side.md")
    _git(repo, "checkout", "-q", "main")
    _git(repo, "merge", "-q", "--no-ff", "--no-edit", "side")
    _write(walks, c1, verdict(c1, "PASS", T1))
    _write(walks, side, verdict(side, "PASS", T2))

    _assert_not_ready(_ready(repo, walks))


@pytest.mark.parametrize("text", ["{not json", "[]", "null"], ids=["not-json", "a-list", "null"])
def test_a_malformed_verdict_fails_closed(tmp_path: Path, text: str) -> None:
    repo, walks = _repo(tmp_path), tmp_path / "walks"
    c1 = _commit(repo, "vextrus/a.py")
    c2 = _commit(repo, "docs/a.md")
    _write(walks, c1, verdict(c1, "PASS", T1))
    _write(walks, c2, verdict(c2, "PASS", T2))
    _write(walks, c2, text, "verdict.20261005T050000Z.json", valid=False)

    assert _ready(repo, walks).returncode == 2


def test_an_unreadable_repository_fails_closed(tmp_path: Path) -> None:
    repo, walks = _repo(tmp_path), tmp_path / "walks"
    c1 = _commit(repo, "vextrus/a.py")
    c2 = _commit(repo, "docs/a.md")
    _write(walks, c1, verdict(c1, "PASS", T1))
    _write(walks, c2, verdict(c2, "PASS", T2))
    not_a_repo = tmp_path / "not-a-repo"
    not_a_repo.mkdir()

    assert _ready(not_a_repo, walks).returncode == 2
