"""The proxy's snapshot of a Drawing Set (ticket T-249, A4; the rewrite in git of session 12's
throwaway): each DWG read and its sheets and views found by the engine alone, no Plot, render,
database or Jev, so a reading change's views can be compared in seconds rather than a scored run's
half hour.

    python -m tools.proxy.snap --set <folder> --out <views.json> [--cache DIR] [--workers 2]

Only DWGs are read (a PDF or any other file is skipped, and said so). Each file's reading goes through
the decode cache (`tools.proxy.cache.DecodeCache`, keyed by the file's sha256 and the reader's code
hash); the finders run every time, on the head's code. The document is
`{"version": 1, "reader_hash", "files": [{"path", "sha256", "sheets": [...]}]}`, a sheet with its
`location {layout, box}`, its six title-block fields as the export writes them (`{value, source}` or
null), its `paper` where the view finder gives one, and its views' `kind`, `box` and `title`; boxes
as the export writes them (`Box.to_json`). The document holds drawing text: it stays under `.private/`.
The screen gets counts and seconds only, and the names of the files skipped.
"""

import argparse
import dataclasses
import hashlib
import json
import os
import sys
import time
from collections.abc import Callable, Mapping, Sequence
from concurrent.futures import ProcessPoolExecutor
from functools import partial
from pathlib import Path
from typing import Any

from tools.proxy.cache import DecodeCache, file_sha256, reader_hash

ROOT = Path(__file__).resolve().parents[2]
DWG = ".dwg"
NEUTRAL = "drawing.dwg"
"""The source name a reading is made and kept under (see `_named`)."""
FIELDS = ("number", "title", "discipline", "revision_mark", "issue_date", "storeys_as_stated")


def snapshot(
    path: Path,
    cache: DecodeCache,
    *,
    read: Callable[[Path], Any],
    find_sheets: Callable[[Any], Sequence[Any]],
    find_views: Callable[[Any, Any], Sequence[Any]],
) -> dict[str, Any]:
    """One DWG's snapshot: its sha256, and its sheets and views as the finders give them."""
    artefact = _named(cache.get(Path(path), read), Path(path).name)
    sheets = []
    for sheet in find_sheets(artefact):
        views = find_views(artefact, sheet)
        paper = getattr(views, "paper", None)
        sheets.append(
            {
                "location": {
                    "layout": sheet.location.layout,
                    "box": _box(sheet.location.box),
                },
                **{name: _sourced(getattr(sheet, name, None)) for name in FIELDS},
                "paper": None if paper is None else [paper[0], paper[1]],
                "views": [
                    {"kind": str(view.kind), "box": _box(view.box), "title": view.title}
                    for view in views
                ],
            }
        )
    return {"sha256": file_sha256(Path(path)), "sheets": sheets}


def _named(artefact: Any, name: str) -> Any:
    """The reading with the file's own name as its source name: a reading is kept by its bytes, read
    under NEUTRAL (so the cache holds no file name, and the same bytes under another name hit), while
    the sheet finder reads a revision mark from the name, so each file's own goes back on."""
    summary: Any = getattr(artefact, "summary", None)
    if not dataclasses.is_dataclass(artefact) or not dataclasses.is_dataclass(summary):
        return artefact
    if not hasattr(summary, "source_name") or isinstance(summary, type):
        return artefact
    renamed = dataclasses.replace(summary, source_name=name)
    return dataclasses.replace(artefact, summary=renamed)  # type: ignore[type-var]


def _box(box: Any) -> list[float] | None:
    return None if box is None else list(box.to_json())


def _sourced(value: Any) -> dict[str, Any] | None:
    return None if value is None else {"value": value.value, "source": str(value.source)}


# The engine's own finders, bound for one file (module functions, so a worker process can take them).


def engine_read(path: Path) -> Any:
    from engine.read import read

    return read(path, source_name=NEUTRAL)


def engine_sheets(artefact: Any, discipline: str | None) -> Sequence[Any]:
    from engine.recognise import sheets

    return sheets.find(artefact, discipline, sheets.default_conventions())


def engine_views(artefact: Any, sheet: Any) -> Sequence[Any]:
    from engine.recognise import views

    return views.find(artefact, sheet)


def _discipline(relative: str) -> str | None:
    """The file's Discipline default from its path, as the harness gives it to the sheet finder."""
    from engine.harness import file_discipline
    from engine.recognise.sheets import default_conventions

    return file_discipline(relative, default_conventions())


def _one(folder: Path, relative: str, root: Path, hashed: str) -> tuple[dict[str, Any], int, int]:
    """One file's snapshot and its cache's hits and misses (a worker's whole job, or this process's
    with one worker), through this module's `snapshot` as it is at the call."""
    cache = DecodeCache(root, hashed)
    found = snapshot(
        folder / relative,
        cache,
        read=engine_read,
        find_sheets=partial(engine_sheets, discipline=_discipline(relative)),
        find_views=engine_views,
    )
    return {"path": relative, **found}, cache.hits, cache.misses


def _files(folder: Path) -> tuple[list[str], list[str]]:
    """The set's DWGs and the other files skipped, by their paths inside it; hidden files and links
    left out of both."""
    dwgs: list[str] = []
    skipped: list[str] = []
    for path in sorted(folder.rglob("*")):
        relative = path.relative_to(folder)
        if any(part.startswith(".") for part in relative.parts):
            continue
        if path.is_symlink() or not path.is_file():
            continue
        (dwgs if path.suffix.lower() == DWG else skipped).append(relative.as_posix())
    return dwgs, skipped


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m tools.proxy.snap")
    parser.add_argument("--set", type=Path, required=True, help="the Drawing Set's folder")
    parser.add_argument("--out", type=Path, required=True, help="where the views are written")
    parser.add_argument(
        "--cache",
        type=Path,
        default=ROOT / ".private" / "work" / "proxy-cache",
        help="the decode cache's folder",
    )
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args(argv)
    if args.workers < 1:
        parser.error("--workers is at least 1")
    folder = args.set.resolve()
    dwgs, skipped = _files(folder)
    for relative in skipped:
        print(f"skipped, not a DWG: {relative}", file=sys.stderr)
    hashed = reader_hash(ROOT)
    clock = time.monotonic()
    found: list[tuple[dict[str, Any], int, int]]
    if args.workers == 1:
        found = [_one(folder, relative, args.cache, hashed) for relative in dwgs]
    else:
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            jobs = [pool.submit(_one, folder, relative, args.cache, hashed) for relative in dwgs]
            found = [job.result() for job in jobs]
    seconds = time.monotonic() - clock
    document = {"version": 1, "reader_hash": hashed, "files": [one for one, _h, _m in found]}
    _write(args.out, document)
    sheets = sum(len(one["sheets"]) for one, _h, _m in found)
    views = sum(len(s["views"]) for one, _h, _m in found for s in one["sheets"])
    hits, misses = sum(h for _o, h, _m in found), sum(m for _o, _h, m in found)
    print(
        f"files {len(found)}, sheets {sheets}, views {views}; decode cache hits {hits},"
        f" misses {misses}; {seconds:.1f} s"
    )
    return 0


def _write(out: Path, document: Mapping[str, Any]) -> None:
    text = json.dumps(document, ensure_ascii=False, indent=1, allow_nan=False) + "\n"
    out.parent.mkdir(parents=True, exist_ok=True)
    partial_out = out.with_name(f"{out.name}.{hashlib.sha256(os.urandom(8)).hexdigest()[:8]}.part")
    handle = os.open(partial_out, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(handle, "w", encoding="utf-8") as stream:
        stream.write(text)
    partial_out.replace(out)


if __name__ == "__main__":
    sys.exit(main())
