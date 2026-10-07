"""Ticket S17-F5: the contract lint runs where a fixture can change. The brief: "run in CI's lint step
and by verify for web/** and acceptance changes".

Seams: `scripts.verify.plan(paths, have=..., root=...)` (the checks for the changed paths, each a
`Check` with its `argv`), and the workflows under `.github/workflows/`.
"""

import re
from pathlib import Path

import pytest

from scripts.verify import plan

ROOT = Path(__file__).resolve().parents[5]
LINT = "tools.lint.contract_fixtures"


@pytest.mark.parametrize(
    "changed",
    [
        "web/src/takeoff/data.ts",
        "web/src/acceptance/t9/proposals.test.tsx",
        "vextrus/takeoff/tests/acceptance/t9/test_proposals.py",
        "scripts/tests/acceptance/t9/replies.json",
    ],
)
def test_verify_runs_the_contract_lint_for_web_and_acceptance_changes(
    changed: str, tmp_path: Path
) -> None:
    checks = plan([changed], have=lambda tool: True, root=tmp_path)
    commands = [" ".join(check.argv) for check in checks]
    assert any("contract_fixtures" in command for command in commands), (
        f"verify's plan for {changed} runs no {LINT}: {commands}"
    )


def test_ci_runs_the_contract_lint() -> None:
    lines = [
        f"{workflow.name}: {line.strip()}"
        for workflow in sorted((ROOT / ".github" / "workflows").glob("*.yml"))
        for line in workflow.read_text().splitlines()
        if not line.lstrip().startswith("#") and re.search(rf"-m {re.escape(LINT)}\b", line)
    ]
    assert lines, f"no workflow under .github/workflows runs `python -m {LINT}`"
