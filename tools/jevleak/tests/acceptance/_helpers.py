"""Shared helpers for ticket T-JEV-LEAK's acceptance tests (the Jev leak advice, `tools/jevleak`).

The seam (the ticket's section 3): `tools.jevleak.cli.run(argv, *, ask=jev.ask, stdin=b"") -> int`
prints to stdout and stderr and returns the exit code. Every corpus string and every draft here is
INVENTED (a name no drawing holds). The corpus and the allowlist live in the test's temporary folder,
reached through the scanner's seams `VEXTRUS_LEAKSCAN_HOME` and `VEXTRUS_LEAKSCAN_ALLOWLIST`, set from
Python; `CLAUDE_CODE_REMOTE` and `TYPESAFE_API_KEY` are set or deleted explicitly. Jev is a Python
callable (`FakeJev`): no test reaches the network.

A few lines are copied (not imported) from `tools/leakscan/tests/acceptance/_leak.py`.
"""

import importlib
import os
import re
import sys
import unicodedata
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import jev

REPO = Path(__file__).resolve().parents[4]

# Copied from the leak scan's acceptance helper: the invented corpus strings and a distinctive word
# of each (none may appear in any output, in any case).
ZEBRA = "Zebra Quarry Holdings Pvt 7731"
MARIGOLD = "Marigold Tannery Lane 42"
COPPERFIELD = "Copperfield Orchard Terrace"
SAFFRON = "Saffron Kiln Works Ltd"
INDIGO = "Indigo Ferry Mills 88"
QUILLMOOR = "Quillmoor-Estates"
LITERALS = [ZEBRA, MARIGOLD, COPPERFIELD, SAFFRON, INDIGO, QUILLMOOR]
WORDS = ["ZEBRA", "MARIGOLD", "COPPERFIELD", "SAFFRON", "INDIGO", "QUILLMOOR"]

# An invented proper noun that is NOT in the corpus: what the literal wall misses and Jev may flag.
THISTLE = "Thistlewood Granary Court"
THISTLE_WORDS = ["THISTLEWOOD", "GRANARY"]

SUMMARY = re.compile(
    r"^jevleak: hits=(?P<hits>\d+) scanned=(?P<scanned>\d+) advise=(?P<advise>\d+) "
    r"candidates=(?P<candidates>\d+) asked=(?P<asked>\d+) "
    r"jev=(?P<jev>ok|off|unavailable:[a-z_]+)$"
)
HIT = re.compile(r"^HIT (\S+) (\d+)$")
ADVISE = re.compile(r"^ADVISE ((?:file|stdin):\d+) (\d+)$")
WINDOW_MOST = 160


def normalise(text: str) -> str:
    """The contract's normalisation: NFKC, whitespace runs collapsed, trimmed, upper-cased."""
    return " ".join(unicodedata.normalize("NFKC", text).split()).upper()


def cli() -> Any:
    """`tools.jevleak.cli`, imported when a test runs (today: ModuleNotFoundError, not built yet)."""
    return importlib.import_module("tools.jevleak.cli")


def candidates_module() -> Any:
    return importlib.import_module("tools.jevleak.candidates")


@dataclass
class Home:
    """One leak-scan home (the corpus) and allowlist under a test's temporary folder."""

    tmp: Path
    home: Path
    allowlist: Path

    @property
    def corpus(self) -> Path:
        return self.home / "corpus"

    def draft(self, text: str, name: str = "draft-plumtree-notes.md") -> Path:
        path = self.tmp / name
        path.write_text(text, encoding="utf-8")
        return path

    def files(self) -> dict[str, bytes]:
        """Every file under the home and the allowlist, by path, with its bytes."""
        found = {str(path): path.read_bytes() for path in sorted(self.home.rglob("*")) if path.is_file()}
        found[str(self.allowlist)] = self.allowlist.read_bytes()
        return found

    def env(self) -> dict[str, str]:
        """A subprocess's environment: the seams set, no key, not in the cloud."""
        env = dict(os.environ)
        for name in ("CLAUDE_CODE_REMOTE", "TYPESAFE_API_KEY", "VEXTRUS_MAIN_CHECKOUT"):
            env.pop(name, None)
        env.update(
            VEXTRUS_LEAKSCAN_HOME=str(self.home),
            VEXTRUS_LEAKSCAN_ALLOWLIST=str(self.allowlist),
            VEXTRUS_FACTORY_DIR=str(self.tmp / "factory"),
            PYTHONPATH=str(REPO),
        )
        return env


def make_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Home:
    """An invented corpus (the six literals, normalised, one per line, as `build` writes it) and an
    empty allowlist; the seams set for this process; no key; not in the cloud."""
    home = tmp_path / "leakhome"
    home.mkdir()
    (home / "corpus").write_text("".join(f"{value}\n" for value in sorted(map(normalise, LITERALS))))
    allowlist = tmp_path / "allowlist.txt"
    allowlist.write_text("")
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_HOME", str(home))
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_ALLOWLIST", str(allowlist))
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(tmp_path / "factory"))
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)
    monkeypatch.delenv("VEXTRUS_MAIN_CHECKOUT", raising=False)
    return Home(tmp_path, home, allowlist)


def answers(values: Mapping[str, object]) -> jev.Answers:
    """An `Answers` holding `{name: {"p": value}}` (values unchecked: a fake may send garbage)."""
    return jev.Answers(
        {name: {"p": value} for name, value in values.items()},
        model=jev.DEFAULT_MODEL,
        input_tokens=0,
        output_tokens=0,
        latency_ms=0,
    )


@dataclass
class FakeJev:
    """Jev as a Python callable: it records what it was sent and answers every question with `p`
    (or returns `outcome`, or raises `error`)."""

    p: object = 0.97
    outcome: object = None
    error: BaseException | None = None
    answer: Callable[[dict[str, Any]], object] | None = None
    calls: int = 0
    state: object = None
    questions: dict[str, Any] = field(default_factory=dict)
    task: object = None

    def __call__(self, state: object, questions: object, **kwargs: object) -> object:
        self.calls += 1
        self.state = state
        self.questions = dict(questions) if isinstance(questions, Mapping) else {}
        self.task = kwargs.get("task")
        if self.error is not None:
            raise self.error
        if self.outcome is not None:
            return self.outcome
        if self.answer is not None:
            return self.answer(self.questions)
        return answers(dict.fromkeys(self.questions, self.p))

    @property
    def windows(self) -> list[str]:
        assert isinstance(self.state, list), "the state is a list of context windows"
        assert all(isinstance(window, str) for window in self.state)
        return list(self.state)

    def texts(self) -> list[str]:
        return [str(question.get("text", "")) for question in self.questions.values()]


@dataclass
class Ran:
    code: int
    out: str
    err: str

    @property
    def lines(self) -> list[str]:
        return [line for line in self.out.splitlines() if line.strip()]

    def summary(self) -> re.Match[str]:
        last = self.lines[-1] if self.lines else ""
        match = SUMMARY.match(last)
        assert match, f"the last line is not the summary: {last!r}"
        return match

    def hits(self) -> list[str]:
        return [line for line in self.lines if line.startswith("HIT ")]

    def advice(self) -> list[tuple[str, int]]:
        found = []
        for line in self.lines:
            if line.startswith("ADVISE"):
                match = ADVISE.match(line)
                assert match, f"not an ADVISE line: {line!r}"
                found.append((match[1], int(match[2])))
        return found


def run(
    capsys: pytest.CaptureFixture[str],
    argv: list[str],
    *,
    ask: object = None,
    stdin: bytes = b"",
) -> Ran:
    """`tools.jevleak.cli.run(argv, ask=..., stdin=...)` in this process, its output captured."""
    module = cli()
    capsys.readouterr()
    code = module.run(argv, stdin=stdin) if ask is None else module.run(argv, ask=ask, stdin=stdin)
    captured = capsys.readouterr()
    assert isinstance(code, int), "run returns the exit code"
    return Ran(code, captured.out, captured.err)


def assert_silent(ran: Ran, *secrets: str) -> None:
    """Neither stream holds a corpus word or literal, nor any of `secrets` (in any case), nor a
    traceback."""
    for stream in (ran.out, ran.err):
        upper = stream.upper()
        assert "TRACEBACK" not in upper
        for word in WORDS:
            assert word not in upper, f"the output names a corpus word ({word[0]}...)"
        for literal in LITERALS:
            assert normalise(literal) not in normalise(stream)
        for secret in secrets:
            assert secret.upper() not in upper, f"the output holds a draft's text ({secret[:3]}...)"


def request_size(fake: FakeJev) -> int:
    """The bytes the Jev client would send for what the fake was given (its own encoder): a request it
    would refuse whole (a bad question, too large) fails here."""
    call = jev._prepare(fake.state, fake.questions, jev.DEFAULT_MODEL)
    assert not isinstance(call, jev.Unavailable), f"the client would refuse it: {call}"
    return len(call.body)


def squash(text: str) -> str:
    return normalise(text).replace(" ", "")


PYTHON = sys.executable
