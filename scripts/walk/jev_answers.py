"""A walk's Jev answers leave its database and seed the next one (S30-W1; the owner, 15 Oct 2026:
"Re-run #2; #3 reuses its Jev answers").

    python -m scripts.walk.jev_answers export <file>
    python -m scripts.walk.jev_answers seed <file>

Run by `scripts/walk/run.py` with the walked checkout's python and Django settings (never the product's
own management command: a seam under `vextrus/` landed between two walks would make the repeat walk other
product code). `export` writes every `platform_jevanswer` row as a JSON array of objects with exactly
`cache_key`, `node`, `model_version`, `options`, `choice`, `confidence` (a decimal string) and
`probabilities`: no id, no tenant and no facts. `seed` puts every row of such a file under the walk's
tenant (the Developer of the seed's QS, Shapla Homes Ltd) and skips a key already there; it prints the
number of rows it inserted, and refuses (exit 2) a malformed file, a row of another model than the
checkout's pinned one, or a database with no such tenant.
"""

import json
import os
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from scripts.walk.cli import QuietParser

DEVELOPER = "Shapla Homes Ltd"
"""The Developer whose Projects the walk's QS (`nusrat@shapla-homes.example`) makes."""
COLUMNS = ("cache_key", "node", "model_version", "options", "choice", "confidence", "probabilities")


class Refused(ValueError):
    """The file or the database is not one a seed can use; the reason is fixed words."""


def _django() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vextrus.settings")
    import django

    django.setup()


def read_rows(text: str) -> list[dict[str, Any]]:
    """The rows of an answers file, checked: a JSON array of objects of exactly the seven columns."""
    try:
        raw = json.loads(text)
    except ValueError:
        raise Refused("the answers file is not JSON") from None
    if not isinstance(raw, list):
        raise Refused("the answers file is not a list of rows")
    for row in raw:
        if not isinstance(row, dict) or set(row) != set(COLUMNS):
            raise Refused("a row of the answers file does not hold exactly the seven columns")
        strings = (row["cache_key"], row["node"], row["model_version"], row["choice"])
        if not all(isinstance(value, str) for value in strings):
            raise Refused("a row's cache_key, node, model_version or choice is not text")
        if not isinstance(row["options"], list) or not isinstance(row["probabilities"], dict):
            raise Refused("a row's options or probabilities have the wrong shape")
        try:
            if not isinstance(row["confidence"], str) or not Decimal(row["confidence"]).is_finite():
                raise Refused("a row's confidence is not a decimal string")
        except InvalidOperation:
            raise Refused("a row's confidence is not a decimal string") from None
    return raw


def export_rows() -> list[dict[str, Any]]:
    from vextrus.platform.database import OWNER_ALIAS
    from vextrus.platform.models import JevAnswer

    rows = JevAnswer.objects.using(OWNER_ALIAS).order_by("node", "cache_key", "tenant_id")
    return [
        {
            "cache_key": row.cache_key,
            "node": row.node,
            "model_version": row.model_version,
            "options": row.options,
            "choice": row.choice,
            "confidence": format(row.confidence, "f"),
            "probabilities": row.probabilities,
        }
        for row in rows
    ]


def seed_rows(rows: list[dict[str, Any]]) -> int:
    """Inserts each row under the walk's tenant unless its key is there; returns the number inserted."""
    from django.db import transaction

    from vextrus.platform.database import OWNER_ALIAS
    from vextrus.platform.models import Developer, JevAnswer
    from vextrus.platform.services import jev

    pinned = {node.key: node.model for node in jev.NODES.values()}
    for row in rows:
        if pinned.get(row["node"]) != row["model_version"]:
            raise Refused("a row holds a model other than the pinned one")
    tenants = list(
        Developer.objects.using(OWNER_ALIAS)
        .filter(name=DEVELOPER, is_library=False)
        .values_list("id", flat=True)
    )
    if len(tenants) != 1:
        raise Refused("the database has not exactly one walk tenant")
    tenant = tenants[0]
    with transaction.atomic(using=OWNER_ALIAS):
        have = set(
            JevAnswer.objects.using(OWNER_ALIAS)
            .filter(tenant_id=tenant)
            .values_list("cache_key", flat=True)
        )
        fresh: list[Any] = []
        for row in rows:
            if row["cache_key"] in have:
                continue
            have.add(row["cache_key"])
            fresh.append(
                JevAnswer(
                    tenant_id=tenant,
                    cache_key=row["cache_key"],
                    node=row["node"],
                    model_version=row["model_version"],
                    options=row["options"],
                    choice=row["choice"],
                    confidence=Decimal(row["confidence"]),
                    probabilities=row["probabilities"],
                )
            )
        JevAnswer.objects.using(OWNER_ALIAS).bulk_create(fresh)
    return len(fresh)


def main(argv: list[str] | None = None) -> int:
    parser = QuietParser(prog="python -m scripts.walk.jev_answers")
    parser.add_argument("action", choices=("export", "seed"))
    parser.add_argument("file", type=Path)
    try:
        args = parser.parse_args(argv)
    except SystemExit:
        return 2
    try:
        _django()
        if args.action == "export":
            args.file.parent.mkdir(parents=True, exist_ok=True)
            args.file.write_text(json.dumps(export_rows(), indent=1) + "\n", encoding="utf-8")
            return 0
        print(seed_rows(read_rows(args.file.read_text(encoding="utf-8"))))
        return 0
    except Refused as error:
        print(f"jev_answers: refused ({error})", file=sys.stderr)
        return 2
    except OSError:
        print("jev_answers: refused (the file cannot be read or written)", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
