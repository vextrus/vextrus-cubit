"""Ticket 24s: the scorer reads only a posting run's own export (docs/plans/M0.md, 24s: "It reads only a
posting run's own export in the drop folder, of a committed head (never a hand-made file)"; "'The
pipeline's own export' must be enforced, not asked for"; session 06's ruling: "the scorer refuses a
folder `vxrun` did not write"; #8's contract: "no path argument", "checks the export's run id").

The pipeline's user is injected through the seam's `writer` (a user id), so a folder the test's own user
wrote stands for one another user wrote. A refusal returns non-zero and answers no score.
"""

import json
import os
import re
from pathlib import Path

import pytest

from .runs import RUN_ID, Place, export_sheet, export_view, key_sheet, key_view

BOX = [10.0, 10.0, 110.0, 110.0]
SCORE = re.compile(r"\b\d+ / \d+\b")


def a_run(place: Place) -> Path:
    place.write_keys(
        [key_sheet("Sheet A", "QZ-901", "Invented plan", "first floor", [key_view(BOX, "Plan A")])]
    )
    return place.write_run(
        [export_sheet("Sheet A", "QZ-901", "Invented plan", "first floor", [export_view(BOX, "Plan A")])]
    )


def refused(place: Place, capfd: pytest.CaptureFixture[str], **call: object) -> str:
    code = place.score(**call)  # type: ignore[arg-type]
    output = capfd.readouterr()
    shown = output.out + output.err
    assert code != 0, shown
    assert SCORE.search(shown) is None, shown
    return shown


def test_a_folder_the_pipelines_user_did_not_write_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    a_run(place)

    refused(place, capfd, writer=os.getuid() + 1)


def test_the_same_run_is_scored_when_the_pipelines_user_wrote_it(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    a_run(place)

    assert place.score() == 0
    output = capfd.readouterr()
    assert SCORE.search(output.out + output.err) is not None


def test_a_hand_made_export_the_run_did_not_record_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    export = a_run(place)
    document = json.loads(export.read_text())
    document["files"][0]["sheets"][0]["number"]["value"] = "QZ-999"
    export.write_text(json.dumps(document))  # its digest is no longer the one metadata.json records

    refused(place, capfd)


def test_an_export_that_names_another_run_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    place.write_keys(
        [key_sheet("Sheet A", "QZ-901", "Invented plan", "first floor", [key_view(BOX, "Plan A")])]
    )
    place.write_run(
        [
            export_sheet(
                "Sheet A", "QZ-901", "Invented plan", "first floor", [export_view(BOX, "Plan A")]
            )
        ],
        export_run_id="20260101T000000Z-aaaaaaaaaaaa-0000",
    )

    refused(place, capfd)


def test_metadata_that_names_another_run_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    place.write_keys(
        [key_sheet("Sheet A", "QZ-901", "Invented plan", "first floor", [key_view(BOX, "Plan A")])]
    )
    place.write_run(
        [
            export_sheet(
                "Sheet A", "QZ-901", "Invented plan", "first floor", [export_view(BOX, "Plan A")]
            )
        ],
        metadata_run_id="20260101T000000Z-aaaaaaaaaaaa-0000",
    )

    refused(place, capfd)


def test_an_export_that_is_a_link_is_refused(tmp_path: Path, capfd: pytest.CaptureFixture[str]) -> None:
    place = Place(tmp_path)
    export = a_run(place)
    elsewhere = tmp_path / "planted.json"
    elsewhere.write_bytes(export.read_bytes())  # the same bytes, so the recorded digest still matches
    export.unlink()
    export.symlink_to(elsewhere)

    refused(place, capfd)


def test_a_run_folder_others_may_write_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    a_run(place)
    os.chmod(place.run, 0o777)

    refused(place, capfd)


@pytest.mark.parametrize("argument", ["../keys", "/etc", str(Path("drop") / RUN_ID), "", "not-a-run"])
def test_an_argument_that_is_not_a_run_id_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], argument: str
) -> None:
    place = Place(tmp_path)
    a_run(place)

    refused(place, capfd, argv=[argument])


def test_a_run_folder_that_is_not_there_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    place.write_keys(
        [key_sheet("Sheet A", "QZ-901", "Invented plan", "first floor", [key_view(BOX, "Plan A")])]
    )
    place.drop.mkdir()

    refused(place, capfd)
