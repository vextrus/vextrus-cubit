"""S14-D1 (factory-next.md section 8, row 17): "`orchestrate-wave/SKILL.md` runbook (right spellings,
command card)" and "CLAUDE.md rule text"; its acceptance check: "the docs-path lint".

The command card is `.claude/skills/orchestrate-wave/SKILL.md` and `commands.md` beside it, read
together. It names each session 14 command whose module is on the tree when the test runs: a card line
for a module not yet landed would fail `tools/lint/docs_paths.py` ("`python -m <module>` does not
exist"), so each pin applies from the moment its module exists (`scripts/factory/review.py`,
`state.py`, `recover.py`, `publish.py`; `scripts/land.py` is on main). The PR that lands one of those
modules then owes its card line. The parameter list always holds the `scripts.land update` pin, so it
is never empty.

`scripts.land update` is pinned as those words, not as `python -m scripts.land update`: the docs-path
lint reads a word after `python -m scripts.land` as a subcommand and refuses it while `scripts.land`'s
usage holds no `{...}` group (as on main today), so the builder chooses between rewording the line and
giving the usage that group. `scripts.land order` is not pinned: the acceptance test
`.claude/hooks/tests/acceptance/p6-docs-runbook.test.mjs` asserts that neither file says
`scripts.land order`, and an acceptance pin cannot overrule another.

CLAUDE.md (factory-next.md section 3, "Also edit"): once `scripts/factory/review.py` exists, "the 'Second
review lens' line (it names 'the adversary agent inside `/review-pr`') [names] `scripts.factory.review`;
and the launch bullet [says] reviews run through `scripts.factory.review run <PR>`".
"""

import os
import subprocess
import sys
from collections.abc import Callable

import pytest

from tools.lint.tests.acceptance.ts14d1._repo import REPO, flat, read

SKILL = ".claude/skills/orchestrate-wave/SKILL.md"
COMMANDS = ".claude/skills/orchestrate-wave/commands.md"


def card() -> str:
    return flat(read(SKILL) + "\n" + read(COMMANDS))


def claude_md() -> str:
    return flat(read("CLAUDE.md"))


# (the words, where they must stand, the module whose presence makes the pin apply)
PINS: list[tuple[str, str, Callable[[], str], str]] = [
    ("card", "python -m scripts.factory.review run", card, "scripts/factory/review.py"),
    ("card", "python -m scripts.factory.state", card, "scripts/factory/state.py"),
    ("card", "python -m scripts.factory.recover", card, "scripts/factory/recover.py"),
    ("card", "python -m scripts.factory.publish", card, "scripts/factory/publish.py"),
    ("card", "scripts.land update", card, "scripts/land.py"),
    ("CLAUDE.md", "scripts.factory.review run <PR>", claude_md, "scripts/factory/review.py"),
]

PRESENT = [
    pytest.param(words, where, id=f"{place}: {words}")
    for place, words, where, module in PINS
    if (REPO / module).is_file()
]


@pytest.mark.parametrize(("words", "where"), PRESENT)
def test_each_landed_command_is_named(words: str, where: Callable[[], str]) -> None:
    assert words in where(), f"`{words}` is not named"


def test_claude_md_no_longer_names_the_old_review_lens_once_review_py_exists() -> None:
    old = "the adversary agent inside `/review-pr`"
    if (REPO / "scripts/factory/review.py").is_file():
        assert old not in claude_md(), "CLAUDE.md still names the adversary agent inside /review-pr"
        assert "scripts.factory.review" in claude_md()
    else:
        # Until the module lands, CLAUDE.md names no review command that does not exist.
        assert "python -m scripts.factory.review" not in claude_md()


def test_the_docs_path_lint_passes_on_the_tree() -> None:
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    done = subprocess.run(
        [sys.executable, "-m", "tools.lint.docs_paths"],
        cwd=REPO,
        env=env,
        capture_output=True,
        text=True,
        timeout=600,
        check=False,
    )
    assert done.returncode == 0, f"exit {done.returncode}\n{done.stdout}\n{done.stderr}"
