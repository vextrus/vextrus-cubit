"""S14-R3 (factory-next.md section 8, row 11; issue #368), "Replay gate and cutover": once the replay
passes, "delete `.claude/workflows/review-pr.js`, `review-pr-prechecked.js` and the `review-pr` skill",
checked by "a deletion lint: no `agent(` call mentions `ledger` and no workflow file but
`real-set-walk.js`" (and section 3: "every prompt that tells an agent to run `ledger`" is deleted).

The seam (named here, like its siblings `python -m tools.lint.workflows_js [root]`):

    python -m tools.lint.review_cutover [root]

It reads `<root>/.claude/workflows/` (root: the repository when not given) and exits 0 when the only
workflow script there is `real-set-walk.js` and no `agent(` call in it mentions `ledger`; otherwise it
exits non-zero and names the file. The fixture roots are git repositories with every file added, so a
lint reading the tree or reading what git tracks sees the same files.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[5]
WALK = "real-set-walk.js"

CLEAN_WALK = """export const meta = { name: 'real-set-walk', description: 'G1 walk' }

const served = await agent(
  [
    'Check that the walk folder holds walk.json and return its web and api values.',
    'Read nothing else from it.',
  ].join(' '),
  { label: 'walk.json', phase: 'Check', model: 'opus', effort: 'low' },
)
log('walked')
return { result: served }
"""

LEDGER_WALK = """export const meta = { name: 'real-set-walk', description: 'G1 walk' }

const served = await agent(
  [
    'Check that the walk folder holds walk.json and return its web and api values.',
    'Then run exactly: uv run python -m scripts.ledger record --from verdict.txt',
  ].join(' '),
  { label: 'walk.json', phase: 'Check', model: 'opus', effort: 'low' },
)
return { result: served }
"""


def root_with(tmp_path: Path, files: dict[str, str]) -> Path:
    """A repository root holding these workflow scripts under `.claude/workflows/`, all added to git."""
    root = tmp_path / "root"
    folder = root / ".claude" / "workflows"
    folder.mkdir(parents=True)
    for name, text in files.items():
        (folder / name).write_text(text)
    subprocess.run(["git", "init", "-q", "-b", "main", str(root)], check=True)
    subprocess.run(["git", "-C", str(root), "add", "."], check=True)
    return root


def lint(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "tools.lint.review_cutover", *args],
        cwd=REPO, env={**os.environ, "PYTHONPATH": str(REPO)},
        capture_output=True, text=True, check=False, timeout=300,
    )  # fmt: skip


def test_the_repository_passes_the_cutover_lint() -> None:
    done = lint(str(REPO))
    assert done.returncode == 0, done.stdout + done.stderr


def test_a_root_whose_only_workflow_is_the_real_set_walk_passes(tmp_path: Path) -> None:
    done = lint(str(root_with(tmp_path, {WALK: CLEAN_WALK})))
    assert done.returncode == 0, done.stdout + done.stderr


@pytest.mark.parametrize("name", ["review-pr.js", "review-pr-prechecked.js", "another-flow.js"])
def test_any_other_workflow_script_fails_the_lint_naming_it(tmp_path: Path, name: str) -> None:
    done = lint(str(root_with(tmp_path, {WALK: CLEAN_WALK, name: CLEAN_WALK})))
    assert done.returncode != 0, done.stdout + done.stderr
    assert name in done.stdout + done.stderr


def test_an_agent_call_whose_prompt_mentions_the_ledger_fails_the_lint(tmp_path: Path) -> None:
    done = lint(str(root_with(tmp_path, {WALK: LEDGER_WALK})))
    assert done.returncode != 0, done.stdout + done.stderr
    assert WALK in done.stdout + done.stderr
