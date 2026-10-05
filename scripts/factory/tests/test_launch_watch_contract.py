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


def test_an_acceptance_writer_on_the_same_branch_is_not_tracked_as_a_builder(tmp_path: Path) -> None:
    launched(tmp_path, "T-X-writer", "s12-x", role="acceptance-writer")
    launched(tmp_path, "T-X", "s12-x", minutes=20)

    records, _ = watch.load_launches(tmp_path, SINCE)

    assert sorted(records) == ["T-X"]


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
