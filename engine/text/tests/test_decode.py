"""The one decode function: drawing text as a QS reads it, never a `%%` or a raw MTEXT code."""

import random
import re

import pytest

from engine.text.decode import MAX_PARAMETER, Run, decode, runs

# The codes decode consumes: a `%%` code, or an MTEXT backslash code (a letter AutoCAD reads as one).
RAW_CODE = re.compile(r"%%|\\[PNXLlOoKkACcFfHQTWpSU~{}]|\\M\+")


@pytest.mark.parametrize(
    ("raw", "decoded"),
    [
        ("%%C300", "\u2300300"),
        ("%%c300", "\u2300300"),
        ("45%%D", "45\u00b0"),
        ("%%P0.05", "\u00b10.05"),
        ("%%UBEAM%%U", "BEAM"),
        ("%%OTOP%%o", "TOP"),
        ("100%%%", "100%"),
        ("%%065%%066", "AB"),
        ("%%176", "\u00b0"),  # the drawing's code page: 176 is the degree sign
        ("LAST%%", "LAST"),
        ("%%ZX", "ZX"),  # an unknown code: its marker is dropped, its letter kept
        ("A^JB", "A\nB"),
        ("A^MB", "AB"),
        ("A^IB", "A B"),
        ("A\\U+00B0B", "A\u00b0B"),
        ("A\\U+ZZZZ", "A\\U+ZZZZ"),  # not a code point: a TEXT's backslash stays
        ("C:\\PATH", "C:\\PATH"),  # a TEXT's backslash is the drawing's own
    ],
)
def test_text_codes(raw: str, decoded: str) -> None:
    assert decode(raw) == decoded


@pytest.mark.parametrize(
    ("raw", "decoded"),
    [
        ("FIRST\\PSECOND", "FIRST\nSECOND"),
        ("{\\fArial|b1|i0|c0|p34;B1} (250 x 500)", "B1 (250 x 500)"),
        ("\\A1;\\H2.5;\\W0.8;\\Q15;\\T1.1;LABEL", "LABEL"),
        ("\\C1;RED \\c16711680;BLUE", "RED BLUE"),
        ("\\LUNDER\\l \\OOVER\\o \\KOUT\\k", "UNDER OVER OUT"),
        ("A\\~B", "A\u00a0B"),
        ("A\\\\B \\{C\\}", "A\\B {C}"),
        ("{{{NESTED}}}", "NESTED"),
        ('3\\S1/2;"', '31/2"'),
        ('3\\S1#2;"', '31/2"'),
        ("\\S+0.05^-0.02;", "+0.05 -0.02"),
        ("M\\S2^;", "M\u00b2"),
        ("X\\S^2;", "X\u2082"),
        ("\\pxi-3,l3,t4;ITEM", "ITEM"),
        ("%%C12 @ 150", "\u230012 @ 150"),
        ("A^JB", "A\nB"),
        ("A\\NB", "A\nB"),
        ("ROOM\\XSUB", "ROOM\nSUB"),
        (
            "\\M+18ABFX",
            "\u6f22X",
        ),  # a double-byte code in code page 1 (Japanese), as a bigfont stores it
        ("\\FROMANS.SHX|c0;NOTE", "NOTE"),
        ("\\ZZ", "ZZ"),  # an unknown letter: the backslash is dropped
        ("END\\", "END"),
    ],
)
def test_mtext_codes(raw: str, decoded: str) -> None:
    assert decode(raw, mtext=True) == decoded


def test_a_code_whose_parameter_never_ends_drops_only_its_marker() -> None:
    assert decode("\\H2.5 NO SEMICOLON", mtext=True) == "H2.5 NO SEMICOLON"


def test_an_overlong_parameter_is_bounded() -> None:
    raw = "\\f" + "A" * (MAX_PARAMETER + 10) + ";TAIL"
    decoded = decode(raw, mtext=True)
    assert "TAIL" in decoded
    assert not RAW_CODE.search(decoded)


def test_a_huge_nesting_of_braces_is_bounded() -> None:
    assert decode("{" * 100_000 + "DEEP" + "}" * 100_000, mtext=True) == "DEEP"


_TOKENS = [
    "%%c", "%%C", "%%d", "%%p", "%%u", "%%o", "%%", "%%1", "%%12", "%%123", "%%999", "%%x",
    "\\P", "\\N", "\\X", "\\L", "\\l", "\\O", "\\o", "\\K", "\\k", "\\~", "\\{", "\\}", "{", "}",
    "\\A1;", "\\C3;", "\\c255;", "\\H2.5;", "\\H0.5x;", "\\W0.8;", "\\Q10;", "\\T1.2;",
    "\\fArial|b1;", "\\Fromans.shx;", "\\pxqc;", "\\S1/2;", "\\S1#2;", "\\S1^2;", "\\S^;", "\\S",
    "\\U+00B0", "\\U+", "\\M+18ABF", "\\M+", "\\H", "\\f", "\\", "^J", "^M", "^I", "^",
    "A", "B", "7", " ", "/", ";", "#", "|", "x", "+",
]  # fmt: skip


@pytest.mark.parametrize("mtext", [True, False])
def test_no_decoded_string_holds_a_percent_code_or_a_raw_mtext_code(mtext: bool) -> None:
    """Random drawing text built from every code, whole and broken. The two escapes that stand for the
    characters themselves (`%%%` and `\\\\`) are left out: they decode to one `%` or `\\` on purpose."""
    chooser = random.Random(11)
    for _ in range(20_000):
        raw = "".join(chooser.choice(_TOKENS) for _ in range(chooser.randint(1, 12)))
        if "%%%" in raw or (mtext and "\\\\" in raw):
            continue
        decoded = decode(raw, mtext=mtext)
        if not mtext:
            # A TEXT keeps backslashes as the drawing's own characters (only \U+ and \M+ are codes).
            assert "%%" not in decoded, (raw, decoded)
            continue
        assert not RAW_CODE.search(decoded), (raw, decoded)
        assert "\\" not in decoded, (raw, decoded)


def test_runs_carry_the_formatting_the_renderer_draws() -> None:
    found = runs("{\\fArial|b1|i1;BOLD}\\PPLAIN \\H2x;BIG \\H3.5;ABS \\C1;RED \\S1/2;")
    text = [(r.text, r.style.font, r.style.bold, r.style.italic) for r in found if r.text != "\n"]
    assert text[0] == ("BOLD", "Arial", True, True)
    assert text[1] == ("PLAIN ", None, False, False)
    by_text = {r.text: r for r in found}
    assert by_text["BIG "].style.scale == 2.0
    assert by_text["ABS "].style.height == 3.5
    assert by_text["ABS "].style.scale == 1.0
    assert by_text["RED "].style.colour == 1
    stacked = [r for r in found if r.stack is not None]
    assert stacked[0].stack == ("1", "2", "/")
    assert [r.text for r in found].count("\n") == 1


def test_runs_join_to_decode() -> None:
    raw = "{\\fArial;A}\\PB\\S1/2;%%c%%d"
    assert "".join(r.plain for r in runs(raw)) == decode(raw, mtext=True)


def test_a_run_holds_no_code() -> None:
    for run in runs("\\LU\\l%%uX%%u"):
        assert isinstance(run, Run)
        assert not RAW_CODE.search(run.text)
