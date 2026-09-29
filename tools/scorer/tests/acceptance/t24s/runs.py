"""Invented posting runs and Answer Keys for ticket 24s's acceptance tests: made-up sheets and keys only,
never anything from a real Drawing Set or a real key.

A posting run is laid out as `scripts/real_drawings/command.py` writes it on main: the drop folder holds
one folder per run, named by the run id, holding `export-<set>.json`, `metadata.json` (the run id, the
head's commit and each set's export digest) and `summary.json`. The keys are `<keys>/<set>.json` in the
shape of session 06's ruling "24s <-> 17": `{set, held_out, sheets: [{layout, frame?, number, title,
discipline, storeys, revision, date, views: [{box, title, kind, subject}]}]}`.

The scorer is called through its seam, `tools.scorer.score.main(argv, *, drop, keys, log, writer)`, with
the run id as its one argument and `writer` the user id that alone may have written the run's folder
(`vxrun` when installed; here the test's own user).
"""

import hashlib
import importlib
import json
import os
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from scripts.real_drawings.tests import exports

JSON = dict[str, Any]

HEAD = "5e1f0c2a9b7d3e4f60718293a4b5c6d7e8f90123"
MAIN = "0f9e8d7c6b5a49382716051f2e3d4c5b6a798012"
RUN_ID = f"20260929T130000Z-{HEAD[:12]}-beef"
SET = "invented-set"

# The key's values that are not also the export's in a failing run: none may reach the output or the log.
DISCIPLINE = "structural"
REVISION = "R0"
DATE = "2026-01-01"


def score_main() -> Callable[..., int]:
    """The seam, imported when called so each test fails on its own until the scorer exists."""
    module = importlib.import_module("tools.scorer.score")
    main: Callable[..., int] = module.main
    return main


def key_view(box: list[float], title: str, kind: str = "plan", subject: str = "slab") -> JSON:
    return {"box": box, "title": title, "kind": kind, "subject": subject}


def key_sheet(
    layout: str,
    number: str,
    title: str,
    storeys: str,
    views: list[JSON],
    frame: list[float] | None = None,
    **values: Any,
) -> JSON:
    sheet: JSON = {
        "layout": layout,
        "number": number,
        "title": title,
        "discipline": DISCIPLINE,
        "storeys": storeys,
        "revision": REVISION,
        "date": DATE,
        "views": views,
    }
    if frame is not None:
        sheet["frame"] = frame
    return sheet | values


def export_view(box: list[float], title: str, kind: str = "plan", subject: str = "slab") -> JSON:
    return exports.view(box, title=title, kind=kind, subject=subject)


def export_sheet(
    layout: str,
    number: str,
    title: str,
    storeys: str,
    views: list[JSON],
    box: list[float] | None = None,
) -> JSON:
    return exports.sheet(
        layout,
        box,
        number=exports.sourced(number),
        title=exports.sourced(title, "title_block_attribute"),
        discipline=exports.sourced(DISCIPLINE, "file"),
        revision_mark=exports.sourced(REVISION, "file_name"),
        issue_date=exports.sourced(DATE),
        storeys_as_stated=exports.sourced(storeys),
        views=views,
    )


@dataclass(frozen=True)
class Place:
    """Where one test's run lives: the drop folder, the keys' folder and the log."""

    root: Path

    @property
    def drop(self) -> Path:
        return self.root / "drop"

    @property
    def keys(self) -> Path:
        return self.root / "keys"

    @property
    def log(self) -> Path:
        return self.root / "score.log"

    @property
    def run(self) -> Path:
        return self.drop / RUN_ID

    def write_keys(self, sheets: list[JSON], *, held_out: bool = False, name: str = SET) -> None:
        self.keys.mkdir(exist_ok=True)
        key = {"set": name, "held_out": held_out, "sheets": sheets}
        (self.keys / f"{name}.json").write_text(json.dumps(key))

    def write_run(
        self,
        sheets: list[JSON],
        *,
        name: str = SET,
        export_run_id: str = RUN_ID,
        metadata_run_id: str = RUN_ID,
    ) -> Path:
        """The run's folder as the posting run writes it; returns the export's path."""
        self.drop.mkdir(exist_ok=True)
        self.run.mkdir(mode=0o750)
        os.chmod(self.run, 0o750)
        document = exports.export(exports.dwg(exports.SHA_A, *sheets))
        document["run"]["id"] = export_run_id
        document["run"]["commit"] = HEAD
        data = json.dumps(document).encode()
        export = self.run / f"export-{name}.json"
        export.write_bytes(data)
        metadata = {
            "run_id": metadata_run_id,
            "target": "main",
            "pr": None,
            "commit": HEAD,
            "code_hash": "c" * 64,
            "main_commit": MAIN,
            "main_code_hash": "d" * 64,
            "sets": {name: {"set_sha256": "e" * 64, "export_sha256": sha256(data)}},
            "seconds": 1,
        }
        (self.run / "metadata.json").write_text(json.dumps(metadata))
        summary = {"run_id": RUN_ID, "verdict": "accepted"}
        (self.run / "summary.json").write_text(json.dumps(summary))
        return export

    def score(self, argv: list[str] | None = None, *, writer: int | None = None) -> int:
        """Calls the scorer on this run; `writer` defaults to the test's own user."""
        self.log.touch()
        return score_main()(
            [RUN_ID] if argv is None else argv,
            drop=self.drop,
            keys=self.keys,
            log=self.log,
            writer=os.getuid() if writer is None else writer,
        )

    def logged(self) -> str:
        return self.log.read_text()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
