"""Ticket S15-T2 (issue #532): "the web flakes fixed not rerun (#245, #142)"; its check: "flaky list
empty".

`.github/flaky.txt` is the only list `scripts.land` reruns a red CI for (`land.flaky_list()`, read by the
CLI from the working folder), so with no entry in it a failed test is a red PR, never a rerun. The three
tests below were the list's entries on main (6 Oct 2026); a red CI naming any of them is refused and
nothing is rerun. The list may hold comments, or be gone.

Seams (existing): `scripts.land.flaky_list()` and `scripts.land.land(pr, gh, *, ledger_dir, flaky, ready,
repo)` with tf4's `gh` object.
"""

import json
from pathlib import Path

import pytest

from scripts import land

REPO = Path(__file__).resolve().parents[4]
HEAD = "0123456789abcdef0123456789abcdef01234567"
PR = 532
T16 = "web/src/acceptance/t16/viewer.test.tsx"
PLOT = "web/src/acceptance/tviewerplot/plot.test.tsx"
ACTS = "web/src/takeoff/acts.test.tsx"
ACTS_TITLE = (
    "says the 16 were confirmed and why the rest was not, offers Undo, and undoes only what was done"
)
ONCE_LISTED = [
    f"{T16} :: pans on a drag with the left button, by the distance dragged",
    f"{PLOT} :: cycles As read → Plot → Compare → As read on P",
    f"{ACTS} :: {ACTS_TITLE}",
]
IDS = ["t16-left-drag", "tviewerplot-p-cycle", "acts-bulk"]


class FakeGh:
    """CI red on `failed` at first; green after a rerun, so a rerun would land the PR."""

    def __init__(self, failed: str) -> None:
        self.calls: list[str] = []
        self.results = [[failed], []]

    def head_sha(self, pr: int) -> str:
        return HEAD

    def mark_ready(self, pr: int) -> None:
        self.calls.append("mark_ready")

    def update_branch(self, pr: int) -> None:
        self.calls.append("update_branch")

    def wait_ci(self, pr: int) -> list[str]:
        self.calls.append("wait_ci")
        return self.results.pop(0) if len(self.results) > 1 else self.results[0]

    def rerun_failed(self, pr: int) -> None:
        self.calls.append("rerun_failed")

    def merge(self, pr: int) -> None:
        self.calls.append("merge")

    def pull_main(self) -> None:
        self.calls.append("pull_main")


def reviewed(store: Path) -> None:
    """A ledger PASS for HEAD, as tf4's tests write it."""
    record = {
        "schema_version": 1,
        "pr": PR,
        "head": HEAD,
        "round": 1,
        "verdict": "PASS",
        "counts": {
            "reviewers": 2,
            "findings": 0,
            "findings_ge_50": 0,
            "confirmed": 0,
            "refuted": 0,
            "unproven": 0,
            "unrefuted_ge_50": 0,
        },
        "decision_input_sha256": "ab" * 32,
        "comment_id": 100,
        "exception": None,
        "source": "review-pr",
        "recorded_at": "2026-10-06T10:00:00Z",
    }
    store.mkdir()
    (store / f"{PR}-{HEAD}.json").write_text(json.dumps(record))


def test_the_flaky_list_names_no_test() -> None:
    path = REPO / ".github" / "flaky.txt"
    lines = path.read_text().splitlines() if path.is_file() else []
    entries = [line for line in lines if line.strip() and not line.lstrip().startswith("#")]
    assert entries == [], f"the flaky list still names tests: {entries}"


@pytest.mark.parametrize("failed", ONCE_LISTED, ids=IDS)
def test_a_red_ci_on_a_once_listed_flake_is_refused_and_never_rerun(
    failed: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    store = tmp_path / "ledger"
    reviewed(store)
    gh = FakeGh(failed)
    monkeypatch.chdir(REPO)  # the CLI reads the list from the working folder

    code = land.land(PR, gh, ledger_dir=store, flaky=land.flaky_list(), ready=lambda _: 0, repo=REPO)

    out = capsys.readouterr().out
    assert "rerun_failed" not in gh.calls, f"a failed {failed!r} was rerun: {gh.calls}"
    assert code == 3, out
    assert "merge" not in gh.calls
    assert f"land: refused: PR {PR}" in out
