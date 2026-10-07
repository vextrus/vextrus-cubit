"""Ticket S15-W0's acceptance tests: the takeoff catalogue split by screen area, each piece small,
and the words lint (`tools/lint/words.py`, web.yml's "words" step over every shipped catalogue's
English) still reading every piece.

The takeoff catalogues are every `.po` file under `web/src/takeoff/` (the ticket owns "web takeoff
locales"): today one, `web/src/takeoff/locales/en.po`, 2629 lines and 644 messages, edited by 55 commits
since 25 Sep 2026, the web's hottest file (.private discovery 03, section 6).

The bound, 800 lines a catalogue (`wc -l`, the header included):
- Lingui extracts whole source files and the ticket changes no string, so a catalogue can be no smaller
  than its largest file's messages: `takeoff/words.tsx` alone yields 167 messages, about 690 lines;
- 800 leaves that file room for some 25 more messages (about four lines each) before it must split too;
- 800 is under a third of 2629, so the split makes at least four catalogues, never two halves that
  would stay hot; every other shipped chrome catalogue is under 310 lines today.
"""

from pathlib import Path

from tools.lint.words import catalogues

REPO = Path(__file__).resolve().parents[5]
TAKEOFF = REPO / "web/src/takeoff"
MOST_LINES = 800


def takeoff_catalogues() -> list[Path]:
    return sorted(TAKEOFF.rglob("*.po"))


def test_no_takeoff_catalogue_is_over_800_lines() -> None:
    found = takeoff_catalogues()
    assert found, "no catalogue under web/src/takeoff/"
    over = [
        f"{path.relative_to(REPO).as_posix()}: {lines} lines, over the bound of {MOST_LINES}"
        for path in found
        if (lines := len(path.read_text(encoding="utf-8").splitlines())) > MOST_LINES
    ]
    assert over == [], "; ".join(over)


def test_the_words_lint_reads_every_takeoff_catalogue() -> None:
    read = set(catalogues(REPO))
    found = takeoff_catalogues()
    assert found, "no catalogue under web/src/takeoff/"
    unread = [path.relative_to(REPO).as_posix() for path in found if path not in read]
    assert unread == [], f"takeoff catalogues the words lint does not read: {unread}"
