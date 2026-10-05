"""Ticket T-249 (PR A), A4 cases 1-6: the proxy's decode cache is keyed by the file's content and the
reader's code, never by its path (section 3, A4; `verified-measures.md` §4.4: session 12's throwaway
proxy named `CACHE / sha256(path)[:12]`, so a renamed or edited file was a stale hit or a miss).

Invented bytes and invented source trees in `tmp_path` only; nothing reads a DWG.
"""

from pathlib import Path
from typing import Any

import pytest

from .seams import HEX, cache, files_under, import_closure

HASH_A = "ab" * 32
HASH_B = "cd" * 32


class Reads:
    """A stand-in reader that records each path it is called with and returns the file's text."""

    def __init__(self) -> None:
        self.paths: list[Path] = []

    def __call__(self, path: Path) -> dict[str, Any]:
        self.paths.append(path)
        return {"made_up_reading": path.read_bytes().decode()}


def test_the_same_bytes_under_another_path_are_a_hit(tmp_path: Path) -> None:
    root = tmp_path / "cache"
    first, second = tmp_path / "one" / "qx-first.dwg", tmp_path / "two" / "qx-renamed.dwg"
    for path in (first, second):
        path.parent.mkdir()
        path.write_bytes(b"invented drawing bytes, version 1")
    reads = Reads()
    decoded = cache().DecodeCache(root, HASH_A)

    assert decoded.get(first, reads) == {"made_up_reading": "invented drawing bytes, version 1"}
    assert decoded.get(second, reads) == {"made_up_reading": "invented drawing bytes, version 1"}

    assert reads.paths == [first]
    assert (decoded.hits, decoded.misses) == (1, 1)


def test_changed_content_at_the_same_path_is_a_miss(tmp_path: Path) -> None:
    root = tmp_path / "cache"
    path = tmp_path / "qx-edited.dwg"
    path.write_bytes(b"invented drawing bytes, before")
    reads = Reads()
    decoded = cache().DecodeCache(root, HASH_A)
    decoded.get(path, reads)

    path.write_bytes(b"invented drawing bytes, after the edit")

    assert decoded.get(path, reads) == {"made_up_reading": "invented drawing bytes, after the edit"}
    assert reads.paths == [path, path]
    assert (decoded.hits, decoded.misses) == (0, 2)


def test_changed_reader_code_is_a_miss_and_the_old_entry_stays(tmp_path: Path) -> None:
    root = tmp_path / "cache"
    path = tmp_path / "qx-same.dwg"
    path.write_bytes(b"invented drawing bytes, unchanged")
    reads = Reads()
    cache().DecodeCache(root, HASH_A).get(path, reads)

    newer = cache().DecodeCache(root, HASH_B)
    newer.get(path, reads)
    older = cache().DecodeCache(root, HASH_A)
    older.get(path, reads)

    assert len(reads.paths) == 2
    assert (newer.hits, newer.misses) == (0, 1)
    assert (older.hits, older.misses) == (1, 0)


# The reader hash follows the import closure of engine/read --------------------------------------------

TREE = {
    "engine/__init__.py": "",
    "engine/read/__init__.py": (
        "from .a import first\n"
        "\n"
        "\n"
        "def later() -> int:\n"
        "    from engine.read import b\n"
        "\n"
        "    return b.second()\n"
        "\n"
        "\n"
        'TARGET = "engine.read.c:go"\n'
    ),
    "engine/read/a.py": "def first() -> int:\n    return 1\n",
    "engine/read/b.py": "def second() -> int:\n    return 2\n",
    "engine/read/c.py": "def go() -> int:\n    return 3\n",
    "engine/read/tests/__init__.py": "",
    "engine/read/tests/test_a.py": (
        "from engine.read import a\n\n\ndef test_a() -> None:\n    a.first()\n"
    ),
    "engine/recognise/__init__.py": "",
    "engine/recognise/frames.py": "from engine.read import a\n\nFRAMES = 2\n",
}


def write_tree(root: Path) -> None:
    for name, text in TREE.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)


def test_the_closure_follows_imports_function_imports_and_string_targets(tmp_path: Path) -> None:
    write_tree(tmp_path)

    def read(name: str) -> bytes | None:
        path = tmp_path / name
        return path.read_bytes() if path.is_file() else None

    found = import_closure().closure(read, ["engine/read/__init__.py"], sorted(TREE))

    assert {
        "engine/read/__init__.py",
        "engine/read/a.py",
        "engine/read/b.py",
        "engine/read/c.py",
    } <= set(found)
    assert "engine/recognise/frames.py" not in found
    assert "engine/read/tests/test_a.py" not in found
    assert isinstance(found, frozenset)


@pytest.mark.parametrize(
    ("edited", "moves"),
    [
        ("engine/read/a.py", True),  # imported
        ("engine/read/b.py", True),  # imported inside a function
        ("engine/read/c.py", True),  # named only by a string target
        ("engine/recognise/frames.py", False),  # unrelated (it imports the reader; not the reverse)
        ("engine/read/tests/test_a.py", False),  # a test
    ],
)
def test_the_reader_hash_follows_the_closure_of_engine_read(
    edited: str, moves: bool, tmp_path: Path
) -> None:
    write_tree(tmp_path)
    before = cache().reader_hash(tmp_path)

    path = tmp_path / edited
    path.write_text(path.read_text() + "\nEDITED = True\n")

    assert isinstance(before, str)
    assert before
    assert (cache().reader_hash(tmp_path) != before) is moves


# No half entries, no names ----------------------------------------------------------------------------


class Midway(Exception):
    """Raised by a stand-in partway through."""


class Unpicklable:
    def __reduce__(self) -> Any:
        raise Midway


def test_a_truncated_entry_is_a_miss_and_is_replaced(tmp_path: Path) -> None:
    root = tmp_path / "cache"
    path = tmp_path / "qx-truncated.dwg"
    path.write_bytes(b"invented drawing bytes to be cut")
    reads = Reads()
    cache().DecodeCache(root, HASH_A).get(path, reads)
    [entry] = files_under(root)
    whole = (root / entry).read_bytes()
    (root / entry).write_bytes(whole[: len(whole) // 2])

    again = cache().DecodeCache(root, HASH_A)
    assert again.get(path, reads) == {"made_up_reading": "invented drawing bytes to be cut"}
    assert (again.hits, again.misses) == (0, 1)

    last = cache().DecodeCache(root, HASH_A)
    assert last.get(path, reads) == {"made_up_reading": "invented drawing bytes to be cut"}
    assert (last.hits, last.misses) == (1, 0)
    assert len(reads.paths) == 2


def test_a_read_that_fails_midway_leaves_no_entry(tmp_path: Path) -> None:
    root = tmp_path / "cache"
    path = tmp_path / "qx-failing.dwg"
    path.write_bytes(b"invented drawing bytes that fail")

    def fails(_path: Path) -> object:
        raise Midway

    with pytest.raises(Midway):
        cache().DecodeCache(root, HASH_A).get(path, fails)

    assert not root.exists() or files_under(root) == []


def test_a_write_that_fails_midway_leaves_no_partial_entry(tmp_path: Path) -> None:
    root = tmp_path / "cache"
    path = tmp_path / "qx-half-written.dwg"
    path.write_bytes(b"invented drawing bytes, half written")
    other = tmp_path / "qx-written.dwg"
    other.write_bytes(b"invented drawing bytes, written whole")
    cache().DecodeCache(root, HASH_A).get(other, Reads())
    before = files_under(root)

    with pytest.raises(Midway):
        cache().DecodeCache(root, HASH_A).get(path, lambda _p: ["a big part" * 10_000, Unpicklable()])

    assert files_under(root) == before
    reads = Reads()
    later = cache().DecodeCache(root, HASH_A)
    assert later.get(path, reads) == {"made_up_reading": "invented drawing bytes, half written"}
    assert (later.hits, later.misses) == (0, 1)


def test_the_cache_holds_no_drawing_file_name(tmp_path: Path) -> None:
    root = tmp_path / "cache"
    path = tmp_path / "qxnamemarker-31.dwg"
    path.write_bytes(b"invented drawing bytes with a marked name")
    decoded = cache().DecodeCache(root, HASH_A)

    decoded.get(path, lambda p: {"made_up_reading": len(p.read_bytes())})

    found = files_under(root)
    assert found
    for relative in found:
        for part in relative.parts:
            assert HEX.fullmatch(part.split(".", 1)[0]), relative  # names are hex of the key
        assert b"qxnamemarker" not in (root / relative).read_bytes()
        assert "qxnamemarker" not in str(relative)
    assert (decoded.hits, decoded.misses) == (0, 1)
