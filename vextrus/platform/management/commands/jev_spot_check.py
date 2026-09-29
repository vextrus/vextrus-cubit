"""`jev_spot_check <labels.jsonl>`: a Jev node's spot check on labelled real items (ticket 23).

Run locally only, with the owner's development key in the environment (ADR 0013); the labels file
lives in `.private/` and never enters git. Each line is one item:

    {"facts": {...the node's facts...}, "options": [...] or {key: description}, "kind": "the label"}

Items offering the same options (a Discipline's kinds) are asked together; the counts are added up.
It prints the report (counts and kinds only), which is what goes into `docs/knowledge/jev-nodes.md`.
It uses no database.
"""

import json
from pathlib import Path
from typing import Any, ClassVar

from django.core.management.base import BaseCommand, CommandError, CommandParser

from vextrus.platform.services import jev, jev_spot_check


class Command(BaseCommand):
    help = "Ask Jev about labelled items (JSONL in .private/); print right / checked and the queue."
    requires_system_checks: ClassVar[list[str]] = []  # type: ignore[misc]

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("labels", type=Path)
        parser.add_argument("--node", default=jev.SHEET_TYPE.key)
        parser.add_argument("--question", required=True)

    def handle(self, *args: Any, **options: Any) -> None:
        groups: dict[str, tuple[jev.Options, list[tuple[dict[str, Any], str]]]] = {}
        with options["labels"].open(encoding="utf-8") as lines:
            for number, line in enumerate(lines, start=1):
                if not line.strip():
                    continue
                try:
                    item = json.loads(line)
                    facts, offered, kind = item["facts"], item["options"], item["kind"]
                except ValueError, KeyError, TypeError:
                    raise CommandError(f"line {number} is not a labelled item") from None
                key = json.dumps(offered, sort_keys=False)
                groups.setdefault(key, (offered, []))[1].append((facts, kind))
        if not groups:
            raise CommandError("no labelled items")
        with jev.Client() as client:
            results = [
                jev_spot_check.run(options["node"], items, options["question"], offered, client=client)
                for offered, items in groups.values()
            ]
        result = jev_spot_check.total(results)
        self.stdout.write(result.report())
        if result.checked == sum(result.unavailable.values()):
            raise CommandError("Jev answered nothing: this is no measure")
