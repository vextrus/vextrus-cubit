"""The cloud launch's judge: a bundled session is never taken for a cloned one (sessions 05 and 06)."""

from scripts.cloud.launch import judge

REPO = "github.com/vextrus/vextrus-cubit"

# Shapes of the CLI's own debug lines, as read on 29 Sep 2026 (timestamps dropped).
BUNDLED = """
[DEBUG] Checking GitHub app installation for vextrus/vextrus-cubit
[DEBUG] GitHub app is not installed on vextrus/vextrus-cubit (status is null)
[DEBUG] [teleport] phase: bundle-upload
[DEBUG] [teleportToRemote] Bundling (reason: github_preflight_failed)
[DEBUG] Successfully created remote session: session_01Bundled
"""


def cloned(revision: str, repo: str = REPO, created: bool = True) -> str:
    return (
        "[DEBUG] GitHub app is installed on vextrus/vextrus-cubit\n"
        f"[DEBUG] [teleportToRemote] Git source: {repo}, revision: {revision}\n"
        + ("[DEBUG] Successfully created remote session: session_01Cloned\n" if created else "")
    )


def test_a_bundled_launch_is_refused_and_names_its_session_for_deletion() -> None:
    v = judge(BUNDLED, repository=REPO, branch="19a-takeoff-step1")
    assert not v.ok
    assert "bundled" in v.reason
    assert "github_preflight_failed" in v.reason
    assert v.session == "session_01Bundled"


def test_a_launch_cloned_at_the_tickets_branch_passes() -> None:
    v = judge(cloned("19a-takeoff-step1"), repository=REPO, branch="19a-takeoff-step1")
    assert v.ok
    assert v.session == "session_01Cloned"


def test_a_launch_cloned_at_main_instead_of_the_ticket_branch_is_refused() -> None:
    v = judge(cloned("main"), repository=REPO, branch="19a-takeoff-step1")
    assert not v.ok
    assert "main" in v.reason


def test_a_launch_of_another_repository_is_refused() -> None:
    assert not judge(cloned("x", repo="github.com/vextrus/vextrus"), repository=REPO, branch="x").ok


def test_a_log_with_no_git_source_is_refused_rather_than_trusted() -> None:
    log = "[DEBUG] Successfully created remote session: session_01X\n"
    assert not judge(log, repository=REPO, branch="x").ok


def test_a_clone_with_no_session_created_is_refused() -> None:
    assert not judge(cloned("x", created=False), repository=REPO, branch="x").ok
