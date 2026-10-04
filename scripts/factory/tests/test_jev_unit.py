"""The builder's own tests for `scripts/factory/jev.py` (ticket f9), beyond the pinned acceptance
tests in `acceptance/test_factory_jev.py`; and L1, the one live call (`-m live`), kept here because
the acceptance path may hold no deselected test."""

import json
import os
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest

from scripts.factory import jev

SENTINEL = "KEYSENTINEL-do-not-print-0451"
MARKER = "INVENTED-MARKER-7f3a"
HEAD_SHA = "0123456789abcdef0123456789abcdef01234567"


@pytest.fixture(autouse=True)
def isolated(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    factory = tmp_path / "factory"
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(factory))
    monkeypatch.setattr(jev, "_health", jev._Health())
    monkeypatch.setattr(jev, "_sleep", lambda seconds: None)
    return factory


def mocked(handler: Callable[[httpx.Request], httpx.Response]) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def refuse(request: httpx.Request) -> httpx.Response:
    raise AssertionError("no request was expected")


def noul_answer(request: httpx.Request) -> httpx.Response:
    asked = json.loads(request.content)["questions"]
    answers = {qid: {"type": "noul", "noul": 0.5} for qid in asked}
    return httpx.Response(200, json={"model": "jev-1.13.0", "answers": answers})


def test_answers_and_unavailable_show_no_state_or_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TYPESAFE_API_KEY", SENTINEL)
    question = {"q": {"kind": "noul", "text": "Is the invented sky blue?"}}
    with mocked(noul_answer) as client:
        answers = jev.ask(f"Invented {MARKER}.", question, client=client)
    assert isinstance(answers, jev.Answers)
    assert answers.output_tokens == 0, "usage absent counts as nothing"
    for text in (repr(answers), str(answers), repr(jev.Unavailable(jev.Why.NO_KEY))):
        assert MARKER not in text
        assert SENTINEL not in text
        assert "invented sky" not in text


def test_a_model_that_is_neither_a_version_nor_an_alias_is_a_bad_question(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TYPESAFE_API_KEY", SENTINEL)
    with mocked(refuse) as client:
        outcome = jev.ask(
            "Invented.", {"q": {"kind": "noul", "text": "Is it?"}}, model="jev", client=client
        )
    assert outcome == jev.Unavailable(jev.Why.BAD_QUESTION)


def test_a_compressed_answer_is_malformed_never_inflated(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TYPESAFE_API_KEY", SENTINEL)

    def gzipped(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"\x1f\x8b", headers={"content-encoding": "gzip"})

    with mocked(gzipped) as client:
        outcome = jev.ask("Invented.", {"q": {"kind": "noul", "text": "Is it?"}}, client=client)
    assert outcome == jev.Unavailable(jev.Why.MALFORMED)


def test_a_duplicate_key_in_the_answer_is_malformed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TYPESAFE_API_KEY", SENTINEL)
    body = (
        b'{"model":"jev-1.13.0","answers":{"q0":{"type":"noul","noul":0.1},'
        b'"q0":{"type":"noul","noul":0.9}}}'
    )

    def twice(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=body)

    with mocked(twice) as client:
        outcome = jev.ask("Invented.", {"q": {"kind": "noul", "text": "Is it?"}}, client=client)
    assert outcome == jev.Unavailable(jev.Why.MALFORMED)


def test_triage_of_no_findings_makes_no_call_and_no_sidecar(
    isolated: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    source = tmp_path / "none.json"
    source.write_text(json.dumps({"pr": 250, "head_sha": HEAD_SHA, "findings": []}))
    assert jev.main(["triage", "--from", str(source)]) == 0
    assert capsys.readouterr().out.strip() == "triage 250 01234567 0 findings"
    assert not (isolated / "ledger-jev").exists()
    assert not (isolated / "jev.log").exists()


def test_severity_is_the_most_probable_level_the_lower_on_a_tie() -> None:
    assert jev._severity({"0": 0.1, "1": 0.2, "2": 0.6, "3": 0.1}) == "high"
    assert jev._severity({"0": 0.0, "1": 0.5, "2": 0.5, "3": 0.0}) == "medium"


@pytest.mark.parametrize(
    "issues",
    ['{"number": 1}', '[{"number": "1", "title": "Invented"}]', '[{"number": 1, "title": ""}]'],
    ids=["not-a-list", "number-a-string", "empty-title"],
)
def test_same_issue_usage_errors_exit_64(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], issues: str
) -> None:
    path = tmp_path / "issues.json"
    path.write_text(issues)
    assert jev.main(["same-issue", "--text", "Invented defect.", "--issues", str(path)]) == 64
    assert capsys.readouterr().err.strip()


def test_models_check_without_a_readable_pin_table_exits_64(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert jev.main(["models-check", "--pin-file", str(tmp_path / "absent.md")]) == 64
    empty = tmp_path / "empty.md"
    empty.write_text("| node | threshold |\n|---|---|\n| sheet_type | jev-9.9.9 |\n")
    assert jev.main(["models-check", "--pin-file", str(empty)]) == 64
    assert capsys.readouterr().out == ""


def test_pins_come_only_from_a_tables_model_column(tmp_path: Path) -> None:
    path = tmp_path / "pins.md"
    path.write_text(
        "Prose naming jev-0.0.1.\n\n"
        "| node | model | note |\n|---|---|---|\n| a | `jev-1.13.0` | was jev-1.12.0 |\n"
        "| b | jev-2.0.0 | |\n\n"
        "| threshold | model-ish |\n|---|---|\n| 0.9 | jev-3.0.0 |\n"
    )
    assert jev.read_pins(path) == {"jev-1.13.0", "jev-2.0.0"}


@pytest.mark.live
def test_l1_one_live_call_on_invented_text(isolated: Path) -> None:
    """L1: one real `ask` against `jev-1.13.0`; needs the key and the network (`-m live`)."""
    if not os.environ.get("TYPESAFE_API_KEY", "").strip():
        pytest.skip("no TYPESAFE_API_KEY in the environment")
    answers = jev.ask(
        "Invented text: the kettle on the stove is whistling.",
        {"q": {"kind": "noul", "text": "Is the water in the kettle likely boiling?"}},
        task="live-check",
        cache=False,
    )
    assert isinstance(answers, jev.Answers), answers
    assert answers.model == "jev-1.13.0"
    assert 0 <= answers["q"]["p"] <= 1
