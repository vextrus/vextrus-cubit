"""Ticket T-JEV-LEAK, A: the advice beside the literal wall (spec 3.14 row J-e; the ticket's section 3).

`python -m tools.jevleak file <path> | text --stdin [--no-jev]`: the literal pass's `HIT <where> <n>`
lines exactly as `tools.leakscan` prints them, then `ADVISE <where> <n>` for each line holding a
candidate Jev rates `p >= 0.8`, then `jevleak: hits=<H> scanned=<M> advise=<A> candidates=<C> asked=<Q>
jev=<ok|off|unavailable:<why>>`. Exit 0 clean or advice only (advice is never a gate), 1 a literal hit,
2 cannot scan, 64 usage. Every draft is invented; today the package does not exist.
"""

import re
from pathlib import Path

import pytest

from scripts.factory import jev
from tools.leakscan.core import Corpus, digest
from tools.leakscan.scan import scan_lines
from vextrus.settings.jev import VEXTRUS_JEV_MAX_REQUEST_BYTES

from ._helpers import (
    MARIGOLD,
    THISTLE,
    THISTLE_WORDS,
    WINDOW_MOST,
    FakeJev,
    answers,
    assert_silent,
    candidates_module,
    make_home,
    normalise,
    request_size,
    run,
    squash,
)

ONE_CANDIDATE = (
    f"## Summary\n\nThe walls of {THISTLE} were measured again.\nNothing else changed in this draft.\n"
)


def test_an_invented_proper_noun_rated_097_is_advised_by_line_and_count_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    home = make_home(tmp_path, monkeypatch)
    draft = home.draft(ONE_CANDIDATE)
    fake = FakeJev(p=0.97)
    ran = run(capsys, ["file", str(draft)], ask=fake)
    assert ran.code == 0, "advice is never a gate"
    assert ran.advice() == [("file:3", 1)]
    assert ran.hits() == []
    summary = ran.summary()
    assert (summary["hits"], summary["advise"], summary["jev"]) == ("0", "1", "ok")
    for word in THISTLE_WORDS:
        for stream in (ran.out, ran.err):
            assert word not in stream.upper()
            assert word.lower() not in stream
    assert_silent(ran, THISTLE, *THISTLE_WORDS)


@pytest.mark.parametrize(("p", "advised"), [(0.79, False), (0.8, True)])
def test_the_threshold_is_p_at_least_0_8(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    p: float,
    advised: bool,
) -> None:
    home = make_home(tmp_path, monkeypatch)
    fake = FakeJev(p=p)
    ran = run(capsys, ["file", str(home.draft(ONE_CANDIDATE))], ask=fake)
    assert ran.code == 0
    assert ran.advice() == ([("file:3", 1)] if advised else [])
    summary = ran.summary()
    assert summary["advise"] == ("1" if advised else "0")
    assert (summary["candidates"], summary["asked"], summary["jev"]) == ("1", "1", "ok")
    assert fake.calls == 1
    assert len(fake.questions) == 1


def test_a_literal_corpus_hit_refuses_and_sends_nothing_whatever_jev_would_say(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    make_home(tmp_path, monkeypatch)
    data = f"A clean first line.\nThe site is {MARIGOLD} for now.\nAlso {THISTLE} here.\n".encode()
    fake = FakeJev(p=0.01)
    ran = run(capsys, ["text", "--stdin"], ask=fake, stdin=data)
    assert ran.code == 1, "a literal hit is the wall's: exit 1"
    assert fake.calls == 0, "a known hit is sent nowhere"
    assert ran.hits() == ["HIT stdin:2 1"]
    literal = scan_lines(Corpus.load(), data, "stdin")
    assert ran.hits() == [f"HIT {where} {n}" for where, n in literal.hits], "exactly as leakscan"
    assert ran.advice() == []
    summary = ran.summary()
    assert (summary["hits"], summary["scanned"], summary["advise"], summary["jev"]) == (
        "1",
        str(literal.scanned),
        "0",
        "off",
    )
    assert_silent(ran, THISTLE, *THISTLE_WORDS)


def _without_jev_field(text: str) -> str:
    return re.sub(r" jev=\S+$", "", text.rstrip("\n"), flags=re.MULTILINE)


def test_unavailable_is_the_run_without_jev(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    home = make_home(tmp_path, monkeypatch)
    draft = str(home.draft(ONE_CANDIDATE))
    fake = FakeJev(outcome=jev.Unavailable(jev.Why.TIMED_OUT))
    ran = run(capsys, ["file", draft], ask=fake)
    unused = FakeJev(p=0.97)
    without = run(capsys, ["file", draft, "--no-jev"], ask=unused)
    assert unused.calls == 0, "--no-jev asks nothing"
    assert ran.code == without.code == 0
    assert ran.advice() == without.advice() == []
    assert ran.summary()["jev"] == "unavailable:timed_out"
    assert without.summary()["jev"] == "off"
    assert _without_jev_field(ran.out) == _without_jev_field(without.out)


GARBAGE = {
    "a missing question name": lambda questions: answers({"not-a-question": 0.97}),
    "p = 1.5": lambda questions: answers(dict.fromkeys(questions, 1.5)),
    "p = True": lambda questions: answers(dict.fromkeys(questions, True)),
    "p = nan": lambda questions: answers(dict.fromkeys(questions, float("nan"))),
    "p a string": lambda questions: answers(dict.fromkeys(questions, "0.97")),
}


@pytest.mark.parametrize("shape", sorted(GARBAGE))
def test_a_garbage_answer_is_malformed_and_mints_no_advice(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    shape: str,
) -> None:
    home = make_home(tmp_path, monkeypatch)
    fake = FakeJev(answer=GARBAGE[shape])
    ran = run(capsys, ["file", str(home.draft(ONE_CANDIDATE))], ask=fake)
    assert fake.calls == 1
    assert ran.code == 0
    assert ran.advice() == []
    assert ran.summary()["advise"] == "0"
    assert ran.summary()["jev"] == "unavailable:malformed"
    assert_silent(ran, THISTLE, *THISTLE_WORDS)


CLEAN = (
    "This change moves the check into its own package.\n"
    "It was tested at 0123456789abcdef0123456789abcdef01234567 and closes #312.\n"
    "Landed on 2026-10-05 with jev-1.13.0 pinned.\n"
    "Session 12 ends here.\n"
    "It sends nothing when nothing looks like a name.\n"
)


def test_a_clean_draft_with_no_candidates_asks_nothing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    make_home(tmp_path, monkeypatch)
    fake = FakeJev(p=0.97)
    ran = run(capsys, ["text", "--stdin"], ask=fake, stdin=CLEAN.encode())
    assert fake.calls == 0
    assert ran.code == 0
    assert ran.lines[:-1] == []
    summary = ran.summary()
    assert (summary["hits"], summary["advise"]) == ("0", "0")
    assert (summary["candidates"], summary["asked"], summary["jev"]) == ("0", "0", "off")


# A6: the candidate classes (a pure function).

FOUND = [
    ("an invented multi-word proper noun", "the walls of Willowbrook Tannery Annex were measured", None),
    ("a mixed code", "the column RC-14B was resized", "RC-14B"),
    ("a plot code", "the gate faces Plot 7B on the east", "7B"),
    ("a dimension with spaces", "the beam is 450 x 230 deep", "450X230"),
    ("a dimension without spaces", "the beam is 450x230 deep", "450X230"),
    ("a signed level", "the slab sits at +3.150 here", "+3.150"),
    ("a long coded number", "see sheet DWG-2231-04 for it", "DWG-2231-04"),
]


@pytest.mark.parametrize(("what", "sentence", "expected"), FOUND, ids=[row[0] for row in FOUND])
def test_extract_finds_each_candidate_class_on_its_line(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    what: str,
    sentence: str,
    expected: str | None,
) -> None:
    make_home(tmp_path, monkeypatch)
    module = candidates_module()
    want = squash(expected or "Willowbrook Tannery Annex")
    found = module.extract(f"A plain opening line.\n\n{sentence}.\n")
    assert all(isinstance(c.line, int) and isinstance(c.text, str) for c in found)
    assert [c.line for c in found if want in squash(c.text)] != [], f"{what} not found"
    assert all(c.line == 3 for c in found if want in squash(c.text)), f"{what} on the wrong line"


NOT_FOUND = [
    ("a sentence-initial common word", "Water runs down the drain"),
    ("a sha", "fixed at 0123456789abcdef0123456789abcdef01234567 today"),
    ("an issue number", "see #312 for it"),
    ("an iso date", "landed on 2026-10-05 here"),
    ("a version", "pinned to jev-1.13.0 now"),
    ("the factory's own words", "the Vextrus factory asks TypeSafe and Jev on GitHub"),
]


@pytest.mark.parametrize(("what", "sentence"), NOT_FOUND, ids=[row[0] for row in NOT_FOUND])
def test_extract_leaves_out_what_is_not_a_drawing_string(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, what: str, sentence: str
) -> None:
    make_home(tmp_path, monkeypatch)
    module = candidates_module()
    assert module.extract(f"{sentence}.\n") == [], f"{what} was taken for a candidate"


def test_the_factorys_own_words_are_listed_in_known_txt() -> None:
    known = Path(candidates_module().__file__).with_name("known.txt").read_text(encoding="utf-8")
    words = {line.strip() for line in known.splitlines()}
    assert {"Vextrus", "TypeSafe", "Jev", "GitHub"} <= words


def test_extract_leaves_out_an_allowlisted_candidate(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    home = make_home(tmp_path, monkeypatch)
    module = candidates_module()
    text = "the walls of Willowbrook Tannery Annex were measured.\n"
    assert module.extract(text) != [], "found before it is allowlisted"
    home.allowlist.write_text(digest(normalise("Willowbrook Tannery Annex")) + "\n")
    assert [c for c in module.extract(text) if "WILLOWBROOK" in normalise(c.text)] == []


def _many(count: int) -> str:
    """`count` distinct invented dimensions, one per line, in plain sentences."""
    return "".join(f"the beam on this line is {300 + i} x 230 deep.\n" for i in range(count))


def test_at_most_40_candidates_are_asked_and_the_choice_is_deterministic(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    make_home(tmp_path, monkeypatch)
    data = _many(50).encode()
    first, second = FakeJev(p=0.1), FakeJev(p=0.1)
    ran = run(capsys, ["text", "--stdin"], ask=first, stdin=data)
    again = run(capsys, ["text", "--stdin"], ask=second, stdin=data)
    assert first.calls == second.calls == 1, "one batched call"
    assert len(first.questions) == 40
    assert len(first.windows) == 40
    assert (first.state, first.questions) == (second.state, second.questions)
    summary = ran.summary()
    assert (summary["candidates"], summary["asked"], summary["jev"]) == ("50", "40", "ok")
    assert ran.out == again.out


def test_what_is_sent_is_one_bounded_window_per_question(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    make_home(tmp_path, monkeypatch)
    filler = "the survey team walked the whole site and wrote these notes down for the record. " * 6
    text = f"A long line follows.\n{filler}The walls of {THISTLE} were measured. {filler}\n"
    fake = FakeJev(p=0.97)
    ran = run(capsys, ["text", "--stdin"], ask=fake, stdin=text.encode())
    assert ran.code == 0
    assert len(fake.windows) == len(fake.questions) == 1
    window = fake.windows[0]
    assert len(window) <= WINDOW_MOST
    assert all(word in window.upper() for word in THISTLE_WORDS), "the window is around the candidate"
    assert normalise(filler) not in normalise(window), "never the whole line or draft"
    assert all(q.get("kind") == "noul" for q in fake.questions.values())
    assert request_size(fake) <= VEXTRUS_JEV_MAX_REQUEST_BYTES


def test_a_one_mib_draft_is_capped_before_it_is_sent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    make_home(tmp_path, monkeypatch)
    rows = []
    size, i = 0, 0
    while size < 1024 * 1024:
        row = f"Beam B{i} is {200 + i % 300} x 230 at +{i % 9}.150 in {THISTLE} on grid QX-{i}.\n"
        rows.append(row)
        size += len(row)
        i += 1
    fake = FakeJev(p=0.97)
    ran = run(capsys, ["text", "--stdin"], ask=fake, stdin="".join(rows).encode())
    assert ran.code == 0
    assert fake.calls == 1
    assert 1 <= len(fake.questions) <= 40
    assert len(fake.windows) == len(fake.questions)
    assert all(len(window) <= WINDOW_MOST for window in fake.windows)
    assert request_size(fake) <= VEXTRUS_JEV_MAX_REQUEST_BYTES
    assert ran.summary()["jev"] == "ok"
    assert_silent(ran, THISTLE, *THISTLE_WORDS)
