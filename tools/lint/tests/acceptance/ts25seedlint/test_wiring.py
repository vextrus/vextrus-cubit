"""Ticket S25-SEEDLINT (#762): CI runs the seed-figure lint, as it runs the design-docs and words lints
(the brief: "run by CI's docs/design job like the others"; which job is the builder's choice).
"""

import re

from .support import MODULE, ROOT


def test_ci_runs_the_seed_figure_lint() -> None:
    lines = [
        f"{workflow.name}: {line.strip()}"
        for workflow in sorted((ROOT / ".github" / "workflows").glob("*.yml"))
        for line in workflow.read_text().splitlines()
        if not line.lstrip().startswith("#") and re.search(rf"-m {re.escape(MODULE)}\b", line)
    ]
    assert lines, f"no workflow under .github/workflows runs `python -m {MODULE}`"
