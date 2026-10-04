"""Ticket f1, section 3 E: `python -m scripts.factory.launch local ...` is parsed here and run by f3's
`scripts/factory/local.py` (docs/specs/factory/contracts/launch-cli.md 1 and 4; the ticket's 4.2:
`parse_local(argv) -> LocalRequest` with `to_argv()`, and `launch_local(argv, *, local_run)`).
"""

from __future__ import annotations

import sys
import types
from collections.abc import Callable
from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from scripts.factory.launch import LocalRequest

ARGV = [
    "--ticket",
    "f2",
    "--branch",
    "s12-f2-walls",
    "--effort",
    "high",
    "--name",
    "f2",
    "--prompt-file",
    "p.md",
    "--budget-minutes",
    "120",
]


def launched(argv: list[str], local_run: Callable[[LocalRequest], int] | None = None) -> int:
    from scripts.factory.launch import launch_local

    try:
        return launch_local(argv) if local_run is None else launch_local(argv, local_run=local_run)
    except SystemExit as stopped:
        return stopped.code if isinstance(stopped.code, int) else 1


def pairs(argv: list[str]) -> dict[str, str]:
    assert len(argv) % 2 == 0, argv
    return dict(zip(argv[::2], argv[1::2], strict=True))


def test_e1_the_local_arguments_are_parsed_and_handed_to_the_local_runner() -> None:
    from scripts.factory.launch import LocalRequest, parse_local

    request = parse_local(ARGV)
    assert isinstance(request, LocalRequest)
    assert request.ticket == "f2"
    assert request.branch == "s12-f2-walls"
    assert request.effort == "high"
    assert request.name == "f2"
    assert str(request.prompt_file) == "p.md"
    assert request.budget_minutes == 120

    seen: list[LocalRequest] = []

    def local_run(given: LocalRequest) -> int:
        seen.append(given)
        return 7

    assert launched(ARGV, local_run=local_run) == 7
    assert seen == [request]


def test_e2_no_local_launcher_is_an_error_a_missing_argument_is_usage_and_the_default_calls_f3s_main(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    import scripts.factory

    monkeypatch.delattr(scripts.factory, "local", raising=False)
    monkeypatch.setitem(sys.modules, "scripts.factory.local", None)
    assert launched(ARGV) == 1
    assert "ERROR local launcher not merged (f3)" in capsys.readouterr().out

    assert launched(["--ticket", "f2", "--branch", "s12-f2-walls", "--effort", "high"]) == 64

    given: list[list[str]] = []

    def local_main(argv: list[str] | None = None) -> int:
        assert argv is not None
        given.append(list(argv))
        return 5

    fake = types.ModuleType("scripts.factory.local")
    fake.__dict__["main"] = local_main
    monkeypatch.setitem(sys.modules, "scripts.factory.local", fake)
    monkeypatch.setattr(scripts.factory, "local", fake, raising=False)
    assert launched(ARGV) == 5
    assert len(given) == 1
    assert pairs(given[0]) == pairs(ARGV)
