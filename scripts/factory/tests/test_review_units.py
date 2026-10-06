"""Unit tests of `scripts.factory.review` at its seams: the tier, the red-CI rule, the PR argument, the
replay path, the lens's answer, the slot lock and the words a lens is given."""

import json
import os
import re
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
    assert review.replay(repo(tmp_path), 1, "tests/test_a.py") is confirmed


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


# ---------------------------------------------------------------- the refuter's findings (S14-R1)


def git(where: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(where), *args], capture_output=True, text=True, check=True)
    return done.stdout.strip()


def repo(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    for key, value in (("user.email", "t@example.com"), ("user.name", "t"), ("commit.gpgsign", "false")):
        git(root, "config", key, value)
    allowlist = root / review.ALLOWLIST
    allowlist.parent.mkdir(parents=True)
    allowlist.write_text(f"{HASH}\n")
    git(root, "add", "-A")
    git(root, "commit", "-q", "-m", "base")
    git(root, "update-ref", "refs/remotes/origin/main", "HEAD")
    return root


def test_lines_added_as_plus_plus_are_read_and_never_pass_as_hashes(tmp_path: Path) -> None:
    """Refuted: `++ text` added to the allowlist showed as `+++ text` and was skipped as a header."""
    root = repo(tmp_path)
    (root / review.ALLOWLIST).write_text(f"{HASH}\n{'b' * 64}\n++ any text at all\n+++ b/also\n")
    git(root, "commit", "-q", "-am", "the change")
    rows, added = review.changes(root, git(root, "rev-parse", "HEAD"))
    assert added == ["b" * 64, "++ any text at all", "+++ b/also"]
    assert review.tier(rows, added) != "allowlist-only"


def test_an_added_line_count_unlike_numstat_is_never_allowlist_only() -> None:
    assert review.tier([(review.ALLOWLIST, 2, 0)], [HASH]) != "allowlist-only"


def test_a_coloured_failure_still_confirms_and_replay_runs_without_colour(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Refuted: with FORCE_COLOR in the orchestrator's shell pytest wrote `\\x1b[31mFAILED`, so no
    replay ever confirmed."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    script = bin_dir / "uv"
    script.write_text(
        '#!/bin/sh\nenv > "$0.env"\n'
        "printf '\\033[31mFAILED\\033[0m tests/test_a.py::test_attack - AssertionError\\n'\nexit 1\n"
    )
    script.chmod(0o755)
    monkeypatch.setenv("PATH", f"{bin_dir}:/usr/bin:/bin")
    monkeypatch.setenv("FORCE_COLOR", "3")
    assert review.replay(repo(tmp_path), 1, "tests/test_a.py") is True
    seen = (bin_dir / "uv.env").read_text().splitlines()
    assert "NO_COLOR=1" in seen
    assert not [line for line in seen if line.startswith("FORCE_COLOR=")]


def test_files_the_lens_left_besides_its_repro_are_gone_before_replay(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Refuted: an untracked pytest.ini the lens wrote (addopts naming a file outside rv) survived
    `git reset --hard` and made the replay run code outside the worktree."""
    rv = repo(tmp_path)
    head = git(rv, "rev-parse", "HEAD")
    (rv / review.ALLOWLIST).write_text("edited by the lens\n")
    (rv / "pytest.ini").write_text("[pytest]\naddopts = /elsewhere/test_out.py\n")
    (rv / "tests").mkdir()
    (rv / "tests" / "conftest.py").write_text("x = 1\n")
    (rv / "tests" / "test_attack.py").write_text("def test_attack():\n    assert False\n")
    seen: list[list[str]] = []

    def replay(where: Path, slot: int, test_file: str) -> bool:
        seen.append(sorted(str(p.relative_to(where)) for p in where.rglob("*") if ".git" not in p.parts))
        return True

    monkeypatch.setattr(review, "replay", replay)
    run = review.Run(pr=12, round_=1, head=head, merged=head, slot=1)
    run.findings = [
        review.Finding("l1-f1", 70, "a.py", 1, "s", "tests/test_attack.py"),
        review.Finding("l1-f2", 60, "a.py", 1, "s", "pytest.ini"),
    ]
    review.confirm(run, rv)
    assert seen == [["tests", "tests/test_attack.py", "tools", "tools/leakscan", review.ALLOWLIST]]
    assert (rv / review.ALLOWLIST).read_text() == f"{HASH}\n"
    assert [item.word for item in run.findings] == ["CONFIRMED", "UNPROVEN"]


@pytest.mark.parametrize("name", ["tests/test_[a].py", "tests/test a.py", "tests/!a.py", "tests/a*.py"])
def test_a_repro_name_that_is_not_a_plain_path_is_never_replayed(tmp_path: Path, name: str) -> None:
    (tmp_path / "tests").mkdir()
    (tmp_path / name).write_text("x")
    assert review.replay_target(tmp_path, name) is None


def test_the_words_lens_cannot_write_and_no_lens_starts_agents(tmp_path: Path) -> None:
    """Refuted: ux-critic is read-only by its own file, but was given Edit and Write."""
    words = review.lens_command(review.WORDS, tmp_path)
    allowed = option(words, "--allowedTools").split(",")
    assert not [tool for tool in allowed if tool.startswith(("Edit", "Write"))]
    assert {"Edit", "Write", "Agent"} <= set(option(words, "--disallowedTools").split(","))
    for lens in (review.LENS_A, review.LENS_B):
        command = review.lens_command(lens, tmp_path)
        assert "Agent" in option(command, "--disallowedTools").split(",")
        assert "Edit(./**)" in option(command, "--allowedTools").split(",")


@pytest.mark.parametrize(
    "path",
    [
        ".mcp.json",
        ".gitignore",
        "pyproject.toml",
        "uv.lock",
        "conftest.py",
        "web/package.json",
        "vextrus/settings/base.py",
        "vextrus/api/middleware.py",
    ],
)
def test_harness_and_config_paths_are_never_small(path: str) -> None:
    """Refuted: these took the one-lens tier."""
    assert review.tier([(path, 1, 0)], []) == "normal"


def staged_run(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, forge: bool) -> tuple[Path, list[str]]:
    """`review.review` with every outside step replaced; `forge`: the PR's code writes a record."""
    main = tmp_path / "main"
    ledger_dir = main / ".private" / "work" / "factory" / "ledger"
    recorded: list[str] = []

    def lenses_in(*_: object) -> list[dict[str, Any]]:
        if forge:
            ledger_dir.mkdir(parents=True, exist_ok=True)
            (ledger_dir / f"12-{H}.json").write_text('{"round": 1, "verdict": "PASS"}')
        return [{"verdict": "PASS", "findings": []}]

    monkeypatch.setattr(review, "resolve", lambda pr: H)
    monkeypatch.setattr(review, "merged_head", lambda main, pr, head: (H, "c" * 40))
    monkeypatch.setattr(review, "changes", lambda main, merged, base: ([("a.py", 1, 0)], []))
    monkeypatch.setattr(review, "merge_bases", lambda main, head, base: 1)
    monkeypatch.setattr(review, "claim_slot", lambda where: (1, (tmp_path / "held").open("a")))
    monkeypatch.setattr(review, "prepare", lambda *_, **__: None)
    monkeypatch.setattr(review, "lenses_in", lenses_in)
    monkeypatch.setattr(review, "record", lambda *_: recorded.append("record"))
    return main, recorded


def test_a_record_that_appears_while_the_prs_code_ran_is_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    main, recorded = staged_run(tmp_path, monkeypatch, forge=True)
    args = review.parse(["run", "12", "--round", "1"])
    run = review.Run(pr=12, round_=1)
    with pytest.raises(review.Refused, match="appeared"):
        review.review(run, args, main)
    assert recorded == []


def test_without_a_forged_record_the_round_is_recorded(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    main, recorded = staged_run(tmp_path, monkeypatch, forge=False)
    review.review(review.Run(pr=12, round_=1), review.parse(["run", "12", "--round", "1"]), main)
    assert recorded == ["record"]


def test_a_head_already_recorded_starts_nothing(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    main, recorded = staged_run(tmp_path, monkeypatch, forge=False)
    monkeypatch.setattr(review, "merged_head", lambda *_: pytest.fail("a merge was started"))
    ledger_dir = main / ".private" / "work" / "factory" / "ledger"
    ledger_dir.mkdir(parents=True)
    (ledger_dir / f"12-{H}.json").write_text('{"round": 1, "verdict": "FIX"}')
    with pytest.raises(review.Refused, match="already recorded"):
        review.review(review.Run(pr=12, round_=2), review.parse(["run", "12", "--round", "2"]), main)
    assert recorded == []


@pytest.mark.parametrize(
    "path",
    [
        "web/eslint/vextrus.js",
        "web/scripts/lint-css.mjs",
        "vextrus/testing/database.py",
        "web/.npmrc",
        "web/eslint.config.js",
        "web/vite.config.ts",
        "web/tsconfig.app.json",
        "scripts/factory/review.py",
    ],
)
def test_lint_test_harness_and_nested_config_paths_are_never_small(path: str) -> None:
    """Refuted in the fix round: these still took the one-lens tier."""
    assert review.tier([(path, 1, 0)], []) == "normal"


def test_an_ignored_file_beside_the_repro_is_gone_before_replay(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Refuted in the fix round: an ignored `pytest.ini` beside the repro survived `git clean -fd`."""
    rv = repo(tmp_path)
    head = git(rv, "rev-parse", "HEAD")
    attack = rv / "tests" / "attack"
    attack.mkdir(parents=True)
    (attack / ".gitignore").write_text("*\n")
    (attack / "pytest.ini").write_text("[pytest]\naddopts = /elsewhere/test_out.py\n")
    (attack / "test_r.py").write_text("def test_attack():\n    assert False\n")
    seen: list[bool] = []
    monkeypatch.setattr(
        review, "replay", lambda where, slot, test_file: seen.append((attack / "pytest.ini").exists())
    )
    run = review.Run(pr=12, round_=1, head=head, merged=head, slot=1)
    run.findings = [review.Finding("l1-f1", 70, "a.py", 1, "s", "tests/attack/test_r.py")]
    review.confirm(run, rv)
    assert seen == [False]
    assert (attack / "test_r.py").is_file()


# ---------------------------------------------------------------- review round 1 on PR #472


def criss_cross(tmp_path: Path) -> tuple[Path, str]:
    """main and the PR merged each other (a criss-cross); the PR's second merge quietly reverts a
    code change main has, then adds a doc. Merging it changes `a.py` on main."""
    root = tmp_path / "criss"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    for key, value in (("user.email", "t@example.com"), ("user.name", "t"), ("commit.gpgsign", "false")):
        git(root, "config", key, value)
    (root / "docs").mkdir()
    (root / "a.py").write_text("x = 1\n")
    (root / "docs" / "n.md").write_text("# n\n")
    git(root, "add", "a.py", "docs/n.md")
    git(root, "commit", "-q", "-m", "O")
    git(root, "switch", "-q", "-c", "topic")
    (root / "a.py").write_text("x = 2\n")
    git(root, "commit", "-q", "-am", "T1")
    git(root, "switch", "-q", "main")
    (root / "docs" / "n.md").write_text("# n2\n")
    git(root, "commit", "-q", "-am", "M1")
    m1 = git(root, "rev-parse", "HEAD")
    git(root, "merge", "-q", "--no-edit", "topic")
    git(root, "switch", "-q", "topic")
    git(root, "merge", "-q", "--no-commit", m1)
    (root / "a.py").write_text("x = 1\n")
    git(root, "add", "a.py")
    git(root, "commit", "-q", "-m", "T2, an evil merge")
    (root / "docs" / "t.md").write_text("# t3\n")
    git(root, "add", "docs/t.md")
    git(root, "commit", "-q", "-m", "T3")
    git(root, "update-ref", "refs/remotes/origin/main", "main")
    return root, git(root, "rev-parse", "HEAD")


def test_a_criss_cross_merge_that_changes_code_is_never_docs_only(tmp_path: Path) -> None:
    root, head = criss_cross(tmp_path)
    tree = git(root, "merge-tree", "--write-tree", "origin/main", head).split()[0]
    merged = git(root, "commit-tree", tree, "-p", head, "-p", "origin/main", "-m", "merged")
    assert review.merge_bases(root, head) == 2
    for rows, _ in (review.changes(root, merged), review.changes(root, head)):
        assert "a.py" in [path for path, _, _ in rows], rows
        assert review.tier(rows, [], bases=2) not in ("docs-only", "allowlist-only")
        assert review.tier(rows, []) not in ("docs-only", "allowlist-only")


def test_more_than_one_merge_base_never_gets_a_no_model_tier() -> None:
    assert review.tier([("docs/a.md", 1, 0)], [], bases=2) != "docs-only"
    assert review.tier([(review.ALLOWLIST, 1, 0)], [HASH], bases=2) != "allowlist-only"
    assert review.tier([("docs/a.md", 1, 0)], [], bases=1) == "docs-only"


@pytest.mark.parametrize(
    ("path", "words"),
    [(".github/workflows/cé.yml", False), ("web/src/messages/bn-é.json", True)],
)
def test_a_non_ascii_path_is_read_as_itself(tmp_path: Path, path: str, words: bool) -> None:
    # The CI workflow must take two lenses; the messages file must bring the words lens.
    """Round 1: numstat without -z C-quoted these, so no path rule matched them."""
    root = repo(tmp_path)
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("on: push\n")
    git(root, "add", path)
    git(root, "commit", "-q", "-m", "a non-ASCII path")
    rows, added = review.changes(root, git(root, "rev-parse", "HEAD"))
    assert [row[0] for row in rows] == [path]
    assert (review.tier(rows, added) == "normal") is not words
    assert any(name.startswith(review.MESSAGES) for name, _, _ in rows) is words


WRAPPER = review.HARNESS / "scripts" / "factory" / "lens_pytest.py"


def lens_pytest() -> Any:
    import importlib.util

    spec = importlib.util.spec_from_file_location("lens_pytest", WRAPPER)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_a_lens_has_one_bash_command_the_harness_wrapper_and_no_git() -> None:
    """Round 1: `git diff --output=<path>` and `uv run pytest --basetemp=<dir>` write or delete
    anywhere, and the guard lets them through for a lens."""
    bash = [tool for tool in review.ALLOWED_TOOLS if tool.startswith("Bash")]
    assert bash == [f"Bash({review.LENS_TEST}:*)"]
    assert f"uv run python {WRAPPER}" == review.LENS_TEST
    assert not [tool for tool in review.ALLOWED_TOOLS if "git" in tool]


@pytest.mark.parametrize(
    "argv",
    [
        ["--basetemp=victim", "tests/test_a.py"],
        ["--basetemp", "victim", "tests/test_a.py"],
        ["--junitxml=out.xml", "tests/test_a.py"],
        ["--junit-xml=out.xml", "tests/test_a.py"],
        ["-o", "cache_dir=/elsewhere", "tests/test_a.py"],
        ["-p", "evil", "tests/test_a.py"],
        ["-c", "other.ini", "tests/test_a.py"],
        ["--rootdir=/", "tests/test_a.py"],
        ["--output=x", "tests/test_a.py"],
        ["--result-log=x", "tests/test_a.py"],
        ["--confcutdir=/", "tests/test_a.py"],
        ["--override-ini=x=y", "tests/test_a.py"],
        ["-k", "--basetemp=victim", "tests/test_a.py"],
        ["-k"],
        ["/etc/hosts"],
        ["../outside.py"],
        ["tests/missing.py"],
        ["-rf"],
        [],
    ],
)
def test_the_wrapper_refuses_every_option_but_its_few(tmp_path: Path, argv: list[str]) -> None:
    (tmp_path / "tests").mkdir()
    (tmp_path / "tests" / "test_a.py").write_text("def test_a():\n    pass\n")
    module = lens_pytest()
    with pytest.raises(module.Refused):
        module.check(argv, tmp_path)


def test_the_wrapper_takes_test_paths_and_its_flags(tmp_path: Path) -> None:
    (tmp_path / "tests").mkdir()
    (tmp_path / "tests" / "test_a.py").write_text("def test_a():\n    pass\n")
    argv = ["-rf", "-q", "--tb=short", "-k", "a and not b", "tests/test_a.py::test_a", "tests"]
    assert lens_pytest().check(argv, tmp_path) == argv


def wrapper_run(where: Path, *argv: str) -> subprocess.Popen[str]:
    # The outer run's Django settings would make pytest-django import vextrus in a scratch repo.
    env = {key: value for key, value in os.environ.items() if key != "DJANGO_SETTINGS_MODULE"}
    return subprocess.Popen(
        [sys.executable, str(WRAPPER), *argv],
        cwd=where,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def test_basetemp_through_the_wrapper_deletes_nothing(tmp_path: Path) -> None:
    root = repo(tmp_path)
    (root / "victim").mkdir()
    (root / "victim" / "keep.txt").write_text("kept\n")
    (root / "tests").mkdir()
    (root / "tests" / "test_a.py").write_text("def test_a():\n    pass\n")
    done = wrapper_run(root, "--basetemp=victim", "tests/test_a.py")
    _, err = done.communicate(timeout=120)
    assert done.returncode == 2, err
    assert (root / "victim" / "keep.txt").is_file()


def test_the_wrapper_waits_for_the_pytest_lock(tmp_path: Path) -> None:
    """Round 1: two lenses share rv<N> and its database; overlapping runs errored. Every lens test
    run, and every replay, takes the main checkout's pytest lock."""
    import fcntl

    root = repo(tmp_path)
    (root / "tests").mkdir()
    (root / "tests" / "test_a.py").write_text("def test_a():\n    pass\n")
    lock = root / ".private" / "work" / "factory" / "pytest.lock"
    lock.parent.mkdir(parents=True)
    with lock.open("a") as held:
        fcntl.flock(held, fcntl.LOCK_EX)
        waiting = wrapper_run(root, "-q", "tests/test_a.py")
        with pytest.raises(subprocess.TimeoutExpired):
            waiting.wait(timeout=2)
    out, err = waiting.communicate(timeout=120)
    assert waiting.returncode == 0, out + err


def test_replay_takes_the_pytest_lock(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import fcntl

    root = repo(tmp_path)
    real = review._run
    held: list[bool] = []

    def run(argv: list[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
        if argv[0] == "git":
            return real(argv, **kwargs)
        with (root / ".private" / "work" / "factory" / "pytest.lock").open("a") as probe:
            try:
                fcntl.flock(probe, fcntl.LOCK_EX | fcntl.LOCK_NB)
                held.append(False)
            except BlockingIOError:
                held.append(True)
        return subprocess.CompletedProcess(argv, 0, "1 passed", "")

    monkeypatch.setattr(review, "run_group", run)
    assert review.replay(root, 1, "tests/test_a.py") is False
    assert held == [True]


def test_each_lens_writes_its_attack_tests_in_its_own_folder(tmp_path: Path) -> None:
    run = review.Run(pr=12, round_=1, head=H, merged=H, slot=1)
    folders = set()
    for lens in (review.LENS_A, review.LENS_B, review.WORDS):
        text = review.brief(run, lens, tmp_path / "rv1", tmp_path / "slot1")
        assert f"review_attacks/{lens.label}/" in text
        assert review.LENS_TEST in text
        folders.add(lens.label)
    assert len(folders) == 3


# ---------------------------------------------------------------- review round 2 on PR #472


LATIN1_PATH = os.fsdecode(b"fixtures/caf\xe9.dxf")


def test_a_latin1_file_and_path_never_crash_the_tier_or_the_facts(tmp_path: Path) -> None:
    """Round 2: strict UTF-8 decoding died on a cp1252 fixture or a Latin-1 path."""
    root = repo(tmp_path)
    base = git(root, "rev-parse", "HEAD")
    (root / "fixtures").mkdir()
    (root / LATIN1_PATH).write_bytes(b"0\nSECTION\n2\nCAF\xc9 \xb0C\n")
    (root / "fixtures" / "plain.dxf").write_bytes(b"\xe9t\xe9\n")
    git(root, "add", "--", LATIN1_PATH, "fixtures/plain.dxf")
    git(root, "commit", "-q", "-m", "cp1252 fixtures")
    head = git(root, "rev-parse", "HEAD")
    rows, _ = review.changes(root, head, base)
    assert sorted(row[0] for row in rows) == sorted([LATIN1_PATH, "fixtures/plain.dxf"])
    run = review.Run(pr=12, round_=1, head=head, merged=head, base=base)
    diff, _ = review.write_facts(root, run, tmp_path / "out" / "12")
    assert b"\xc9 \xb0C" in diff.read_bytes()


def test_the_facts_and_the_tier_use_mains_sha_from_the_fetch_not_the_moving_ref(tmp_path: Path) -> None:
    """Round 2: after the lock, origin/main moved (another fetch) and the lens diff showed the PR
    deleting main's newest file."""
    root = repo(tmp_path)
    base = git(root, "rev-parse", "HEAD")
    git(root, "switch", "-q", "-c", "pr")
    (root / "a.py").write_text("x = 1\n")
    git(root, "add", "a.py")
    git(root, "commit", "-q", "-m", "the PR")
    head = git(root, "rev-parse", "HEAD")
    git(root, "switch", "-q", "main")
    (root / "newest_on_main.py").write_text("y = 2\n")
    git(root, "add", "newest_on_main.py")
    git(root, "commit", "-q", "-m", "main moves on")
    git(root, "update-ref", "refs/remotes/origin/main", "main")
    run = review.Run(pr=12, round_=1, head=head, merged=head, base=base)
    diff, log = review.write_facts(root, run, tmp_path / "out" / "12")
    assert "newest_on_main" not in diff.read_text()
    assert "a.py" in diff.read_text()
    assert "main moves on" not in log.read_text()
    rows, _ = review.changes(root, head, base)
    assert [row[0] for row in rows] == ["a.py"]
    assert review.merge_bases(root, head, base) == 1


def test_merged_head_records_mains_sha_at_the_fetch(tmp_path: Path) -> None:
    origin = tmp_path / "origin.git"
    root = repo(tmp_path)
    subprocess.run(["git", "init", "-q", "--bare", "-b", "main", str(origin)], check=True)
    git(root, "remote", "add", "origin", str(origin))
    git(root, "push", "-q", "origin", "main")
    git(root, "switch", "-q", "-c", "pr")
    (root / "a.py").write_text("x = 1\n")
    git(root, "add", "a.py")
    git(root, "commit", "-q", "-m", "the PR")
    head = git(root, "rev-parse", "HEAD")
    git(root, "push", "-q", "origin", "HEAD:refs/pull/12/head")
    git(root, "switch", "-q", "main")
    (root / "b.py").write_text("y = 2\n")
    git(root, "add", "b.py")
    git(root, "commit", "-q", "-m", "main moves on")
    git(root, "push", "-q", "origin", "main")
    main_sha = git(root, "rev-parse", "HEAD")
    merged, base = review.merged_head(root, 12, head)
    assert base == main_sha
    assert git(root, "rev-list", "--parents", "-n", "1", merged).split()[1:] == [head, main_sha]


def test_an_uncaught_error_exits_non_zero_and_its_cost_line_says_so(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Round 2: a UnicodeDecodeError left a traceback and a cost line saying exit 0."""

    def crash(run: review.Run, args: object, main: Path) -> None:
        run.tier = "small"
        raise UnicodeDecodeError("utf-8", b"\xe9", 0, 1, "invalid continuation byte")

    monkeypatch.setattr(review, "main_checkout", lambda: tmp_path)
    monkeypatch.setattr(review, "review", crash)
    assert review.main(["run", "12", "--round", "1"]) == review.CRASHED != 0
    (line,) = [
        json.loads(text)
        for text in (tmp_path / ".private" / "work" / "factory" / "review-cost.jsonl")
        .read_text()
        .split("\n")
        if text
    ]
    assert line["exit"] == review.CRASHED
    assert "UnicodeDecodeError" in line["refused"]
    assert json.loads(capsys.readouterr().out)["exit"] == review.CRASHED


def test_a_refusal_after_the_tier_has_its_exit_in_the_cost_line(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def refuse(run: review.Run, args: object, main: Path) -> None:
        run.tier = "normal"
        raise review.Refused("a lens gave no answer")

    monkeypatch.setattr(review, "main_checkout", lambda: tmp_path)
    monkeypatch.setattr(review, "review", refuse)
    assert review.main(["run", "12", "--round", "1"]) == 3
    text = (tmp_path / ".private" / "work" / "factory" / "review-cost.jsonl").read_text()
    assert json.loads(text)["exit"] == 3


@pytest.mark.parametrize(
    "expression",
    [
        "needs_toolchain",
        "needs_toolchain or needs_bwrap",
        "(needs_toolchain or needs_bwrap) and not needs_bwrap",
    ],
)
def test_the_wrapper_takes_a_marker_expression_of_declared_markers(
    tmp_path: Path, expression: str
) -> None:
    """Round 2: the repo's addopts deselect toolchain tests unless -m names them; a lens could not run
    an engine PR's toolchain test."""
    (tmp_path / "tests").mkdir()
    (tmp_path / "tests" / "test_a.py").write_text("def test_a():\n    pass\n")
    argv = ["-m", expression, "tests/test_a.py"]
    expected = ["-m", f"({expression}) and not live", "tests/test_a.py"]
    assert lens_pytest().check(argv, tmp_path) == expected


@pytest.mark.parametrize(
    "expression",
    ["", "()", "slow", "needs_toolchain or undeclared", "--basetemp=x", "needs_toolchain;rm", "-p evil"],
)
def test_the_wrapper_refuses_any_other_marker_expression(tmp_path: Path, expression: str) -> None:
    (tmp_path / "tests").mkdir()
    (tmp_path / "tests" / "test_a.py").write_text("def test_a():\n    pass\n")
    module = lens_pytest()
    with pytest.raises(module.Refused):
        module.check(["-m", expression, "tests/test_a.py"], tmp_path)
    with pytest.raises(module.Refused):
        module.check(["tests/test_a.py", "-m"], tmp_path)


def test_the_wrapper_runs_a_toolchain_marked_test_when_asked(tmp_path: Path) -> None:
    root = repo(tmp_path)
    (root / "tests").mkdir()
    (root / "pytest.ini").write_text(
        "[pytest]\naddopts = -m 'not needs_toolchain'\nmarkers =\n    needs_toolchain: x\n"
    )
    (root / "tests" / "test_t.py").write_text(
        "import pytest\n\n\n@pytest.mark.needs_toolchain\ndef test_t():\n    assert False\n"
    )
    plain = wrapper_run(root, "-q", "tests/test_t.py")
    plain.communicate(timeout=120)
    assert plain.returncode == 5  # deselected by addopts: nothing ran
    asked = wrapper_run(root, "-q", "-m", "needs_toolchain", "tests/test_t.py")
    out, err = asked.communicate(timeout=120)
    assert asked.returncode == 1, out + err  # it ran (and fails, as written)


# ---------------------------------------------------------------- review round 3 on PR #472


def test_the_brief_names_exactly_the_options_the_wrapper_takes(tmp_path: Path) -> None:
    """Round 3: the wrapper took `-m <declared marker>` but the brief said `-rf` and no other option,
    so a lens's run of a toolchain-marked module deselected everything (exit 5)."""
    module = lens_pytest()
    text = review.brief(
        review.Run(pr=12, round_=1, head=H, merged=H, slot=1), review.LENS_B, tmp_path, tmp_path
    )
    assert module.options_text() in text
    (tmp_path / "test_a.py").write_text("def test_a():\n    pass\n")
    named = re.findall(r"(?<![\w-])(-[A-Za-z]+|--tb=\w+)", module.options_text())
    for flag in module.FLAGS:
        assert flag in named
        assert module.check([flag, "test_a.py"], tmp_path) == [flag, "test_a.py"]
    for style in module.TB_STYLES:
        assert module.check([f"--tb={style}", "test_a.py"], tmp_path)
    assert "-k" in named
    assert "-m" in named
    for marker in sorted(module.declared_markers() - module.FORBIDDEN_MARKERS):
        assert marker in text
        assert module.check(["-m", marker, "test_a.py"], tmp_path)
    assert "`-m needs_toolchain`" in text
    for option in set(named) - {*module.FLAGS, "-k", "-m"}:
        assert option.startswith("--tb="), f"the brief names {option}, which the wrapper refuses"


def test_replay_selects_a_marked_modules_tests_and_never_live(tmp_path: Path) -> None:
    (tmp_path / "plain.py").write_text("def test_a():\n    assert False\n")
    (tmp_path / "tool.py").write_text(
        "import pytest\n\n\n@pytest.mark.needs_toolchain\ndef test_a(): ...\n"
    )
    (tmp_path / "live.py").write_text("import pytest\n\npytestmark = pytest.mark.live\n")
    (tmp_path / "both.py").write_text(
        "pytestmark = [pytest.mark.needs_bwrap, pytest.mark.needs_toolchain]\n"
    )
    assert review.replay_marks(tmp_path / "plain.py") == []
    assert review.replay_marks(tmp_path / "live.py") == []
    assert review.replay_marks(tmp_path / "missing.py") == []
    assert review.replay_marks(tmp_path / "tool.py") == [
        "-m",
        "(needs_toolchain or not (needs_toolchain)) and not live",
    ]
    assert review.replay_marks(tmp_path / "both.py") == [
        "-m",
        "(needs_bwrap or needs_toolchain or not (needs_bwrap or needs_toolchain)) and not live",
    ]


def test_a_toolchain_marked_repro_is_replayed_not_deselected(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Round 3: the replay's `uv run pytest -rf <file>` deselected a needs_toolchain repro (exit 5),
    which then stood UNPROVEN. Real pytest, behind a `uv` that runs it."""
    root = repo(tmp_path)
    (root / "pytest.ini").write_text(
        "[pytest]\naddopts = -m 'not needs_toolchain and not needs_bwrap'\n"
        "markers =\n    needs_toolchain: x\n    needs_bwrap: y\n"
    )
    (root / "tests").mkdir()
    (root / "tests" / "test_repro.py").write_text(
        "import pytest\n\n\n@pytest.mark.needs_toolchain\ndef test_attack():\n    assert False\n\n\n"
        "def test_plain():\n    pass\n"
    )
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    (bin_dir / "uv").write_text(
        f'#!/bin/sh\nshift 2\nexec {sys.executable} -m pytest -p no:cacheprovider "$@"\n'
    )
    (bin_dir / "uv").chmod(0o755)
    monkeypatch.setenv("PATH", f"{bin_dir}:/usr/bin:/bin")
    monkeypatch.delenv("DJANGO_SETTINGS_MODULE", raising=False)
    assert review.replay(root, 1, "tests/test_repro.py") is True


# ---------------------------------------------------------------- PR #478 review, round 1


@pytest.mark.parametrize(
    "path",
    [
        "docs/CLAUDE.md",
        "docs/notes/AGENTS.md",
        "docs/.claude/skills/walk/SKILL.md",
        "docs/.claude/agents/pr-reviewer.md",
        "docs/knowledge/jev-nodes.md",
        "docs/specs/factory/contracts/trailers.md",
        "docs/agents/domain.md",
        "docs/handoff/session-15-prompt.md",
        "docs/adr/0099-auth-wall.md",
    ],
)
def test_agent_instructions_and_files_code_reads_are_never_docs_only(path: str) -> None:
    """Finding 1: any docs/**.md passed with no model, agent instruction files and jev's pin table
    among them."""
    assert review.tier([(path, 3, 0)], []) != "docs-only"
    assert review.tier([("docs/notes/howto.md", 3, 0), (path, 3, 0)], []) != "docs-only"


def test_jevs_pin_table_is_never_docs_only() -> None:
    from scripts.factory import jev

    assert not review.docs_only(str(jev.PIN_FILE.relative_to(review.HARNESS)))


def test_plain_docs_stay_docs_only() -> None:
    assert review.tier([("docs/notes/howto.md", 3, 0), ("docs/adr/0050-x.md", 9, 1)], []) == "docs-only"


@pytest.mark.parametrize(
    "path",
    [
        "engine/read/sandbox.py",
        "engine/read/libredwg/__init__.py",
        "vextrus/drawings/uploads.py",
        "vextrus/takeoff/http/upload.py",
        "vextrus/projects/services/access.py",
        "vextrus/drawings/services/_access.py",
        "vextrus/routers.py",
        "vextrus/settings/tenancy.py",
        "vextrus/platform/admin/tenancy.py",
        "vextrus/platform/http/middleware.py",
        "vextrus/platform/http/views.py",
        "vextrus/platform/services/auth.py",
        "scripts/real_drawings/sandbox.py",
    ],
)
def test_the_repos_walls_are_never_small(path: str) -> None:
    """Finding 2: a 25-line change to these took one lens."""
    assert review.tier([(path, 25, 0)], []) == "normal"


@pytest.mark.parametrize("expression", ["live", "not live", "needs_toolchain or live", "(live)"])
def test_the_wrapper_never_selects_live(tmp_path: Path, expression: str) -> None:
    """Finding 3: `-m live` reached a live outside service with the owner's key."""
    (tmp_path / "test_a.py").write_text("def test_a():\n    pass\n")
    module = lens_pytest()
    with pytest.raises(module.Refused):
        module.check(["-m", expression, "test_a.py"], tmp_path)


def test_a_replay_never_runs_a_live_test(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Finding 3: the replay's `-m "needs_toolchain or not (needs_toolchain)"` overrode the addopts
    deselection, so a live test in the repro module ran. Real pytest behind a `uv` that runs it."""
    root = repo(tmp_path)
    called = tmp_path / "live-called"
    (root / "pytest.ini").write_text(
        "[pytest]\naddopts = -m 'not needs_toolchain and not live'\n"
        "markers =\n    needs_toolchain: x\n    live: y\n"
    )
    (root / "tests").mkdir()
    (root / "tests" / "test_repro.py").write_text(
        "import pathlib\nimport pytest\n\n\n@pytest.mark.needs_toolchain\ndef test_attack():\n"
        "    assert False\n\n\n@pytest.mark.live\n@pytest.mark.needs_toolchain\ndef test_live():\n"
        f"    pathlib.Path({str(called)!r}).write_text('called')\n"
    )
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    uv = f'#!/bin/sh\nshift 2\nexec {sys.executable} -m pytest -p no:cacheprovider "$@"\n'
    (bin_dir / "uv").write_text(uv)
    (bin_dir / "uv").chmod(0o755)
    monkeypatch.setenv("PATH", f"{bin_dir}:/usr/bin:/bin")
    monkeypatch.delenv("DJANGO_SETTINGS_MODULE", raising=False)
    assert review.replay(root, 1, "tests/test_repro.py") is True
    assert not called.exists(), "the live test ran"


def alive(pid: int) -> bool:
    try:
        state = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()[0]
    except OSError:
        return False
    return state != "Z"


def gone(pid: int, seconds: float = 15) -> bool:
    import time

    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if not alive(pid):
            return True
        time.sleep(0.1)
    return False


HANGS = (
    "import os, pathlib, time\n\n\ndef test_hang():\n"
    "    pathlib.Path({!r}).write_text(str(os.getpid()))\n    time.sleep(600)\n"
)


def hanging_repo(tmp_path: Path) -> tuple[Path, Path]:
    root = repo(tmp_path)
    pid_file = tmp_path / "pytest.pid"
    (root / "tests").mkdir()
    (root / "tests" / "test_hang.py").write_text(HANGS.format(str(pid_file)))
    return root, pid_file


def read_pid(pid_file: Path, seconds: float = 30) -> int:
    import time

    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if pid_file.exists() and pid_file.read_text():
            return int(pid_file.read_text())
        time.sleep(0.1)
    raise AssertionError("the hanging test never started")


def lock_free(root: Path) -> bool:
    import fcntl

    with (root / ".private" / "work" / "factory" / "pytest.lock").open("a") as probe:
        try:
            fcntl.flock(probe, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return False
        return True


def test_a_hanging_test_is_stopped_at_the_wrappers_limit_and_frees_the_lock(tmp_path: Path) -> None:
    """Finding 4: a hung attack test held the machine-wide pytest lock with no limit."""
    root, pid_file = hanging_repo(tmp_path)
    env = {key: value for key, value in os.environ.items() if key != "DJANGO_SETTINGS_MODULE"}
    env["VEXTRUS_LENS_PYTEST_TIMEOUT"] = "3"
    done = subprocess.run(
        [sys.executable, str(WRAPPER), "-q", "tests/test_hang.py"],
        cwd=root,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    assert done.returncode == 124, done.stderr
    assert gone(read_pid(pid_file))
    assert lock_free(root)


def test_a_variable_can_only_lower_the_wrappers_limits(monkeypatch: pytest.MonkeyPatch) -> None:
    module = lens_pytest()
    monkeypatch.setenv("VEXTRUS_LENS_PYTEST_TIMEOUT", str(module.TIMEOUT * 10))
    assert module.bounded("VEXTRUS_LENS_PYTEST_TIMEOUT", module.TIMEOUT) == module.TIMEOUT
    monkeypatch.setenv("VEXTRUS_LENS_PYTEST_TIMEOUT", "-5")
    assert module.bounded("VEXTRUS_LENS_PYTEST_TIMEOUT", module.TIMEOUT) == module.TIMEOUT
    monkeypatch.setenv("VEXTRUS_LENS_PYTEST_TIMEOUT", "7")
    assert module.bounded("VEXTRUS_LENS_PYTEST_TIMEOUT", module.TIMEOUT) == 7


def test_the_wrapper_waits_for_a_busy_lock_a_bounded_time(tmp_path: Path) -> None:
    import fcntl

    root = repo(tmp_path)
    (root / "tests").mkdir()
    (root / "tests" / "test_a.py").write_text("def test_a():\n    pass\n")
    lock = root / ".private" / "work" / "factory" / "pytest.lock"
    lock.parent.mkdir(parents=True)
    env = {key: value for key, value in os.environ.items() if key != "DJANGO_SETTINGS_MODULE"}
    env["VEXTRUS_LENS_PYTEST_LOCK_WAIT"] = "1"
    with lock.open("a") as held:
        fcntl.flock(held, fcntl.LOCK_EX)
        done = subprocess.run(
            [sys.executable, str(WRAPPER), "-q", "tests/test_a.py"],
            cwd=root,
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
    assert done.returncode == 75, done.stderr
    assert "busy" in done.stderr


def test_the_wrapper_and_its_pytest_die_with_the_wrappers_parent(tmp_path: Path) -> None:
    """Finding 4: the lens process died and its test run lived on, holding the lock."""
    root, pid_file = hanging_repo(tmp_path)
    env = {key: value for key, value in os.environ.items() if key != "DJANGO_SETTINGS_MODULE"}
    parent = subprocess.Popen(
        [
            sys.executable,
            "-c",
            (
                "import subprocess, sys, time\n"
                f"subprocess.Popen([sys.executable, {str(WRAPPER)!r}, '-q', 'tests/test_hang.py'])\n"
                "time.sleep(600)\n"
            ),
        ],
        cwd=root,
        env=env,
    )
    pytest_pid = read_pid(pid_file)
    parent.kill()
    parent.wait()
    assert gone(pytest_pid), "the test run outlived the lens that started it"
    assert gone_lock(root)


def gone_lock(root: Path, seconds: float = 15) -> bool:
    import time

    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if lock_free(root):
            return True
        time.sleep(0.1)
    return False


def test_a_lens_leaving_a_process_behind_has_it_killed(tmp_path: Path) -> None:
    """Finding 4: only the claude process was stopped; what it started lived on."""
    pid_file = tmp_path / "left.pid"
    script = f"sleep 600 & echo $! > {pid_file}"
    done = review.run_group(["sh", "-c", script], cwd=tmp_path, env=dict(os.environ), timeout=60)
    assert done.returncode == 0
    assert gone(int(pid_file.read_text()))


def test_a_lens_past_its_limit_is_killed_with_everything_it_started(tmp_path: Path) -> None:
    pid_file = tmp_path / "left.pid"
    script = f"setsid sleep 600 & echo $! > {pid_file}; sleep 600"
    with pytest.raises(subprocess.TimeoutExpired):
        review.run_group(["sh", "-c", script], cwd=tmp_path, env=dict(os.environ), timeout=2)
    assert gone(int(pid_file.read_text()))


def test_a_hung_lens_is_refused_not_waited_for(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    pid_file = tmp_path / "child.pid"
    (bin_dir / "claude").write_text(f"#!/bin/sh\nsleep 600 &\necho $! > {pid_file}\nwait\n")
    (bin_dir / "claude").chmod(0o755)
    monkeypatch.setenv("PATH", f"{bin_dir}:/usr/bin:/bin")
    monkeypatch.setattr(review, "LENS_TIMEOUT", 1)
    with pytest.raises(review.Refused, match="ran past"):
        review.run_lens(review.LENS_B, "prompt", tmp_path, 1, tmp_path / "out.json", tmp_path)
    assert gone(int(pid_file.read_text())), "the hung lens's child outlived it"


def test_the_replays_lock_wait_is_bounded(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import fcntl

    root = repo(tmp_path)
    lock = root / ".private" / "work" / "factory" / "pytest.lock"
    lock.parent.mkdir(parents=True)
    monkeypatch.setattr(review, "LOCK_WAIT", 1)
    with lock.open("a") as held:
        fcntl.flock(held, fcntl.LOCK_EX)
        with pytest.raises(review.Refused, match="busy"):
            review.pytest_lock(root)
