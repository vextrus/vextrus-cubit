"""Ticket T-LEAK-CORPUS (session 12 phase 6): the real `build` skips test output and agents' review
scratch in the notes folder, prints per-source counts after the skips, and every folder kind under the
notes folder has a declared rule (`sources.WORK_RULES`); an unknown kind is read, counted and reported.

Real-source seam: `build` without `--source`, with `VEXTRUS_MAIN_CHECKOUT=<tmp>/main` (the notes live in
`<tmp>/main/.private/work/`) and `HOME=<tmp>/home` (no exports). Every corpus string here is INVENTED:
the `_leak` literals, upper-cased (drawing-like), each with its own block letter so that no literal is a
part of another. Assertion messages name fixture paths, never a literal (test output is itself a note).
"""

import importlib
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

from ._leak import INDIGO, MARIGOLD, SAFFRON, ZEBRA, Leak, assert_no_text

_BASES = [ZEBRA.upper(), MARIGOLD.upper(), SAFFRON.upper(), INDIGO.upper()]
SOURCE = re.compile(r"^source (\w+): (\d+) strings read, (\d+) kept, (\d+) files skipped$")
UNRULED = re.compile(r"^leakscan: work folders without a rule: (\d+)$")


def literal(n: int) -> str:
    """The n-th invented drawing-like literal (distinct, none a substring of another)."""
    return f"{_BASES[n % len(_BASES)]} BLOCK {chr(ord('A') + n)}"


# The test output and scratch notes of section 3 item 1: each file's literal must stay out.
PYTEST_LOG = "session-1/f2/pytest-out.md"
SKIPPED_NOTES = [
    PYTEST_LOG,
    "session-1/f2/red-on-main.md",
    "session-1/f2/green.md",
    "session-1/f2/tail.md",
    "session-1/review/slot/r.md",
    "session-1/scratch-1r/notes.md",
    "session-1/zzz/CLAUDE.md",
    "session-1/zzz/docs/a.md",
]
REAL_NOTES = ["session-1/measures/q.md", "factory/notes/n.md"]
# Item 2: names beside the skipped ones that are notes all the same.
NEAR_NOTES = [
    "session-1/review-plan.md",
    "session-1/design/redesign.md",
    "session-1/f2/greenfield.md",
]
WALK_NOTE = f"walks/{'ab12' * 10}/n.md"
LINK_NOTE = "outside/n.md"
UNKNOWN_NOTE = "mystery-kind/x.md"

_LITERALS = {
    path: literal(n)
    for n, path in enumerate(
        [*SKIPPED_NOTES, *REAL_NOTES, *NEAR_NOTES, WALK_NOTE, LINK_NOTE, UNKNOWN_NOTE]
    )
}

TOP_KINDS = [
    "factory",
    "jev-system-one",
    "leakscan",
    "renders",
    "review",
    "review-m1-plan",
    "session-12",
    "sheets",
    "walks",
    "walks-smoke",
    "walk-expect",
    "worktree-leftovers",
    "proto-2d-bim",
    "t158-gate",
    ".convert",
]
SESSION_KINDS = [
    "f5",
    "review",
    "ledger",
    "launches",
    "scratch-247-r1",
    "phase6",
    "walk2",
    "premerge-9",
]
# Words of the contract's own output lines; every other fixture folder name must never be printed.
_OUTPUT_WORDS = {"notes", "walks", "leakscan"}


def _body(path: str) -> str:
    """A note's text: its literal, with pytest's marker lines around it for the two test logs."""
    value = _LITERALS[path]
    if path == PYTEST_LOG:
        return f"============ test session starts ============\n{value}\n=== 3 passed in 0.1s ===\n"
    if path == "session-1/f2/tail.md":
        return (
            "============================= test session starts ==============================\n"
            f"{value}\n"
            "=========================== short test summary info ============================\n"
            "FAILED tools/x/test_y.py::test_z - assert 1 == 2\n"
        )
    return f"{value}\n"


class Notes:
    """A main checkout under `<tmp>/main` whose notes folder is built from fixture paths."""

    def __init__(self, tmp: Path) -> None:
        self.leak = Leak(tmp)
        self.main = tmp / "main"
        self.work = self.main / ".private/work"
        self.user_home = tmp / "home"
        self.work.mkdir(parents=True)
        self.user_home.mkdir()
        self.folders: set[str] = set()

    def note(self, path: str, root: Path | None = None) -> None:
        target = (root or self.work) / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(_body(path))
        self.folders |= set(Path(path).parent.parts)

    def tree_of_item_1(self) -> None:
        for path in [*SKIPPED_NOTES, *REAL_NOTES]:
            self.note(path)
        (self.work / "session-1/zzz/pyproject.toml").write_text('[project]\nname = "copy"\n')

    def layout(self, work: Path) -> None:
        for name in TOP_KINDS:
            (work / name).mkdir(parents=True, exist_ok=True)
        for name in SESSION_KINDS:
            (work / "session-12" / name).mkdir(parents=True, exist_ok=True)
        self.folders |= {*TOP_KINDS, *SESSION_KINDS}

    def build(self) -> subprocess.CompletedProcess[str]:
        done = subprocess.run(
            [sys.executable, "-m", "tools.leakscan", "build"],
            cwd=self.leak.tmp,
            env={
                **self.leak.env(),
                "VEXTRUS_MAIN_CHECKOUT": str(self.main),
                "HOME": str(self.user_home),
            },
            capture_output=True,
            text=True,
            check=False,
        )
        assert done.returncode == 0, f"build exited {done.returncode}: {done.stderr[-300:]}"
        assert_no_text(done)
        return done

    def in_corpus(self, path: str) -> bool:
        done = self.leak.run("text", "--stdin", "--no-stamp", stdin=f"{_LITERALS[path]}\n")
        assert done.returncode in (0, 1), f"text scan exited {done.returncode} for {path}"
        return done.returncode == 1

    def present(self, paths: list[str]) -> list[str]:
        return [path for path in paths if self.in_corpus(path)]


def _lines(done: subprocess.CompletedProcess[str]) -> list[str]:
    return [line for line in done.stdout.splitlines() if line.strip()]


def _sources(done: subprocess.CompletedProcess[str]) -> dict[str, list[tuple[int, int, int]]]:
    found: dict[str, list[tuple[int, int, int]]] = {}
    for line in _lines(done):
        match = SOURCE.match(line)
        if match:
            found.setdefault(match[1], []).append((int(match[2]), int(match[3]), int(match[4])))
    return found


def test_notes_in_test_output_and_review_scratch_add_no_corpus_string(tmp_path: Path) -> None:
    notes = Notes(tmp_path)
    notes.tree_of_item_1()
    notes.build()
    assert notes.present(SKIPPED_NOTES) == [], "test output or review scratch entered the corpus"
    assert notes.present(REAL_NOTES) == REAL_NOTES, "a real note was left out"


def test_a_real_notes_literal_beside_skipped_names_still_enters(tmp_path: Path) -> None:
    notes = Notes(tmp_path)
    notes.tree_of_item_1()
    for path in NEAR_NOTES:
        notes.note(path)
    notes.build()
    assert notes.present(NEAR_NOTES) == NEAR_NOTES, "a skip glob over-matched a real note"
    assert notes.present(REAL_NOTES) == REAL_NOTES


def test_build_prints_per_source_counts_after_the_skips(tmp_path: Path) -> None:
    notes = Notes(tmp_path)
    notes.tree_of_item_1()
    done = notes.build()
    counts = _sources(done)
    assert "notes" in counts, (
        f"no 'source notes: <r> strings read, <k> kept, <s> files skipped' line: {_lines(done)}"
    )
    assert len(counts["notes"]) == 1, "more than one notes line"
    read, kept, skipped = counts["notes"][0]
    assert (read, kept) == (len(REAL_NOTES), len(REAL_NOTES))
    assert skipped >= 6, f"only {skipped} files skipped"

    notes.note(WALK_NOTE)
    done = notes.build()
    counts = _sources(done)
    assert len(counts.get("walks", [])) == 1, f"no single walks line of the same shape: {_lines(done)}"
    assert len(counts.get("notes", [])) == 1


def test_every_work_folder_kind_has_a_declared_rule(tmp_path: Path) -> None:
    # The seams of section 3, fixed by the ticket; until they exist this test fails on the lookup.
    sources: Any = importlib.import_module("tools.leakscan.sources")
    unclassified_work_folders = sources.unclassified_work_folders
    work_rule = sources.work_rule

    notes = Notes(tmp_path)
    work = tmp_path / "work"
    notes.layout(work)
    assert unclassified_work_folders(work) == []
    assert [name for name in TOP_KINDS if work_rule(name) is None] == []
    (work / "mystery-kind").mkdir()
    assert unclassified_work_folders(work) == ["mystery-kind"]
    assert work_rule("mystery-kind") is None
    assert sources.WORK_RULES, "no rule is declared"
    for glob, action, reason in sources.WORK_RULES:
        assert action in ("read", "skip"), f"rule {glob}: action {action}"
        assert reason.strip(), f"rule {glob} gives no reason"

    notes.layout(notes.work)
    notes.tree_of_item_1()
    notes.note(UNKNOWN_NOTE)
    done = notes.build()
    unruled = [line for line in _lines(done) if UNRULED.match(line)]
    assert unruled == ["leakscan: work folders without a rule: 1"]
    assert notes.present([UNKNOWN_NOTE]) == [UNKNOWN_NOTE], "an unknown folder kind was not read"


def test_a_symlink_is_not_followed_and_no_folder_name_is_printed(tmp_path: Path) -> None:
    notes = Notes(tmp_path)
    notes.layout(notes.work)
    notes.tree_of_item_1()
    for path in [*NEAR_NOTES, WALK_NOTE, UNKNOWN_NOTE]:
        notes.note(path)
    notes.note(LINK_NOTE, root=tmp_path)
    (notes.work / "session-1/link").symlink_to(tmp_path / "outside", target_is_directory=True)
    notes.folders |= {"link", "outside", "zzz", "docs"}
    done = notes.build()
    assert notes.present([LINK_NOTE]) == [], "a symlinked folder was followed"
    names = {name.lower() for name in notes.folders} - _OUTPUT_WORDS
    for stream in (done.stdout, done.stderr):
        tokens = {token.lower() for token in re.split(r"[\s:,=/()]+", stream) if token}
        assert sorted(tokens & names) == [], "build printed a folder name"
