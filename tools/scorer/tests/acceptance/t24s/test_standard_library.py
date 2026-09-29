"""Ticket 24s: "The scorer is a small standard-library Python program in the repository"
(docs/plans/M0.md, 24s), installed as root's file and run as the key user with
`#!/usr/bin/python3 -I` (session 06's ruling), so it can import nothing from the project's
environment but itself."""

import ast
import sys
from pathlib import Path

SCORER = Path(__file__).resolve().parents[3]  # tools/scorer


def test_the_scorer_imports_only_the_standard_library_and_itself() -> None:
    assert (SCORER / "score.py").is_file(), f"no scorer at {SCORER / 'score.py'}"
    sources = [p for p in SCORER.rglob("*.py") if "tests" not in p.relative_to(SCORER).parts]
    outside = []
    for source in sources:
        for node in ast.walk(ast.parse(source.read_text(), str(source))):
            names: list[str] = []
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                names = [node.module]
            for name in names:
                top = name.split(".")[0]
                own = name == "tools" or name.startswith("tools.scorer")
                if top not in sys.stdlib_module_names and not own:
                    outside.append(f"{source.relative_to(SCORER)}: {name}")
    assert not outside, outside
