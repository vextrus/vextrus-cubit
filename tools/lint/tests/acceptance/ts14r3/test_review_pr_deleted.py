"""S14-R3 (factory-next.md section 8, row 11; issue #368): "then delete `.claude/workflows/review-pr.js`,
`.claude/workflows/review-pr-prechecked.js` and the `review-pr` skill" (section 3: "Deleted when R3
passes: `.claude/workflows/review-pr.js`, `review-pr-prechecked.js`, the `review-pr` skill"). The
`/review-pr` command comes from a workflow script, a skill folder or a command file under `.claude/`;
after the cutover none of them is in the repository, and `real-set-walk.js` is the one workflow left.
"""

from pathlib import Path

REPO = Path(__file__).resolve().parents[5]
CLAUDE = REPO / ".claude"


def test_no_review_pr_workflow_skill_or_command_remains() -> None:
    left = sorted(
        str(path.relative_to(REPO))
        for path in [
            *CLAUDE.glob("workflows/review-pr*"),
            *CLAUDE.glob("skills/review-pr*"),
            *CLAUDE.glob("commands/review-pr*"),
        ]
    )
    assert left == []


def test_the_real_set_walk_is_the_only_workflow_script_left() -> None:
    scripts = sorted(path.name for path in (CLAUDE / "workflows").glob("*.js"))
    assert scripts == ["real-set-walk.js"]
