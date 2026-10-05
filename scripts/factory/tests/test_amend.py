"""The amend command's units: argument parsing, the check plan and the message, with a fake `run`."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.factory import amend
from scripts.verify import Check
from tools.lint.acceptance import count_problems

PY = "a/tests/acceptance/t/test_x.py"
MJS = "a/tests/acceptance/t/x.test.mjs"
TS = "web/e2e/acceptance/t/x.spec.ts"


def test_the_counts_must_be_integers() -> None:
    with pytest.raises(SystemExit) as stop:
        amend.parse(["--subject", "s", "--red", "1", "--green", "x", PY])
    assert stop.value.code == 2
    args = amend.parse(["--subject", "s", "--red", "1", "--green", "2", PY, MJS])
    assert (args.red, args.green, args.paths, args.base) == (1, 2, [PY, MJS], None)


def test_the_plan_checks_python_by_explicit_path_and_node_checks_mjs() -> None:
    checks, unchecked = amend.plan([PY, MJS, TS])
    assert [(check.name, check.argv) for check in checks] == [
        ("ruff", ("uv", "run", "ruff", "check", PY)),
        ("ruff-format", ("uv", "run", "ruff", "format", "--check", PY)),
        ("mypy", ("uv", "run", "mypy", PY)),
        ("node", ("node", "--check", MJS)),
    ]
    assert unchecked == [TS]


def test_no_python_means_no_python_checks() -> None:
    assert amend.plan([TS]) == ([], [TS])


def test_the_message_carries_the_body_verbatim_and_the_counts_on_their_own_lines() -> None:
    text = amend.message("pin x", "Why.\n\nCo-Authored-By: A <a@example.com>\n", 2, 3)
    assert text == (
        "acceptance: pin x\n\nWhy.\n\nCo-Authored-By: A <a@example.com>\n\n"
        "red-on-main: 2 failed\ngreen-on-throwaway: 3 passed\n"
    )
    assert count_problems(text) == []
    assert amend.message("pin x", "", 1, 1) == (
        "acceptance: pin x\n\nred-on-main: 1 failed\ngreen-on-throwaway: 1 passed\n"
    )


def test_every_check_runs_after_a_failure_and_its_output_is_shown(
    capsys: pytest.CaptureFixture[str],
) -> None:
    seen: list[str] = []

    def run(check: Check, cwd: Path) -> tuple[int, str]:
        seen.append(check.name)
        return (1, "\n".join(f"line {n}" for n in range(60))) if check.name == "ruff" else (0, "")

    text = amend.message("pin x", "", 1, 1)
    assert not amend.check([PY, TS], text, run, Path("."))
    out = capsys.readouterr().out
    assert seen == ["ruff", "ruff-format", "mypy"]
    assert "amend: ruff 1" in out
    assert "amend: mypy 0" in out
    assert "line 39" in out
    assert "line 40" not in out
    assert f"amend: not checked: {TS}" in out


def test_bad_counts_are_reported_and_still_every_check_runs(capsys: pytest.CaptureFixture[str]) -> None:
    seen: list[str] = []

    def run(check: Check, cwd: Path) -> tuple[int, str]:
        seen.append(check.name)
        return 0, ""

    assert not amend.check([PY], amend.message("pin x", "", 2, 1), run, Path("."))
    assert len(seen) == 3
    assert "below red-on-main" in capsys.readouterr().out


@pytest.mark.parametrize("raw", ["a/tests/acceptance/*.py", ".", "a/../a/tests/acceptance/t/x.py"])
def test_globs_and_dots_are_refused_before_the_filesystem(raw: str, tmp_path: Path) -> None:
    with pytest.raises(amend.Refused) as refused:
        amend.acceptance_path(tmp_path, raw)
    assert refused.value.code == 2
