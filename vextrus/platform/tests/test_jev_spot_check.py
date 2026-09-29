"""The spot check's command and its adding up (23), on the recordings: invented sheets, no key."""

import json
from decimal import Decimal
from pathlib import Path

import pytest
from django.conf import settings
from django.core.management import CommandError, call_command

from vextrus.platform.services import jev, jev_spot_check
from vextrus.platform.services.jev_spot_check import SpotCheck, Tally
from vextrus.testing.jev import INVENTED_SHEETS, STAND_IN_KINDS, STAND_IN_QUESTION, TEST_KEY


def _check(**by_kind: Tally) -> SpotCheck:
    return SpotCheck(
        node="sheet_type",
        model=jev.SHEET_TYPE.model,
        threshold=Decimal("0.90"),
        by_kind=by_kind,
        queue=1,
        unavailable={"busy": 1},
        confused={("beam_layout", "other"): 1},
    )


def test_runs_of_one_node_add_up_by_kind() -> None:
    added = jev_spot_check.total(
        [_check(beam_layout=Tally(1, 2)), _check(beam_layout=Tally(2, 2), other=Tally(0, 1))]
    )

    assert (added.right, added.checked, added.queue) == (3, 5, 2)
    assert added.by_kind == {"beam_layout": (3, 4), "other": (0, 1)}
    assert added.unavailable == {"busy": 2}
    assert added.confused == {("beam_layout", "other"): 2}


def test_runs_of_another_model_do_not_add_up() -> None:
    other = SpotCheck("sheet_type", "jev-0.0.1", Decimal("0.90"), {"other": Tally(1, 1)}, 0)

    with pytest.raises(ValueError, match="do not add up"):
        jev_spot_check.total([_check(other=Tally(1, 1)), other])


def _labels(tmp_path: Path) -> Path:
    labels = tmp_path / "labels.jsonl"
    lines = [
        {"facts": dict(facts), "options": options, "kind": "other"}
        for options in (dict(STAND_IN_KINDS), list(STAND_IN_KINDS))
        for facts in INVENTED_SHEETS
    ]
    labels.write_text("\n".join(json.dumps(line) for line in lines), encoding="utf-8")
    return labels


def test_the_command_asks_each_labelled_item_and_prints_counts_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv(settings.VEXTRUS_JEV_KEY_VARIABLE, TEST_KEY)  # the recordings answer it

    call_command("jev_spot_check", str(_labels(tmp_path)), "--question", STAND_IN_QUESTION)

    printed = capsys.readouterr().out
    assert f"/ {2 * len(INVENTED_SHEETS)} · queue:" in printed
    assert "unavailable" not in printed
    for facts in INVENTED_SHEETS:
        assert facts["title"] not in printed


def test_the_command_refuses_to_call_nothing_answered_a_measure(tmp_path: Path) -> None:
    with pytest.raises(CommandError, match="Jev answered nothing"):  # no key in the environment
        call_command("jev_spot_check", str(_labels(tmp_path)), "--question", STAND_IN_QUESTION)


def test_the_command_refuses_a_line_that_is_not_a_labelled_item(tmp_path: Path) -> None:
    labels = tmp_path / "labels.jsonl"
    labels.write_text('{"facts": {}}\n', encoding="utf-8")

    with pytest.raises(CommandError, match="line 1"):
        call_command("jev_spot_check", str(labels), "--question", STAND_IN_QUESTION)


TITLE = "ZQX SECRET TOWER BEAM PLAN"


@pytest.mark.parametrize(
    ("options", "label"),
    [
        (["beam_layout", "other"], TITLE),
        (["beam_layout", TITLE], TITLE),
        ({TITLE: None, "other": None}, "other"),
    ],
)
def test_a_title_in_a_label_or_an_option_is_refused_and_never_echoed(
    options: jev.Options, label: str, jev_offline: object, caplog: pytest.LogCaptureFixture
) -> None:
    facts = {"title": TITLE, "discipline": "structural", "view_titles": []}
    client = jev.Client(key=lambda: TEST_KEY)

    with pytest.raises(ValueError, match=r"options|label") as refused:
        jev_spot_check.run("sheet_type", [(facts, label)], STAND_IN_QUESTION, options, client=client)

    assert "ZQX" not in str(refused.value)
    assert "ZQX" not in caplog.text


NODE_TABLE = Path(__file__).resolve().parents[3] / "docs" / "knowledge" / "jev-nodes.md"
SETTINGS = Path(__file__).resolve().parents[2] / "settings" / "jev.py"


def test_the_threshold_in_use_is_the_one_the_spot_check_measured() -> None:
    lines = NODE_TABLE.read_text(encoding="utf-8").splitlines()
    header = next(line for line in lines if line.startswith("| node |"))
    cells = [c.strip() for c in header.strip("|").split("|")]
    rows = [line for line in lines if line.startswith(f"| {jev.SHEET_TYPE.key} |")]
    current = [c.strip() for c in rows[-1].strip("|").split("|")]

    assert Decimal(current[cells.index("threshold")]) == getattr(settings, jev.SHEET_TYPE.propose_at)


def test_the_threshold_setting_is_no_placeholder() -> None:
    source = SETTINGS.read_text(encoding="utf-8")
    after = source.split(f"{jev.SHEET_TYPE.propose_at} =", 1)[1]
    comment = after.split('"""', 2)[1]

    assert "placeholder" not in comment.lower()
    assert "docs/knowledge/jev-nodes.md" in comment
