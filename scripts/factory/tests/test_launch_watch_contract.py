"""The cloud launcher's record is read by the watcher.

On 5 Oct 2026 every record `scripts.factory.launch cloud` wrote carried `started_at` with microseconds
(`isoformat()`), which `status.parse_utc` refused, so the watcher skipped every launched builder as an
"unreadable launch record" and tracked none: no PUSH, READY or BLOCKED event, `builders.items` empty.
Each side was tested only against its own fake record. This test writes a record through the
launcher's own `_Run.write` and reads it back through the watcher's own `load_launches`.
"""

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from scripts.factory import launch, status, watch

STARTED = datetime(2026, 10, 5, 3, 42, 44, 196170, tzinfo=UTC)


SINCE = datetime(2026, 10, 5, tzinfo=UTC)


def launched(
    folder: Path, ticket: str, branch: str, *, role: str = "builder", ok: bool = True, minutes: int = 0
) -> None:
    """One record, written by the cloud launcher's own `_Run.write`."""
    request = launch.CloudRequest(
        branch=branch, prompt_file=folder / "p.md", ticket=ticket, effort="medium", role=role
    )
    started = STARTED + timedelta(minutes=minutes)
    run = launch._Run(
        req=request, record_dir=folder / "launches", started=started, snapshot=lambda: "[]"
    )
    session = "session_01Abc" if ok else None
    run.write(launch.Verdict(ok=ok, reason=f"cloned at {branch}" if ok else "refused", session=session))


def test_the_watcher_tracks_a_record_the_cloud_launcher_wrote(tmp_path: Path) -> None:
    launched(tmp_path, "T-X", "s12-x")

    records, _ = watch.load_launches(tmp_path, SINCE)

    assert sorted(records) == ["T-X"]
    assert records["T-X"]["branch"] == "s12-x"
    assert records["T-X"]["_started"] == STARTED


def test_an_acceptance_writer_is_followed_until_its_builder_starts_on_the_branch(tmp_path: Path) -> None:
    launched(tmp_path, "T-X-writer", "s12-x", role="acceptance-writer")
    launched(tmp_path, "T-Y-writer", "s12-y", role="acceptance-writer")

    alone, _ = watch.load_launches(tmp_path, SINCE)
    launched(tmp_path, "T-X", "s12-x", minutes=20)
    after, _ = watch.load_launches(tmp_path, SINCE)

    assert sorted(alone) == ["T-X-writer", "T-Y-writer"]
    assert sorted(after) == ["T-X", "T-Y-writer"]


def follow(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, message: str, minutes: int) -> watch.Pass:
    """Two watcher passes over the writer T-W's branch, whose head commit carries `message`: one a
    minute after the launch (the head is seen), one `minutes` after it (the head unchanged)."""
    launched(tmp_path, "T-W", "s12-w", role="acceptance-writer")
    records, _ = watch.load_launches(tmp_path, SINCE)
    monkeypatch.setattr(watch, "read_head", lambda branch, sha: (message, "f" * 40))
    monkeypatch.setattr(watch, "leak_scan", lambda head, main: {"result": "clean", "where": "-", "n": 0})
    state: dict[str, object] = {}
    for at in (1, minutes):
        step = watch.Pass(tmp_path, STARTED + timedelta(minutes=at), state)
        item = watch.track(step, "T-W", records["T-W"], {"s12-w": "a" * 40}, "b" * 40, [], None)
        step.item = item  # type: ignore[attr-defined]
        if at == 1:
            first = step
    step.first = first  # type: ignore[attr-defined]
    return step


def test_a_writer_is_done_at_its_acceptance_commit_and_its_push_is_scanned(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    step = follow(tmp_path, monkeypatch, "acceptance: T-W pins x\n\nred-on-main: 1 failed\n", minutes=60)

    assert step.item["state"] == "done"  # type: ignore[attr-defined]
    assert ("PUSH", "T-W", "a" * 8) in step.first.events  # type: ignore[attr-defined]
    assert not [
        code for code, _, _ in step.alarms.values() if code in ("BUILDER-QUIET", "BUDGET-PASSED")
    ]


def test_a_writer_that_never_pushed_its_acceptance_commit_still_raises_alarms(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    step = follow(tmp_path, monkeypatch, "Merge pull request #1 from x/y\n", minutes=60)

    assert step.item["state"] == "quiet"  # type: ignore[attr-defined]
    assert "BUILDER-QUIET" in [code for code, _, _ in step.alarms.values()]


def test_a_refused_launch_is_not_tracked_and_does_not_replace_a_running_builder(tmp_path: Path) -> None:
    launched(tmp_path, "T-S", "s12-s")
    launched(tmp_path, "T-S", "s12-other", ok=False, minutes=5)
    launched(tmp_path, "T-R", "s12-r", ok=False)

    records, _ = watch.load_launches(tmp_path, SINCE)

    assert sorted(records) == ["T-S"]
    assert records["T-S"]["branch"] == "s12-s"


def test_parse_utc_reads_whole_and_fractional_seconds() -> None:
    assert status.parse_utc("2026-10-05T03:42:44Z") == STARTED.replace(microsecond=0)
    assert status.parse_utc("2026-10-05T03:42:44.196170Z") == STARTED


OTHER_FORMS = ["2026-10-05 03:42:44", "2026-10-05T03:42:44+00:00", "2026-10-05T03:42:44.Z", ""]


@pytest.mark.parametrize("text", OTHER_FORMS)
def test_parse_utc_still_refuses_other_forms(text: str) -> None:
    with pytest.raises(ValueError, match="does not match format"):
        status.parse_utc(text)
