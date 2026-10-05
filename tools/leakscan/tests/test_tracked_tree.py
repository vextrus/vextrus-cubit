"""The real checkout tracks no drawing and nothing under `.private/` (spec 5; f2).

It needs no corpus: it runs in CI on every push."""

from pathlib import Path

from tools.leakscan import tree

ROOT = Path(__file__).resolve().parents[3]


def test_the_tracked_tree_holds_no_drawing_and_nothing_private() -> None:
    assert [str(violation) for violation in tree.check(ROOT)] == []


def test_the_check_reads_the_tracked_files() -> None:
    # A check that read nothing would pass vacuously: the guard's own file is tracked and clean.
    assert (ROOT / ".claude/hooks/guard.mjs").is_file()
    assert tree._drawing_magic(b"AC1032\x00") is not None
    assert tree._drawing_magic(b"  0\nSECTION\n") is not None
    assert tree._drawing_magic(b"print('x')\n") is None
