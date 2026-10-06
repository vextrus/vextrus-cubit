"""S14-R2: every command a review process is told or allowed to run passes the guard where it runs
(factory-next.md 7: "#342 (workflow commands vs the guard) becomes the `--allowedTools` test in R2";
issue #342: "a test ... that renders each command template the workflow tells an agent to 'run
exactly' and asks the guard about it").

- The batched refuter is never allowed all of Bash, and each Bash command its `--allowedTools` names
  passes the guard (`.claude/hooks/guard.mjs`, fed a PreToolUse event as Claude Code does) in the
  directory it runs in.
- Each command a lens's or the refuter's prompt quotes in backticks (its placeholders rendered as a
  test file) passes the guard where that process runs and is covered by one of its allowed Bash
  entries."""

import json
import os
import re
import subprocess
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

from scripts.tests.acceptance.ts14r2._world import (
    NORMAL,
    REPO,
    SMALL,
    World,
    fresh,
    item,
    node,
    review_reply,
    why,
)


@pytest.fixture
def world(tmp_path_factory: pytest.TempPathFactory) -> Iterator[World]:
    yield from fresh(tmp_path_factory)


GUARD = REPO / ".claude" / "hooks" / "guard.mjs"
COMMAND = re.compile(r"`((?:uv|git|python|python3|pytest|node|npm|npx|pnpm) [^`]*)`")
NO_REPRO = item(60, 1, "the badge shows the count of another Project", None)


def allowed_tools(argv: list[str]) -> list[str]:
    """The `--allowedTools` entries, split on commas and spaces outside parentheses."""
    raw: list[str] = []
    for index, part in enumerate(argv):
        if part in ("--allowedTools", "--allowed-tools"):
            for value in argv[index + 1 :]:
                if value.startswith("-"):
                    break
                raw.append(value)
        elif part.startswith(("--allowedTools=", "--allowed-tools=")):
            raw.append(part.split("=", 1)[1])
    entries: list[str] = []
    for text in raw:
        depth, current = 0, ""
        for char in text:
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
            if depth == 0 and char in ", ":
                if current.strip():
                    entries.append(current.strip())
                current = ""
            else:
                current += char
        if current.strip():
            entries.append(current.strip())
    return entries


def bash_prefixes(entries: list[str]) -> list[str]:
    found = []
    for entry in entries:
        matched = re.fullmatch(r"Bash\((.*)\)", entry, re.DOTALL)
        if matched:
            found.append(re.sub(r"(?::\*|\s\*|\*)$", "", matched[1]).strip())
    return found


def guard(command: str, where: Path) -> str | None:
    """The rule the guard refuses `command` by, run in `where` by a session of `where`, or None."""
    env = {key: value for key, value in os.environ.items() if key not in ("CLAUDE_CODE_REMOTE",)}
    env["CLAUDE_PROJECT_DIR"] = str(where)
    event = {"tool_name": "Bash", "tool_input": {"command": command}, "cwd": str(where)}
    done = subprocess.run(
        [node(), str(GUARD)],
        input=json.dumps(event),
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    assert done.returncode == 0, done.stderr
    if not done.stdout.strip():
        return None
    out = json.loads(done.stdout)["hookSpecificOutput"]
    assert out["permissionDecision"] == "deny"
    reason: str = out["permissionDecisionReason"]
    return reason.split(":")[0]


def quoted_commands(call: dict[str, Any]) -> list[str]:
    rendered = []
    for command in COMMAND.findall(call["stdin"]):
        rendered.append(re.sub(r"<[^<>]+>", "tests/test_attack.py", command).strip())
    return rendered


def test_the_refuter_s_allowed_commands_pass_the_guard_where_it_runs(world: World) -> None:
    world.pr(12, SMALL)
    world.lenses(review_reply("FIX", [NO_REPRO]))
    done = world.run("12", "--round", "1")
    calls = [call for call in world.claude_calls() if call["agent"] == "refuter"]
    assert len(calls) == 1, f"{len(calls)} refuter processes; {why(done)}"
    entries = allowed_tools(calls[0]["argv"])
    assert not [e for e in entries if e in ("Bash", "Bash(*)", "Bash(:*)")], (
        "the refuter may run all of Bash"
    )
    where = Path(calls[0]["cwd"])
    for command in bash_prefixes(entries):
        refused = guard(command, where)
        assert refused is None, f"the guard refuses {command!r} in {where.name}: {refused}"


def test_every_command_a_prompt_quotes_passes_the_guard_and_is_allowed(world: World) -> None:
    world.pr(12, NORMAL)
    world.lenses(review_reply("FIX", [NO_REPRO]))
    done = world.run("12", "--round", "1")
    calls = world.claude_calls()
    assert calls, f"no claude process was started; {why(done)}"
    for call in calls:
        where = Path(call["cwd"])
        prefixes = bash_prefixes(allowed_tools(call["argv"]))
        for command in quoted_commands(call):
            refused = guard(command, where)
            assert refused is None, (
                f"{call['agent']} is told to run {command!r}; the guard refuses it in {where.name}: "
                f"{refused}"
            )
            assert any(command == p or command.startswith(p + " ") for p in prefixes), (
                f"{call['agent']} is told to run {command!r}, which no --allowedTools entry allows"
            )
