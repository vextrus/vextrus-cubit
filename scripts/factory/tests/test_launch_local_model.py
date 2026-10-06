"""A tiered local launch hands over an explicit --model, so the agent file's model never decides it."""

from __future__ import annotations

from scripts.factory.launch import LocalRequest, launch_local

BASE = ["--ticket", "x1", "--branch", "s14-x", "--name", "x1", "--prompt-file", "p.md"]


def handed(*extra: str) -> list[str]:
    seen: list[list[str]] = []

    def local_run(request: LocalRequest) -> int:
        seen.append(request.to_argv())
        return 0

    assert launch_local([*BASE, *extra], local_run=local_run) == 0
    return seen[0]


def model_of(argv: list[str]) -> str:
    return argv[argv.index("--model") + 1]


def test_a_tiered_local_launch_hands_over_the_tiers_model() -> None:
    assert model_of(handed("--tier", "ordinary")) == "claude-sonnet-5-5"
    assert model_of(handed("--tier", "hard")) == "claude-opus-5-5"


def test_an_explicit_model_beats_the_tier() -> None:
    assert model_of(handed("--tier", "hard", "--model", "claude-sonnet-5-5")) == "claude-sonnet-5-5"


def test_the_builder_file_model_agrees_with_the_launchers_default() -> None:
    """A bare local launch takes the agent file's model; its record says MODEL. They must agree."""
    from pathlib import Path

    from scripts.factory.launch import MODEL

    root = Path(__file__).resolve().parents[3]
    front = (root / ".claude/agents/builder.md").read_text().split("---")[1]
    alias = next(ln.split(":", 1)[1].strip() for ln in front.splitlines() if ln.startswith("model:"))
    assert alias in MODEL, (alias, MODEL)
