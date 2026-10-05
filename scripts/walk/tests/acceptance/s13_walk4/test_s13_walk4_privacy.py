"""T-WALK-4 acceptance, case 14: no file name, Sheet number, title or storey from the snapshot or the
expectation reaches verdict.json or public/summary.json.

"A planted file name and title in the snapshot and in the expectation appear in neither verdict.json
nor public/summary.json; the summary keeps the new check ids and the new measured keys (as numbers) and
nothing else." Synthetic data only: the planted strings are invented.
"""

import json
from pathlib import Path
from typing import Any

import pytest
from _s13_fixture import (  # type: ignore[import-not-found, unused-ignore]
    ARCHITECTURAL,
    CHECKS,
    FINISHED,
    MEASURED,
    PLANTED_FILE,
    PLANTED_NUMBER,
    PLANTED_STOREY,
    PLANTED_TITLE,
    SAME_TITLE,
    SET_A,
    SHA,
    STRUCTURAL,
    conflict,
    has_planted,
    lay_out,
    main_argv,
    sheet,
    standard_expect,
    standard_set,
)


@pytest.fixture(autouse=True)
def fixed_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    from scripts.walk import verdict

    monkeypatch.setattr(verdict, "utc_now", lambda: FINISHED)


def _planted() -> tuple[dict[str, Any], dict[str, Any]]:
    """A snapshot set with a Sheet in the planted file, under the planted number and title, and an
    expectation naming it in every structure."""
    entry = standard_set()
    entry["sheets"].append(
        sheet(
            "p1",
            PLANTED_FILE,
            PLANTED_NUMBER,
            PLANTED_TITLE,
            ARCHITECTURAL,
            storeys=[PLANTED_STOREY],
        )
    )
    entry["sheets"].append(
        sheet("p2", PLANTED_FILE, "L-99", PLANTED_TITLE, ARCHITECTURAL, storeys_titled=[PLANTED_STOREY])
    )
    entry["questions"].append(conflict("p9", SAME_TITLE, ARCHITECTURAL, "p1", "p2"))
    expect = standard_expect()
    expect["sheets_per_discipline"][ARCHITECTURAL] = 7
    expect["true_questions"].append(
        {
            "discipline": ARCHITECTURAL,
            "code": SAME_TITLE,
            "sheets": [
                {"file": PLANTED_FILE, "number": PLANTED_NUMBER},
                {"file": PLANTED_FILE, "number": "L-99"},
            ],
        }
    )
    expect["stale_title_pairs"].append(
        {
            "discipline": ARCHITECTURAL,
            "sheets": [
                {"file": PLANTED_FILE, "number": PLANTED_NUMBER},
                {"file": PLANTED_FILE, "number": "L-99"},
            ],
        }
    )
    expect["storeys"].append(
        {"file": PLANTED_FILE, "number": PLANTED_NUMBER, "storeys": [PLANTED_STOREY]}
    )
    return entry, expect


def test_no_planted_string_reaches_the_verdict_or_the_summary(tmp_path: Path) -> None:
    from scripts.walk import verdict as verdict_module

    entry, expect = _planted()
    walks, expect_dir = lay_out(tmp_path, {SET_A: entry}, {SET_A: expect})

    code = verdict_module.main(main_argv(walks, expect_dir))

    folder = walks / SHA
    verdict_text = (folder / "verdict.json").read_text()
    summary_text = (folder / "public" / "summary.json").read_text()
    assert code == 0, "the planted set is inside every limit"
    assert has_planted(verdict_text) == []
    assert has_planted(summary_text) == []
    assert "L-99" not in verdict_text + summary_text
    assert "K-0" not in verdict_text + summary_text
    for name in ("kilo", "lima", "Made-up"):
        assert name not in verdict_text + summary_text, name


def test_the_summary_keeps_the_new_ids_and_measured_numbers_only(tmp_path: Path) -> None:
    from scripts.walk import verdict as verdict_module

    entry, expect = _planted()
    walks, expect_dir = lay_out(tmp_path, {SET_A: entry}, {SET_A: expect})
    verdict_module.main(main_argv(walks, expect_dir))

    summary = json.loads((walks / SHA / "public" / "summary.json").read_text())

    assert [c["check"] for c in summary["checks"]] == list(CHECKS)
    for found in summary["checks"]:
        assert set(found) == {"check", "set", "status", "measured"}, found
        keys = MEASURED[found["check"]]
        assert keys <= set(found["measured"]) <= keys | {"unmeasured"}, found
        for value in found["measured"].values():
            assert isinstance(value, int | float), found
            assert not isinstance(value, bool), found
    assert {r["discipline"] for r in summary["burden"]} == {STRUCTURAL, ARCHITECTURAL}
