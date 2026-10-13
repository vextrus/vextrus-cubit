"""verify plans CI's harness node command for every path those node tests can read (S26-FX10).

The defect (session 26): S26-FX2 changed `.claude/skills/orchestrate-wave/SKILL.md`; verify planned no
node test (it ran `.claude/hooks/**/*.test.mjs` only, and only for a `.claude/hooks/` change), while CI's
harness job ran three globs and failed the runbook acceptance test that reads SKILL.md. The ruling:
verify runs exactly CI's harness node command whenever any changed path is under `.claude/`,
`scripts/`, `tools/mod/`, `.github/` or `docs/`; a committed check keeps the two equal.

The seam: `scripts.verify.plan(paths, have=..., root=...)`, the Checks verify would run; the node-test
Check is the one whose argv begins `node --test`. CI's command is read from
`.github/workflows/ci.yml`'s `harness` job (the one `run: node --test ...` step), never restated here.
"""

import shlex
from pathlib import Path

import pytest

from scripts.verify import Check, plan

REPO = Path(__file__).resolve().parents[4]
CI = REPO / ".github" / "workflows" / "ci.yml"
NO_NODE = "verify plans no node-test Check"
DRIFT = "verify's node-test command differs from ci.yml's harness step"


def ci_node_command() -> tuple[str, ...]:
    """The argv of the one `node --test` step in ci.yml's `harness` job."""
    lines = CI.read_text().splitlines()
    start = lines.index("  harness:")
    end = next(
        (
            i
            for i in range(start + 1, len(lines))
            if lines[i].startswith("  ") and lines[i][2:3].isalpha()
        ),
        len(lines),
    )
    commands = [
        shlex.split(line.strip().removeprefix("- ").removeprefix("run:").strip())
        for line in lines[start:end]
        if line.strip().removeprefix("- ").startswith("run: node --test")
    ]
    assert len(commands) == 1, f"ci.yml's harness job has {len(commands)} `node --test` steps, not one"
    return tuple(commands[0])


def node_checks(paths: list[str], tmp_path: Path) -> list[Check]:
    checks = plan(paths, have=lambda tool: False, root=tmp_path)
    return [c for c in checks if tuple(c.argv[:2]) == ("node", "--test")]


def test_verifys_node_globs_equal_ci_harness_globs(tmp_path: Path) -> None:
    """The committed check against drift: the node-test Check verify plans is ci.yml's harness
    `node --test` step, token for token (the same globs, in its order)."""
    [check] = node_checks([".claude/hooks/guard.mjs"], tmp_path)
    assert tuple(check.argv) == ci_node_command(), f"{DRIFT}: {check.argv}"


@pytest.mark.parametrize(
    "path",
    [
        ".claude/skills/orchestrate-wave/SKILL.md",
        ".claude/skills/x/SKILL.md",
        ".claude/hooks/guard.mjs",
        ".claude/agents/acceptance-writer.md",
        "scripts/factory/launch.py",
        "scripts/verify.py",
        "tools/mod/factory/hooks/x.mjs",
        "tools/mod/README.md",
        ".github/workflows/ci.yml",
        "docs/specs/factory.md",
        "docs/handoff/session-26-prompt.md",
    ],
)
def test_a_change_node_tests_can_read_plans_cis_node_command(path: str, tmp_path: Path) -> None:
    checks = node_checks([path], tmp_path)
    assert checks, f"{NO_NODE} for {path}"
    [check] = checks
    assert tuple(check.argv) == ci_node_command(), f"{DRIFT}: {check.argv}"


def test_several_such_changes_plan_the_node_command_once(tmp_path: Path) -> None:
    paths = [
        ".claude/skills/x/SKILL.md",
        "scripts/factory/launch.py",
        "docs/sdlc.md",
        "tools/mod/a/b/c.mjs",
    ]
    checks = node_checks(paths, tmp_path)
    assert checks, NO_NODE
    assert len(checks) == 1
    assert tuple(checks[0].argv) == ci_node_command(), f"{DRIFT}: {checks[0].argv}"


@pytest.mark.parametrize(
    "path",
    ["vextrus/takeoff/models.py", "vextrus/takeoff/tests/acceptance/t1/test_x.py"],
)
def test_a_pure_vextrus_change_plans_no_node_tests(path: str, tmp_path: Path) -> None:
    assert node_checks([path], tmp_path) == []
