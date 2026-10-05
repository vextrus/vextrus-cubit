"""The builder's unit tests for `tools.jevleak.cli` (invented strings only; Jev is a Python fake)."""

import math
import sys
from collections.abc import Iterator, Mapping
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import jev
from tools.jevleak import candidates, cli
from vextrus.settings.jev import VEXTRUS_JEV_MAX_REQUEST_BYTES

CORPUS = ["MARIGOLD TANNERY LANE 42", "ZEBRA QUARRY HOLDINGS PVT 7731"]


@pytest.fixture(autouse=True)
def _home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    home = tmp_path / "home"
    home.mkdir()
    (home / "corpus").write_text("".join(f"{value}\n" for value in CORPUS))
    allowlist = tmp_path / "allowlist.txt"
    allowlist.write_text("")
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_HOME", str(home))
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_ALLOWLIST", str(allowlist))
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(tmp_path / "factory"))
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)
    return home


def answers(values: Mapping[str, object]) -> jev.Answers:
    return jev.Answers(
        {name: {"p": value} for name, value in values.items()},
        model=jev.DEFAULT_MODEL,
        input_tokens=0,
        output_tokens=0,
        latency_ms=0,
    )


class Lying(Mapping[str, Any]):
    """A mapping whose keys say one thing and whose items fail."""

    def __init__(self, names: list[str]) -> None:
        self.names = names

    def __getitem__(self, name: str) -> Any:
        raise KeyError(name)

    def __iter__(self) -> Iterator[str]:
        return iter(self.names)

    def __len__(self) -> int:
        return len(self.names)


class Half(float):
    pass


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0.8, [0.8]),
        (1, [1.0]),
        (0, [0.0]),
        (Half(0.9), [0.9]),
        (True, "malformed"),
        (-0.01, "malformed"),
        (math.inf, "malformed"),
        (None, "malformed"),
    ],
)
def test_judged_takes_only_a_real_number_from_0_to_1(value: object, expected: object) -> None:
    assert cli.judged(answers({"q0": value}), ["q0"]) == expected


def test_judged_refuses_an_extra_or_missing_name_and_a_non_mapping() -> None:
    assert cli.judged(answers({"q0": 0.9, "q1": 0.9}), ["q0"]) == "malformed"
    assert cli.judged(answers({"q1": 0.9}), ["q0", "q1"]) == "malformed"
    assert cli.judged([0.9], ["q0"]) == "malformed"
    listed: Any = {"q0": [0.9]}
    shaped = jev.Answers(listed, model="m", input_tokens=0, output_tokens=0, latency_ms=0)
    assert cli.judged(shaped, ["q0"]) == "malformed"


def test_judged_names_the_why_only_when_it_is_the_clients_word() -> None:
    assert cli.judged(jev.Unavailable(jev.Why.NO_KEY), ["q0"]) == "no_key"
    assert cli.judged(jev.Unavailable("RC-14B"), ["q0"]) == "malformed"  # type: ignore[arg-type]


def test_a_lying_mapping_ends_failed_not_in_a_traceback(capsys: pytest.CaptureFixture[str]) -> None:
    def lying(state: object, questions: Any, **kwargs: object) -> Any:
        return Lying(list(questions))

    code = cli.run(["text", "--stdin"], ask=lying, stdin=b"see RC-14B here.\n")
    out = capsys.readouterr()
    assert code == 0
    assert out.out.splitlines()[-1].endswith("jev=unavailable:failed")
    assert "RC-14B" not in out.out + out.err


def test_a_repeated_candidate_is_advised_on_every_line_it_is_on(
    capsys: pytest.CaptureFixture[str],
) -> None:
    data = b"see RC-14B here.\nnothing.\nagain RC-14B.\n"
    code = cli.run(["text", "--stdin"], ask=lambda s, q, **k: answers(dict.fromkeys(q, 0.9)), stdin=data)
    lines = capsys.readouterr().out.splitlines()
    assert code == 0
    assert lines[:-1] == ["ADVISE stdin:1 1", "ADVISE stdin:3 1"]
    assert lines[-1].startswith("jevleak: hits=0 scanned=4 advise=1 candidates=1 asked=1 ")


def test_a_wrapped_corpus_hit_is_the_walls_and_nothing_is_sent(
    capsys: pytest.CaptureFixture[str],
) -> None:
    calls: list[object] = []
    data = b"- the site is Marigold Tannery\n- Lane 42 and RC-14B\n"

    def record(*args: object, **kwargs: object) -> Any:
        calls.append(args)

    code = cli.run(["text", "--stdin"], ask=record, stdin=data)
    assert code == 1
    assert calls == []
    assert capsys.readouterr().out.splitlines()[0] == "HIT stdin:1 1"


def test_windows_are_bounded_and_hold_their_candidate() -> None:
    line = "a" * 300 + " RC-14B " + "b" * 300
    window = cli.window(line, 301, len("RC-14B"))
    assert len(window) <= cli.WINDOW
    assert "RC-14B" in window
    assert cli.window("short RC-14B", 6, 6) == "short RC-14B"


def test_a_request_of_wide_characters_is_trimmed_to_the_clients_limit() -> None:
    line = "一" * 200
    text = "".join(f"{line} RC-{i}B {line}\n" for i in range(60))
    found = candidates.extract(text)[: cli.MAX_ASKED]
    windows, questions = cli.request(found, text.split("\n"))
    assert 1 <= len(questions) < cli.MAX_ASKED
    assert len(windows) == len(questions)
    call = jev._prepare(windows, questions, jev.DEFAULT_MODEL)
    assert not isinstance(call, jev.Unavailable)
    assert len(call.body) <= VEXTRUS_JEV_MAX_REQUEST_BYTES


def test_a_usage_error_exits_64_and_prints_no_argument(capsys: pytest.CaptureFixture[str]) -> None:
    assert cli.run(["file"]) == cli.USAGE
    assert cli.run(["text"]) == cli.USAGE
    assert cli.run(["pr", "RC-14B"]) == cli.USAGE
    out = capsys.readouterr()
    assert "RC-14B" not in out.out + out.err


def test_main_turns_an_unexpected_error_into_a_fixed_line(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    def boom(*args: object, **kwargs: object) -> int:
        raise LookupError("RC-14B")

    monkeypatch.setattr(cli, "run", boom)
    monkeypatch.setattr(sys, "argv", ["jevleak", "file", "x"])
    assert cli.main() == 2
    out = capsys.readouterr()
    assert out.out == "jevleak: cannot-scan source-unreadable\n"
    assert "RC-14B" not in out.out + out.err
