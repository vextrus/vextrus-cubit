"""`pr` asks `gh pr view --json` only for fields gh knows (S21-MR).

The acceptance stub answers every field whatever is asked, so it cannot catch a field gh lacks: the
first build asked for `baseRefOid`, real gh exited 1 ("Unknown JSON field") and PR 641 could not be
scanned. The list below is gh's own (its "Available fields" for `gh pr view --json`)."""

from tools.leakscan.scan import PR_VIEW_FIELDS

GH_PR_VIEW_FIELDS = frozenset(
    """additions assignees author autoMergeRequest baseRefName body changedFiles closed closedAt
    comments commits createdAt deletions files headRefName headRefOid headRepository
    headRepositoryOwner id isCrossRepository isDraft labels latestReviews maintainerCanModify
    mergeCommit mergeStateStatus mergeable mergedAt mergedBy milestone number potentialMergeCommit
    projectCards projectItems reactionGroups reviewDecision reviewRequests reviews state
    statusCheckRollup title updatedAt url""".split()
)


def test_every_field_pr_asks_gh_pr_view_for_is_one_gh_knows() -> None:
    assert set(PR_VIEW_FIELDS) <= GH_PR_VIEW_FIELDS, set(PR_VIEW_FIELDS) - GH_PR_VIEW_FIELDS


def test_the_head_and_base_shas_are_not_asked_of_gh_pr_view() -> None:
    """gh has no `baseRefOid`; both shas come from the REST pull, read once, so they agree."""
    assert "baseRefOid" not in PR_VIEW_FIELDS
