"""publish's PR body and the allowlist batch's hits parser, at their seams."""

import pytest

from scripts.factory.allowlist import parse
from scripts.factory.publish import Refused, pr_body

MESSAGE = (
    "S99-X1: the widget\n"
    "\n"
    "Closes #9.\n"
    "\n"
    "## Cut\n"
    "None.\n"
    "\n"
    "Factory-State: READY\n"
    "Factory-Verify: " + "a" * 40 + " ok\n"
    "\n"
    "Co-Authored-By: Someone <x@example.invalid>\n"
    "Claude-Session: https://example.invalid/s\n"
)


def test_the_body_is_the_message_after_its_subject_without_trailers() -> None:
    title, body = pr_body(MESSAGE, "b" * 40)
    assert title == "S99-X1: the widget"
    assert body.startswith("Closes #9.\n\n## Cut\nNone.\n\n")
    lowered = body.lower()
    assert "factory-" not in lowered
    assert "co-authored-by" not in lowered
    assert "claude-session" not in lowered
    assert "\n\n\n" not in body
    assert body.endswith("from " + "b" * 40 + ", its range leak-scanned.\n")


def test_a_long_subject_is_cut_to_seventy_two_characters() -> None:
    title, _ = pr_body("x" * 100 + "\n\nbody\n", "c" * 40)
    assert title == "x" * 72


def test_the_hits_file_skips_blanks_and_comments() -> None:
    hits = parse("# judged public\n\ns1:docs/a.md:3\ns2:b c/d.txt:12\n")
    assert [(h.number, h.branch, h.path, h.line) for h in hits] == [
        (3, "s1", "docs/a.md", 3),
        (4, "s2", "b c/d.txt", 12),
    ]


@pytest.mark.parametrize(
    "text",
    [
        "docs/a.md:3",
        "s1:docs/a.md:0",
        "s1:docs/a.md:x",
        "s1:/etc/passwd:1",
        "s1:a/../../b:1",
        "s1:./a.md:1",
        "s1:a\\b.md:1",
    ],
)
def test_any_bad_hits_line_refuses_the_batch(text: str) -> None:
    with pytest.raises(Refused):
        parse(text + "\ns1:docs/a.md:3\n")


def test_a_hits_file_with_no_location_is_refused() -> None:
    with pytest.raises(Refused):
        parse("# nothing judged\n\n")
