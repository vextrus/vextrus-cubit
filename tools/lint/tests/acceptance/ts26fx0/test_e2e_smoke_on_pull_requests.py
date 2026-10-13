"""S26-FX0: `.github/workflows/e2e.yml`'s `smoke` check reports on every pull request.

The authority: the session 26 brief (docs/handoff/session-26-prompt.md, "The factory fixes", FX0+FX5):
"e2e runs on PRs (a product-path PR runs `smoke`; any other PR gets `smoke` reported passing, as
`real-drawings-na.yml` does for its check)"; the product paths are "the same list as
scripts/walk/ready.py:43-44": `vextrus/`, `engine/`, `web/src/`, `pyproject.toml`, `uv.lock`. The
owner's Q-R6: "e2e becomes required once it runs on PRs (FX0)"; so `smoke` must report on every PR,
or as a required check it holds the PR.

Either way of reporting "passing" without running is accepted: e2e.yml's `smoke` job skipped by its
`if:` (GitHub reports a skipped job's check as passing), or e2e.yml left untriggered by a path filter
and real-drawings-na.yml posting a `smoke` status of success. A product-path PR must run the job, and
must not also get a `smoke` success posted for it (that would hide a failing smoke test).

The runs are simulated offline (`_runs.py`): no network, no GitHub.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from tools.lint.tests.acceptance.ts26fx0._runs import e2e_smoke, posted, real_drawings_na

NOT_ON_PRS = "e2e.yml runs no smoke on this pull request"
NOT_REPORTED = "smoke is not reported passing on this pull request"


@pytest.mark.parametrize(
    "files",
    [
        ["vextrus/boq/models.py"],
        ["engine/read/anchor.py"],
        ["web/src/main.tsx"],
        ["pyproject.toml"],
        ["uv.lock"],
        ["docs/plans/M0.md", "engine/read/anchor.py"],
    ],
    ids=["vextrus", "engine", "web-src", "pyproject", "uv-lock", "docs-and-engine"],
)
def test_a_pr_changing_a_product_path_runs_smoke(files: list[str], tmp_path: Path) -> None:
    assert e2e_smoke(files, tmp_path) == "runs", f"{NOT_ON_PRS}: {files}"


@pytest.mark.parametrize(
    "files",
    [["vextrus/boq/models.py"], ["pyproject.toml"], ["web/src/acceptance/t99/x.test.tsx"]],
    ids=["vextrus", "pyproject", "web-src-test"],
)
def test_a_product_path_pr_gets_no_smoke_posted_for_it(files: list[str], tmp_path: Path) -> None:
    # A posted success would stand beside (or for) the real run: the smoke test's failure unseen.
    assert e2e_smoke(files, tmp_path / "e2e") == "runs", f"{NOT_ON_PRS}: {files}"
    statuses = real_drawings_na(files, tmp_path / "na")
    assert [s for s in posted(statuses, "smoke") if s.get("state") == "success"] == []


@pytest.mark.parametrize(
    "files",
    [
        ["docs/plans/M0.md"],
        ["scripts/factory/launch.py"],
        ["tools/lint/workflows.py", "CLAUDE.md"],
        [".claude/agents/builder.md", "CONTEXT.md"],
        ["docs/engine/read.md", "tools/lint/uv.lock", "scripts/vextrus.md"],
    ],
    ids=["docs", "scripts", "tools-and-claude-md", "agents-and-context", "near-misses"],
)
def test_a_pr_changing_no_product_path_gets_smoke_reported_passing(
    files: list[str], tmp_path: Path
) -> None:
    e2e = e2e_smoke(files, tmp_path / "e2e")
    assert e2e != "runs", f"smoke runs on a PR changing no product path: {files}"
    if e2e == "skipped":
        return  # GitHub reports a job skipped by its `if:` as passing.
    statuses = posted(real_drawings_na(files, tmp_path / "na"), "smoke")
    assert [s.get("state") for s in statuses] == ["success"], f"{NOT_REPORTED}: {files}"
