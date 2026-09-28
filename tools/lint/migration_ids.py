"""The migration scan: no migration names `uuid7` (docs/data-model.md §2; stack-versions.md).

Every id comes from `vextrus.platform.ids.new_id`, made in the app with no database default. A
migration that records `uuid.uuid7` (or a backport's, or Django's database-side `UUID7()`) ties the
schema to one generator and one Python: it fails to load where that name differs. Any mention of
`uuid7`, in any case, in a migration fails this scan, comments included.

    uv run python -m tools.lint.migration_ids
"""

import argparse
import re
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

_UUID7 = re.compile("uuid7", re.IGNORECASE)


@dataclass(frozen=True)
class Finding:
    path: str
    line: int
    column: int
    text: str


def scan(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    for path in sorted(root.glob("vextrus/*/migrations/*.py")):
        relative = path.relative_to(root).as_posix()
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            findings.extend(
                Finding(relative, number, match.start() + 1, line.strip())
                for match in _UUID7.finditer(line)
            )
    return findings


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--root", type=Path, default=Path.cwd())
    findings = scan(parser.parse_args(argv).root)
    for finding in findings:
        print(f"{finding.path}:{finding.line}:{finding.column}: names uuid7: {finding.text}")
    if findings:
        print("Ids come from vextrus.platform.ids.new_id, never uuid7 in a migration.")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
