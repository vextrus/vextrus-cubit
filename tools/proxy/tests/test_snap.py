"""The proxy beyond T-249's acceptance tests: the cache refuses a reader hash that is not hex and a
folder others may write (no pickle is loaded from it), keeps a None reading as a hit, never loads an
entry it did not write whole; the CLI writes a document with no DWG, and with two workers. Invented
bytes only; nothing reads a DWG."""

import dataclasses
import hashlib
import json
import os
from pathlib import Path
from typing import Any

import pytest

from tools.proxy import snap
from tools.proxy.cache import CacheError, DecodeCache, reader_hash

HASH = "0a" * 32


def test_a_reader_hash_that_is_not_hex_is_refused(tmp_path: Path) -> None:
    for hashed in ("../escape", "", "AB" * 32, "zz" * 32):
        with pytest.raises(CacheError):
            DecodeCache(tmp_path, hashed)


def test_a_folder_others_may_write_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "qx-one.dwg"
    path.write_bytes(b"made-up bytes")
    DecodeCache(tmp_path / "cache", HASH).get(path, lambda p: 1)
    os.chmod(tmp_path / "cache" / HASH, 0o777)

    with pytest.raises(CacheError):
        DecodeCache(tmp_path / "cache", HASH).get(path, lambda p: 2)


def test_a_none_reading_is_kept_and_hits(tmp_path: Path) -> None:
    path = tmp_path / "qx-none.dwg"
    path.write_bytes(b"made-up bytes read as nothing")
    calls: list[Path] = []

    def read(p: Path) -> None:
        calls.append(p)

    DecodeCache(tmp_path / "cache", HASH).get(path, read)
    again = DecodeCache(tmp_path / "cache", HASH)

    assert again.get(path, read) is None
    assert (again.hits, len(calls)) == (1, 1)


def test_an_entry_with_a_wrong_digest_is_never_unpickled(tmp_path: Path) -> None:
    path = tmp_path / "qx-swapped.dwg"
    path.write_bytes(b"made-up bytes")
    DecodeCache(tmp_path / "cache", HASH).get(path, lambda p: "made-up reading")
    [entry] = (tmp_path / "cache" / HASH).iterdir()
    data = entry.read_bytes()
    entry.write_bytes(data[:32] + b"\x80\x04K\x07.")  # a valid pickle, but not the one hashed

    again = DecodeCache(tmp_path / "cache", HASH)
    assert again.get(path, lambda p: "read again") == "read again"
    assert (again.hits, again.misses) == (0, 1)


def test_the_reader_hash_ignores_compiled_files_and_hidden_folders(tmp_path: Path) -> None:
    (tmp_path / "engine" / "read").mkdir(parents=True)
    (tmp_path / "engine" / "__init__.py").write_text("")
    (tmp_path / "engine" / "read" / "__init__.py").write_text("X = 1\n")
    before = reader_hash(tmp_path)
    (tmp_path / "engine" / "read" / "__pycache__").mkdir()
    (tmp_path / "engine" / "read" / "__pycache__" / "x.pyc").write_bytes(b"made-up")
    (tmp_path / ".hidden").mkdir()
    (tmp_path / ".hidden" / "__init__.py").write_text("")

    assert reader_hash(tmp_path) == before


def _fake(path: Path, decoded: Any, **finders: Any) -> dict[str, Any]:
    return {"sha256": hashlib.sha256(Path(path).read_bytes()).hexdigest(), "sheets": []}


def test_a_set_with_no_dwg_writes_an_empty_document(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    folder = tmp_path / "made-up-set"
    folder.mkdir()
    (folder / "qx-only.pdf").write_bytes(b"%PDF-1.7\n")
    out = tmp_path / "views.json"

    code = snap.main(["--set", str(folder), "--out", str(out), "--cache", str(tmp_path / "c")])

    assert code == 0
    document = json.loads(out.read_text())
    assert document["files"] == []
    assert document["version"] == 1
    said = capfd.readouterr()
    assert "files 0, sheets 0, views 0" in said.out
    assert "qx-only.pdf" in said.err


def test_two_workers_fail_the_run_when_a_read_fails(tmp_path: Path) -> None:
    """Two worker processes running the engine's own read on bytes that are not a DWG: its
    ReadError reaches the CLI, which writes no half a set."""
    from engine.read.errors import ReadError

    folder = tmp_path / "made-up-set"
    (folder / "sub").mkdir(parents=True)
    for name in ("b.dwg", "sub/a.DWG"):
        (folder / name).write_bytes(b"not a drawing at all")
    out = tmp_path / "views.json"
    argv = ["--set", str(folder), "--out", str(out), "--cache", str(tmp_path / "c"), "--workers", "2"]

    with pytest.raises(ReadError):
        snap.main(argv)
    assert not out.exists()


def test_one_worker_keeps_the_sets_order(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    folder = tmp_path / "made-up-set"
    (folder / "sub").mkdir(parents=True)
    for name in ("b.dwg", "sub/a.DWG", ".hidden.dwg"):
        (folder / name).write_bytes(name.encode())
    monkeypatch.setattr(snap, "snapshot", _fake)
    out = tmp_path / "views.json"

    assert (
        snap.main(
            ["--set", str(folder), "--out", str(out), "--workers", "1", "--cache", str(tmp_path / "c")]
        )
        == 0
    )

    assert [f["path"] for f in json.loads(out.read_text())["files"]] == ["b.dwg", "sub/a.DWG"]


# The refuter's findings (T-249, 60 and 30): a reading carries its file's name, and a file can
# change while it is read.


@dataclasses.dataclass(frozen=True)
class Summary:
    source_name: str


@dataclasses.dataclass(frozen=True)
class Artefact:
    summary: Summary


def test_a_hit_under_another_name_gives_the_finders_that_files_own_name(tmp_path: Path) -> None:
    names: list[str] = []

    def find_sheets(artefact: Artefact) -> list[object]:
        names.append(artefact.summary.source_name)
        return []

    cache = DecodeCache(tmp_path / "cache", HASH)
    for name in ("qx-first-R1.dwg", "qx-second-R2.dwg"):
        (tmp_path / name).write_bytes(b"the same made-up bytes")
        snap.snapshot(
            tmp_path / name,
            cache,
            read=lambda p: Artefact(Summary(snap.NEUTRAL)),
            find_sheets=find_sheets,
            find_views=lambda a, s: [],
        )

    assert names == ["qx-first-R1.dwg", "qx-second-R2.dwg"]
    assert (cache.hits, cache.misses) == (1, 1)
    for entry in (tmp_path / "cache").rglob("*"):
        assert b"qx-first" not in (entry.read_bytes() if entry.is_file() else b"")


def test_the_engine_is_read_under_the_neutral_name(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import engine.read

    given: dict[str, Any] = {}

    def read(path: Path, **kwargs: Any) -> str:
        given.update(kwargs)
        return "made-up"

    monkeypatch.setattr(engine.read, "read", read)

    assert snap.engine_read(tmp_path / "qx-named.dwg") == "made-up"
    assert given == {"source_name": snap.NEUTRAL}


def test_a_file_changed_while_it_is_read_is_not_kept(tmp_path: Path) -> None:
    path = tmp_path / "qx-moving.dwg"
    path.write_bytes(b"made-up bytes before")

    def read(p: Path) -> bytes:
        found = p.read_bytes()
        p.write_bytes(b"made-up bytes after the edit")
        return found

    DecodeCache(tmp_path / "cache", HASH).get(path, read)
    path.write_bytes(b"made-up bytes before")
    again = DecodeCache(tmp_path / "cache", HASH)

    assert again.get(path, lambda p: b"read again") == b"read again"
    assert (again.hits, again.misses) == (0, 1)
