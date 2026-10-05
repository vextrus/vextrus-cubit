"""Ticket T-LAUNCH, addendum 1 (found live at 03:42Z on 5 Oct 2026): the CLI writes the prompt into
its debug log, inside one `Creating session with payload: {...}` line. `judge()` must read the
session id, the environment and the git source only from the CLI's own lines (each pattern at the
start of a line's message, after `<ISO> [DEBUG] `), never from text quoted in the payload; a quoted
Bundling line refuses nothing; and two different CLI-own `Successfully created` lines are ambiguous.
"""

from __future__ import annotations

import json

import pytest

from scripts.factory.launch import judge

REPOSITORY = "github.com/vextrus/vextrus-cubit"
BRANCH = "s12-p6-launch"
REAL = "session_01Real"


def own(message: str, second: int = 1) -> str:
    """One CLI-own line, in the CLI's `<ISO> [DEBUG] <message>` form."""
    return f"2026-10-05T03:42:{second:02d}.123Z [DEBUG] {message}"


def payload(*quoted: str) -> str:
    """The CLI's payload line, the prompt (which quotes `quoted`) inside its JSON."""
    # Each quoted line ends in a space, as prose quoting it would, so no value runs into the JSON.
    prompt = "Follow the ticket. It quotes:\n" + "".join(f"{q} (quoted)\n" for q in quoted)
    body = json.dumps({"events": [{"type": "user", "message": {"content": prompt}}]})
    return own(f"Creating session with payload: {body}", 0)


# Every pattern the judge reads, quoted with wrong values; one also in the CLI's own full form.
WRONG = (
    "Successfully created remote session: session_01Quoted",
    own("Successfully created remote session: session_01Forged", 9),
    "[teleportToRemote] Git source: github.com/someone/fork, revision: wrong-branch",
    "Selected environment: env_01bad (other, anthropic_cloud)",
    "Configured default environment env_01gone not found, using first available",
    "[teleportToRemote] Bundling (reason: quoted)",
)


def cli_lines(
    *,
    environment: str = "vextrus",
    revision: str = BRANCH,
    sessions: tuple[str, ...] = (REAL,),
) -> list[str]:
    lines = [
        own(f"Selected environment: env_01good ({environment}, anthropic_cloud)", 1),
        own("GitHub app is installed on vextrus/vextrus-cubit", 2),
        own(f"[teleportToRemote] Git source: {REPOSITORY}, revision: {revision}", 3),
    ]
    lines += [own(f"Successfully created remote session: {s}", 5 + n) for n, s in enumerate(sessions)]
    return lines


def log(quoted: tuple[str, ...], cli: list[str], *, payload_first: bool) -> str:
    lines = [payload(*quoted), *cli] if payload_first else [*cli, payload(*quoted)]
    return "\n".join(lines) + "\n"


@pytest.mark.parametrize("payload_first", [True, False])
def test_the_ids_come_only_from_the_clis_own_lines(payload_first: bool) -> None:
    verdict = judge(
        log(WRONG, cli_lines(), payload_first=payload_first), repository=REPOSITORY, branch=BRANCH
    )
    assert verdict.ok, verdict
    assert verdict.session == REAL
    assert verdict.code == "ok"


@pytest.mark.parametrize("payload_first", [True, False])
def test_a_quoted_bundling_line_refuses_nothing(payload_first: bool) -> None:
    quoted = ("[teleportToRemote] Bundling (reason: github_preflight_failed)",)
    verdict = judge(
        log(quoted, cli_lines(), payload_first=payload_first), repository=REPOSITORY, branch=BRANCH
    )
    assert verdict.ok, verdict
    assert verdict.session == REAL


@pytest.mark.parametrize("payload_first", [True, False])
def test_a_quoted_git_source_cannot_pass_a_launch_cloned_at_the_wrong_branch(
    payload_first: bool,
) -> None:
    quoted = (f"[teleportToRemote] Git source: {REPOSITORY}, revision: {BRANCH}",)
    cli = cli_lines(revision="main")
    verdict = judge(log(quoted, cli, payload_first=payload_first), repository=REPOSITORY, branch=BRANCH)
    assert not verdict.ok
    assert verdict.code == "wrong-revision"
    assert verdict.session == REAL


@pytest.mark.parametrize("payload_first", [True, False])
def test_a_quoted_environment_line_does_not_choose_the_environment(payload_first: bool) -> None:
    quoted = ("Selected environment: env_01good (vextrus, anthropic_cloud)",)
    cli = cli_lines(environment="other")
    verdict = judge(log(quoted, cli, payload_first=payload_first), repository=REPOSITORY, branch=BRANCH)
    assert not verdict.ok
    assert verdict.code == "wrong-environment"


@pytest.mark.parametrize("payload_first", [True, False])
def test_a_quoted_session_line_is_not_the_session(payload_first: bool) -> None:
    quoted = ("Successfully created remote session: session_01Late",)
    cli = cli_lines(sessions=())
    verdict = judge(log(quoted, cli, payload_first=payload_first), repository=REPOSITORY, branch=BRANCH)
    assert not verdict.ok
    assert verdict.session is None
    assert verdict.code == "no-session"


def test_two_different_cli_own_session_lines_are_refused_as_ambiguous() -> None:
    cli = cli_lines(sessions=(REAL, "session_01Other"))
    verdict = judge(log((), cli, payload_first=True), repository=REPOSITORY, branch=BRANCH)
    assert not verdict.ok, verdict
    assert verdict.code != "ok"


def test_the_same_cli_own_session_line_twice_is_one_session() -> None:
    cli = cli_lines(sessions=(REAL, REAL))
    verdict = judge(log((), cli, payload_first=True), repository=REPOSITORY, branch=BRANCH)
    assert verdict.ok, verdict
    assert verdict.session == REAL
