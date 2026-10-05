"""S14-R1: what a lens is given (factory-next.md 8 row 4: "no prompt file mentions `ledger`; every
--allowedTools command passes the guard in rv<N> and is refused in slotN"; research/review.md 3 step 6:
"No agent ever sees the ledger path"; issue #452).

- No `claude` call's prompt (its arguments, its stdin and every file its arguments name) mentions the
  ledger, and neither does the agent file (`.claude/agents/<name>.md`) it is started with.
- The lenses' `--allowedTools` name exact commands, never all of Bash, and include a test run. The guard
  (`.claude/hooks/guard.mjs`, fed a PreToolUse event on stdin as Claude Code does) lets every allowed
  Bash command through in the lens's `rv<N>`, and refuses each one that runs code (pytest, python, node,
  a package script or a shell) in the read-only `slot<N>`. Reading commands (git diff, git log) stay
  allowed in the slot: the slot is read, never run in."""

import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any

import pytest

from scripts.tests.acceptance.ts14r1._world import REPO, World, node, why

NORMAL = {"vextrus/rates/table.py": "".join(f"RATE_{i}: int = {i}\n" for i in range(600))}
WORDS = NORMAL | {"web/src/messages/rates.ts": "export const rates = { title: 'Rates' }\n"}
RUNS_CODE = re.compile(
    r"(?:^|[\s/])(?:pytest|python[0-9.]*|node|npm|npx|pnpm|yarn|vitest|make|bash|sh)(?:\s|$)"
)
GUARD = REPO / ".claude" / "hooks" / "guard.mjs"


def prompt_text(call: dict[str, Any]) -> str:
    return "\n".join([*call["argv"], call["stdin"], *call["files"].values()])


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


def bash_commands(entries: list[str]) -> list[str]:
    found = []
    for entry in entries:
        matched = re.fullmatch(r"Bash\((.*)\)", entry, re.DOTALL)
        if matched:
            found.append(re.sub(r"(?::\*|\s\*|\*)$", "", matched[1]).strip())
    return found


def guard(command: str, where: Path, project: Path) -> str | None:
    """The rule the guard refuses `command` by, run in `where` by a session of `project`, or None."""
    env = {key: value for key, value in os.environ.items() if key not in ("CLAUDE_CODE_REMOTE",)}
    env["CLAUDE_PROJECT_DIR"] = str(project)
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


def test_no_prompt_a_lens_is_given_mentions_the_ledger(tmp_path_factory: pytest.TempPathFactory) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    world.pr(12, WORDS)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    calls = world.claude_calls()
    assert calls, "no lens was started"
    for call in calls:
        assert "ledger" not in prompt_text(call).lower(), (
            f"the {call['agent']} prompt mentions the ledger"
        )


def test_no_agent_a_lens_is_started_with_mentions_the_ledger(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    world.pr(12, WORDS)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    agents = {call["agent"] for call in world.claude_calls() if call["agent"]}
    assert agents, "no lens was started with --agent"
    for agent in sorted(agents):
        path = REPO / ".claude" / "agents" / f"{agent}.md"
        assert path.is_file(), f"--agent {agent} names no agent file"
        assert "ledger" not in path.read_text().lower(), f".claude/agents/{agent}.md mentions the ledger"


def test_every_allowed_command_passes_the_guard_in_rv_and_runners_are_refused_in_the_slot(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    world.pr(12, NORMAL)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    calls = world.lens_calls()
    assert calls, "no lens was started"
    for call in calls:
        assert call["slot"] is not None, f"the lens ran outside rv<N>: {call['cwd']}"
        rv = Path(call["cwd"])
        slot = Path(call["slot"]["path"])
        entries = allowed_tools(call["argv"])
        assert entries, "the lens was started with no --allowedTools"
        assert not [e for e in entries if e in ("Bash", "Bash(*)", "Bash(:*)")], (
            "a lens is allowed all of Bash"
        )
        commands = bash_commands(entries)
        assert [c for c in commands if "pytest" in c], (
            f"no test run among the allowed commands: {commands}"
        )
        for command in commands:
            refused = guard(command, rv, rv)
            assert refused is None, f"the guard refuses {command!r} in {rv.name}: {refused}"
            if RUNS_CODE.search(command):
                assert guard(command, slot, rv) is not None, (
                    f"the guard lets {command!r} run in {slot.name}"
                )
