"""`python -m scripts.factory.rescore [--verdicts <folder>] [--ledger <folder>] [--out <table>]
[--since <date>] [--until <date>] [--tags <json>]`: the recorded round-1 verdicts re-decided under
today's bar (S25-F2, the owner's Q13): the Q14 pilot's "before" baseline.

- `--verdicts`: review.py's kept decision inputs, `<PR>-<head12>-r<round>.txt`; `--ledger`: the ledger's
  records, `<PR>-<head40>.json`. Both default to the main checkout's `.private/work/factory/` folders
  (`verdicts/` and `ledger/`), named here so no command line names the ledger's folder.
- `--since` / `--until`: only records whose `recorded_at` falls on or after / on or before that UTC date
  (`YYYY-MM-DD`); the window of sessions is the caller's.
- `--tags`: a JSON object `{"<input file name>": {"<finding id>": "class=<class> boundary=<yes|no>"}}`
  that tags an untagged FINDING line before it is re-decided (the inputs recorded before Q13 carry no
  tags, and an untagged line keeps the path bar, so without tags their verdict cannot change).

Each round-1 record is one row of the Markdown table written to `--out` (default
`.private/work/factory/rescore.md`): its PR, its head, the recorded verdict, then the re-scored one. A
record whose input is missing or that the ledger refuses keeps its recorded verdict, its row says why,
and stderr counts them. Prints one JSON line, `{"rounds": <n>, "pass_before": <n>, "pass_after": <n>}`.
Reads only; writes only the table. Exit codes: 0 ok, 2 bad usage or an unreadable record or tags file.
"""

import argparse
import json
import re
import subprocess
import sys
from collections.abc import Sequence
from datetime import date
from pathlib import Path
from typing import Any

from scripts import ledger

RECORD = re.compile(r"([0-9]+)-([0-9a-f]{40})(?:-r([1-9][0-9]*))?\.json")  # -r<n>: same head
UNTAGGED = re.compile(r"(FINDING (\S+) \S+ \S+(?: (?!class=)\S+)?)")
TAGS = re.compile(r"class=\S+ boundary=\S+")


def factory_folder() -> Path:
    """The main checkout's `.private/work/factory/` (the parent of the cwd's git common dir)."""
    done = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        capture_output=True,
        text=True,
        check=False,
    )
    root = Path(done.stdout.strip()).parent if done.returncode == 0 else Path.cwd()
    return root / ".private" / "work" / "factory"


def parser() -> argparse.ArgumentParser:
    factory = factory_folder()
    found = argparse.ArgumentParser(prog="python -m scripts.factory.rescore", description=__doc__)
    found.add_argument("--verdicts", type=Path, default=factory / "verdicts")
    found.add_argument("--ledger", type=Path, default=factory / "ledger")
    found.add_argument("--out", type=Path, default=factory / "rescore.md")
    found.add_argument("--since", type=date.fromisoformat, default=None)
    found.add_argument("--until", type=date.fromisoformat, default=None)
    found.add_argument("--tags", type=Path, default=None)
    return found


def tagged(text: str, tags: dict[str, str]) -> str:
    """The decision input with each untagged FINDING line given its tags from `tags` (by id)."""
    out: list[str] = []
    for line in text.split("\n"):
        found = UNTAGGED.fullmatch(line)
        if found and found[2] in tags:
            if not TAGS.fullmatch(tags[found[2]]):
                raise ValueError(f"finding {found[2]}'s tags are not class=<class> boundary=<yes|no>")
            line = f"{line} {tags[found[2]]}"
        out.append(line)
    return "\n".join(out)


def rescored(verdicts: Path, record: dict[str, Any], tags: dict[str, str]) -> tuple[str, str]:
    """The record's verdict under today's bar, and a note (empty, or why it kept its recorded one)."""
    pr, head, recorded = record["pr"], record["head"], record["verdict"]
    source = verdicts / f"{pr}-{head[:12]}-r1.txt"
    try:
        text = source.read_text()
    except OSError, UnicodeDecodeError:
        return recorded, "kept: no decision input"
    try:
        return ledger.decide(tagged(text, tags).encode(), head).verdict, ""
    except (ledger.BadInput, ValueError) as error:
        return recorded, f"kept: {str(error)[:80]}"


def in_window(record: dict[str, Any], since: date | None, until: date | None) -> bool:
    day = date.fromisoformat(str(record.get("recorded_at", ""))[:10])
    return (since is None or day >= since) and (until is None or day <= until)


def main(argv: Sequence[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        sidecar: dict[str, dict[str, str]] = json.loads(args.tags.read_text()) if args.tags else {}
        if not isinstance(sidecar, dict) or not all(
            isinstance(ids, dict) and all(isinstance(v, str) for v in ids.values())
            for ids in sidecar.values()
        ):
            raise ValueError("the tags file is not {input name: {finding id: tags}}")
        names = sorted(args.ledger.iterdir())
        rows: list[tuple[int, str, str, str, str]] = []
        for path in names:
            named = RECORD.fullmatch(path.name)
            if named is None:
                continue
            record = json.loads(path.read_text())
            if named[3] is not None and record.get("round") != int(named[3]):
                raise ValueError(f"{path.name} names another round than it holds")
            if record.get("round") != 1 or not in_window(record, args.since, args.until):
                continue
            if record.get("verdict") not in ledger.RANK or record.get("head") != named[2]:
                raise ValueError(f"{path.name} is not a round's record")
            name = f"{record['pr']}-{record['head'][:12]}-r1.txt"
            after, note = rescored(args.verdicts, record, sidecar.get(name, {}))
            rows.append((int(record["pr"]), record["head"][:12], record["verdict"], after, note))
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"rescore: {error}", file=sys.stderr)
        return 2
    rows.sort()
    table = ["| PR | head | recorded | re-scored | note |", "|---|---|---|---|---|"]
    table += [
        f"| {pr} | {head} | {before} | {after} | {note} |" for pr, head, before, after, note in rows
    ]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("\n".join(table) + "\n")
    if kept := sum(bool(row[4]) for row in rows):
        print(f"rescore: {kept} record(s) kept their recorded verdict (see the table)", file=sys.stderr)
    summary = {
        "rounds": len(rows),
        "pass_before": sum(row[2] == "PASS" for row in rows),
        "pass_after": sum(row[3] == "PASS" for row in rows),
    }
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
