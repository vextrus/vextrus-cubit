"""Unit tests of `scripts.factory.review` at its seams: the tier, the red-CI rule, the PR argument, the
replay path, the lens's answer, the slot lock and the words a lens is given."""

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import review

H = "a" * 40
HASH = "3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7"


# ---------------------------------------------------------------- tier


def test_only_hash_lines_added_to_the_allowlist_is_allowlist_only() -> None:
    assert review.tier([(review.ALLOWLIST, 2, 0)], [HASH, HASH.replace("3", "4")]) == "allowlist-only"


@pytest.mark.parametrize(
    ("rows", "added"),
    [
        ([(review.ALLOWLIST, 2, 0)], [HASH, "not a hash"]),
        ([(review.ALLOWLIST, 1, 0)], [HASH.upper()]),
        ([(review.ALLOWLIST, 1, 0)], [HASH + " "]),
        ([(review.ALLOWLIST, 1, 1)], [HASH]),  # a removed line is not "only added"
        ([(review.ALLOWLIST, 1, 0), ("README.md", 1, 0)], [HASH]),
        ([(review.ALLOWLIST, 0, 1)], []),
    ],
    ids=["sentence", "upper-hex", "trailing-space", "a-removal", "another-file", "removal-only"],
)
def test_anything_more_than_hash_lines_is_not_allowlist_only(
    rows: list[tuple[str, int | None, int | None]], added: list[str]
) -> None:
    assert review.tier(rows, added) != "allowlist-only"


def test_docs_only_is_markdown_under_docs() -> None:
    assert review.tier([("docs/adr/0050-x.md", 40, 2), ("docs/notes/a.md", 1, 0)], []) == "docs-only"
    assert review.tier([("docs/specs/factory/contracts/x.schema.json", 1, 0)], []) != "docs-only"
    assert review.tier([("CLAUDE.md", 1, 0)], []) != "docs-only"


@pytest.mark.parametrize(
    "path",
    [
        ".claude/hooks/guard.mjs",
        ".claude/settings.json",
        ".github/workflows/ci.yml",
        "scripts/ledger.py",
        "tools/leakscan/core.py",
        "vextrus/accounts/auth.py",
        "vextrus/tenancy/tenant_wall.py",
        "engine/readers/dxf.py",
        "vextrus/rates/migrations/0002_x.py",
    ],
)
def test_a_small_change_on_a_trust_boundary_is_normal(path: str) -> None:
    assert review.tier([(path, 3, 0)], []) == "normal"


def test_a_small_change_is_small_and_a_large_or_binary_one_normal() -> None:
    assert review.tier([("web/src/components/badge.tsx", 3, 1)], []) == "small"
    assert review.tier([("vextrus/rates/table.py", 149, 0)], []) == "small"
    assert review.tier([("vextrus/rates/table.py", 100, 50)], []) == "normal"
    assert review.tier([("web/public/logo.png", None, None)], []) == "normal"


def test_an_empty_change_is_refused() -> None:
    with pytest.raises(review.Refused):
        review.tier([], [])


# ---------------------------------------------------------------- red CI


def check(name: str, conclusion: str, workflow: str = "ci") -> dict[str, Any]:
    return {"__typename": "CheckRun", "name": name, "conclusion": conclusion, "workflowName": workflow}


@pytest.mark.parametrize("word", ["FAILURE", "CANCELLED", "TIMED_OUT", "STARTUP_FAILURE"])
def test_a_failed_ci_check_or_ci_workflow_job_is_red(word: str) -> None:
    assert review.red_ci([check("ci", word)]) == ["ci"]
    assert review.red_ci([check("python (rest)", word)]) == ["python (rest)"]
    assert review.red_ci([{"__typename": "StatusContext", "context": "ci", "state": word}]) == ["ci"]


def test_green_pending_and_other_workflows_are_not_red() -> None:
    assert (
        review.red_ci([check("ci", "SUCCESS"), check("ci", ""), check("leaks", "FAILURE", "other")])
        == []
    )


def test_unreadable_checks_are_refused() -> None:
    with pytest.raises(review.Refused):
        review.red_ci(None)
    with pytest.raises(review.Refused):
        review.red_ci(["ci"])


# ---------------------------------------------------------------- the PR argument


@pytest.mark.parametrize(
    "argv",
    [
        ["run", "12", "--round", "1", "--head", H],
        ["run", "abc1234", "--round", "1"],
        ["run", H, "--round", "1"],
        ["run", "0", "--round", "1"],
        ["run", "-1", "--round", "1"],
        ["run", "12"],
    ],
    ids=["typed-head", "short-sha", "full-sha", "zero", "negative", "no-round"],
)
def test_the_pr_is_a_number_and_no_head_is_typed(argv: list[str]) -> None:
    with pytest.raises(review.BadInput):
        review.parse(argv)


def test_a_pr_number_parses() -> None:
    args = review.parse(["run", "452", "--round", "2"])
    assert (args.pr, args.round, args.exception) == (452, 2, None)


# ---------------------------------------------------------------- replay


@pytest.mark.parametrize(
    "name",
    [
        "/etc/passwd.py",
        "../outside.py",
        "tests/../../outside.py",
        "-k.py",
        "tests/missing.py",
        "tests/attack.txt",
        "tests/a.py::test_x",
        "",
    ],
)
def test_a_repro_outside_the_worktree_or_missing_is_never_replayed(tmp_path: Path, name: str) -> None:
    rv = tmp_path / "rv1"
    (rv / "tests").mkdir(parents=True)
    (rv / "tests" / "attack.txt").write_text("x")
    (rv / "tests" / "a.py").write_text("x")
    (tmp_path / "outside.py").write_text("x")
    assert review.replay_target(rv, name) is None


def test_a_link_out_of_the_worktree_is_never_replayed(tmp_path: Path) -> None:
    rv = tmp_path / "rv1"
    rv.mkdir()
    (tmp_path / "outside.py").write_text("x")
    (rv / "link.py").symlink_to(tmp_path / "outside.py")
    assert review.replay_target(rv, "link.py") is None


def test_a_repro_inside_the_worktree_is_replayed(tmp_path: Path) -> None:
    rv = tmp_path / "rv1"
    (rv / "tests").mkdir(parents=True)
    (rv / "tests" / "test_attack.py").write_text("x")
    assert review.replay_target(rv, "tests/test_attack.py") == "tests/test_attack.py"


def fake_uv(bin_dir: Path, output: str, code: int) -> None:
    bin_dir.mkdir()
    script = bin_dir / "uv"
    script.write_text(f"#!/bin/sh\nprintf '%s\\n' {json.dumps(output)}\nexit {code}\n")
    script.chmod(0o755)


@pytest.mark.parametrize(
    ("output", "code", "confirmed"),
    [
        ("FAILED tests/test_a.py::test_attack - AssertionError", 1, True),
        ("FAILED tests/test_a.py::test_attack - AssertionError", 0, False),
        ("FAILED tests/test_other.py::test_attack - AssertionError", 1, False),
        ("ERROR tests/test_a.py - ImportError", 2, False),
        ("1 passed", 0, False),
    ],
    ids=["fails-by-name", "exit-0", "another-file", "collection-error", "passes"],
)
def test_only_a_failure_naming_the_test_file_confirms(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, output: str, code: int, confirmed: bool
) -> None:
    fake_uv(tmp_path / "bin", output, code)
    monkeypatch.setenv("PATH", f"{tmp_path / 'bin'}:/usr/bin:/bin")
    assert review.replay(tmp_path, 1, "tests/test_a.py") is confirmed


# ---------------------------------------------------------------- the lens's answer


def answer(**changes: Any) -> dict[str, Any]:
    item = {"score": 60, "file": "a.py", "line": 1, "summary": "s", "repro": None}
    out = {"verdict": "PASS", "head": H, "findings": [item], "report": "r"}
    out.update(changes)
    return {"structured_output": out}


def test_a_well_formed_answer_for_the_head_is_read() -> None:
    assert review.read_review(review.LENS_B, answer(), H)["verdict"] == "PASS"


@pytest.mark.parametrize(
    "result",
    [
        {},
        {"structured_output": None},
        answer(verdict="LGTM"),
        answer(head="b" * 40),
        answer(head=H[:12]),
        answer(findings="none"),
        answer(findings=[{"score": "60", "file": "a.py", "line": 1, "summary": "s", "repro": None}]),
        answer(findings=[{"score": 101, "file": "a.py", "line": 1, "summary": "s", "repro": None}]),
        answer(findings=[{"score": True, "file": "a.py", "line": 1, "summary": "s", "repro": None}]),
        answer(findings=[{"score": 60, "file": "a.py", "line": 1, "summary": "s", "repro": "t.py"}]),
    ],
    ids=[
        "no-output",
        "null",
        "bad-verdict",
        "other-head",
        "short-head",
        "findings-not-list",
        "score-text",
        "score-101",
        "score-bool",
        "repro-text",
    ],
)
def test_an_answer_outside_the_schema_or_for_another_head_is_refused(result: dict[str, Any]) -> None:
    with pytest.raises(review.Refused):
        review.read_review(review.LENS_B, result, H)


# ---------------------------------------------------------------- the slot lock


def test_a_claimed_slot_is_not_claimed_again_until_released(tmp_path: Path) -> None:
    first, held = review.claim_slot(tmp_path)
    second, other = review.claim_slot(tmp_path)
    assert first != second
    held.close()
    third, again = review.claim_slot(tmp_path)
    assert third == first
    other.close()
    again.close()


def test_a_slot_held_by_another_process_is_skipped(tmp_path: Path) -> None:
    holder = subprocess.Popen(
        [
            sys.executable,
            "-c",
            (
                "import fcntl, sys; h = open(sys.argv[1], 'a'); fcntl.flock(h, fcntl.LOCK_EX); "
                "print('held', flush=True); sys.stdin.read()"
            ),
            str(tmp_path / ".slot1.lock"),
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
    )
    try:
        assert holder.stdout is not None
        assert holder.stdout.readline().strip() == "held"
        n, handle = review.claim_slot(tmp_path)
        handle.close()
        assert n == 2
    finally:
        holder.communicate("")


def test_every_slot_busy_is_refused(tmp_path: Path) -> None:
    held = [review.claim_slot(tmp_path)[1] for _ in range(review.MAX_SLOTS)]
    try:
        with pytest.raises(review.Refused):
            review.claim_slot(tmp_path)
    finally:
        for handle in held:
            handle.close()


# ---------------------------------------------------------------- what a lens is given


@pytest.mark.parametrize("lens", [review.LENS_A, review.LENS_B, review.WORDS])
def test_no_lens_command_or_prompt_names_the_record(lens: review.Lens, tmp_path: Path) -> None:
    run = review.Run(pr=12, round_=1, head=H, merged="b" * 40, slot=1)
    command = review.lens_command(lens, tmp_path / "main")
    text = " ".join([*command, review.brief(run, lens, tmp_path / "rv1", tmp_path)])
    assert "ledger" not in text.lower()
    assert "Bash" not in review.ALLOWED_TOOLS
    assert any("pytest" in entry for entry in review.ALLOWED_TOOLS)


def option(command: list[str], name: str) -> str:
    return command[command.index(name) + 1]


def test_a_lens_loads_no_user_project_or_local_settings(tmp_path: Path) -> None:
    """The user's settings allow bare Edit and Write and `gh api`; the project copy in rv<N> is the
    PR's own (live probe, S14-R1): a lens loads neither."""
    command = review.lens_command(review.LENS_A, tmp_path / "main")
    assert option(command, "--setting-sources") == ""
    settings = json.loads(option(command, "--settings"))
    assert settings["permissions"]["allow"] == []
    deny = settings["permissions"]["deny"]
    assert f"Edit(/{tmp_path / 'main'}/.private/**)" in deny
    assert "Bash(gh:*)" in deny
    assert any(rule.startswith("Read(") for rule in deny), "the harness's secret-read denials"
    (hook,) = settings["hooks"]["PreToolUse"][0]["hooks"]
    assert hook["command"].endswith(str(review.HARNESS / ".claude" / "hooks" / "guard.mjs"))
    assert option(command, "--permission-mode") == "dontAsk"


def test_a_lens_is_given_its_agent_from_the_review_code_checkout(tmp_path: Path) -> None:
    command = review.lens_command(review.LENS_A, tmp_path / "main")
    agents = json.loads(option(command, "--agents"))
    assert list(agents) == ["pr-reviewer"] == [option(command, "--agent")]
    text = (review.HARNESS / ".claude" / "agents" / "pr-reviewer.md").read_text()
    assert agents["pr-reviewer"]["prompt"] in text
    assert agents["pr-reviewer"]["prompt"]


def test_an_agent_that_names_the_record_is_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    agents = tmp_path / ".claude" / "agents"
    agents.mkdir(parents=True)
    (agents / "pr-reviewer.md").write_text(
        "---\nname: pr-reviewer\ndescription: d\n---\nUse the Ledger.\n"
    )
    (agents / "plain.md").write_text("no frontmatter\n")
    monkeypatch.setattr(review, "HARNESS", tmp_path)
    with pytest.raises(review.Refused):
        review.agent_definition("pr-reviewer")
    with pytest.raises(review.Refused):
        review.agent_definition("plain")
    with pytest.raises(review.Refused):
        review.agent_definition("missing")


def test_no_lens_starts_without_the_guard(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / ".claude").mkdir()
    (tmp_path / ".claude" / "settings.json").write_text('{"permissions": {"deny": []}}')
    monkeypatch.setattr(review, "HARNESS", tmp_path)
    with pytest.raises(review.Refused):
        review.lens_settings(tmp_path / "main")


def test_the_lens_runs_with_its_slot_database_and_no_inherited_project(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CLAUDE_PROJECT_DIR", "/elsewhere")
    monkeypatch.setenv("VEXTRUS_DB_NAME", "vextrus")
    env = review.lens_env(3)
    assert env["VEXTRUS_DB_NAME"] == "vextrus_rv_slot3"
    assert "CLAUDE_PROJECT_DIR" not in env
