"""A file's child for `test_read_retry.py`: the product's own child of the real-drawing check's export
(`python -m vextrus.takeoff.services.export ... --worker <storage>`, `export.main` with the arguments
the export gives it), on the test database, with 21c's invented readers (`t21c/step1_whole`): each DWG
read is written to a log as `[file name, child]`, and the file named to raise raises on every try.

    python -c <run this module's main> <config JSON> <the export's own arguments for its child>

The config: `child` (which child this is, from 1), `log` (the log's path), `raises` (the file name
whose reading raises), `env` (the test database's URLs and the storage root, set before Django)."""

import json
import os
import sys
from pathlib import Path
from typing import Any

RAISED = "an invented reader's failure (S15-A6)"


def main() -> int:
    config: dict[str, Any] = json.loads(sys.argv[1])
    os.environ.update(config["env"])
    os.environ.pop("TYPESAFE_API_KEY", None)  # never a live call (the parent's test has no key)

    import django

    django.setup()

    from vextrus.takeoff.services import export
    from vextrus.takeoff.services.read_propose import files
    from vextrus.takeoff.tests.acceptance.t21c.step1_whole import Sheet, readers

    sheets = [Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",))]
    given = readers(dict.fromkeys(config["names"], sheets))
    log = Path(config["log"])

    def dwg(path: Path, name: str) -> Any:
        with log.open("a", encoding="utf-8") as out:
            out.write(json.dumps([name, config["child"]]) + "\n")
        if name == config["raises"]:
            raise RuntimeError(RAISED)
        return given.dwg(path, name)

    files.READERS = files.Readers(
        dwg=dwg,
        second=given.second,
        fonts=given.fonts,
        bangla_ansi=given.bangla_ansi,
        pdf=given.pdf,
    )
    return export.main(sys.argv[2:])
