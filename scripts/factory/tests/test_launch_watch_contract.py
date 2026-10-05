"""The cloud launcher's record is read by the watcher.

On 5 Oct 2026 every record `scripts.factory.launch cloud` wrote carried `started_at` with microseconds
(`isoformat()`), which `status.parse_utc` refused, so the watcher skipped every launched builder as an
"unreadable launch record" and tracked none: no PUSH, READY or BLOCKED event, `builders.items` empty.
Each side was tested only against its own fake record. This test writes a record through the
launcher's own `_Run.write` and reads it back through the watcher's own `load_launches`.
"""

from datetime import UTC, datetime
from pathlib import Path

import pytest

from scripts.factory import launch, status, watch

STARTED = datetime(2026, 10, 5, 3, 42, 44, 196170, tzinfo=UTC)


def test_the_watcher_tracks_a_record_the_cloud_launcher_wrote(tmp_path: Path) -> None:
    request = launch.CloudRequest(
        branch="s12-x", prompt_file=tmp_path / "p.md", ticket="T-X", effort="medium"
    )
    run = launch._Run(
        req=request, record_dir=tmp_path / "launches", started=STARTED, snapshot=lambda: "[]"
    )
    run.write(launch.Verdict(ok=True, reason="cloned at s12-x", session="session_01Abc"))

    records, _ = watch.load_launches(tmp_path, datetime(2026, 10, 5, tzinfo=UTC))

    assert sorted(records) == ["T-X"]
    assert records["T-X"]["branch"] == "s12-x"
    assert records["T-X"]["_started"] == STARTED


def test_parse_utc_reads_whole_and_fractional_seconds() -> None:
    assert status.parse_utc("2026-10-05T03:42:44Z") == STARTED.replace(microsecond=0)
    assert status.parse_utc("2026-10-05T03:42:44.196170Z") == STARTED


OTHER_FORMS = ["2026-10-05 03:42:44", "2026-10-05T03:42:44+00:00", "2026-10-05T03:42:44.Z", ""]


@pytest.mark.parametrize("text", OTHER_FORMS)
def test_parse_utc_still_refuses_other_forms(text: str) -> None:
    with pytest.raises(ValueError, match="does not match format"):
        status.parse_utc(text)
