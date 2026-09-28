"""The workflow check (the M0 plan, 01c; s02 review R3). Only main's copy of the not-applicable
workflow may post the real-drawing and design-gate statuses, so this fails any other workflow or local
action under `.github/` that requests `statuses: write` (or `write-all`) or names either status, and
fails the not-applicable workflow if it runs on anything but `pull_request_target` (where main's copy
runs, never the PR's). It reads the files as text, comments included, and so errs towards failing.
Standard library only.

    python -m tools.lint.workflows [root]
"""

import re
import sys
from pathlib import Path

NOT_APPLICABLE = "real-drawings-na.yml"
STATUSES_WRITE = re.compile(r"""["']?\bstatuses["']?\s*:\s*["']?write\b|\bwrite-all\b""")
STATUS_NAMES = ("real-drawings", "design-gate")
ON = re.compile(r"""^["']?(?:on|true)["']?\s*:\s*(?P<inline>[^#]*?)\s*(?:#.*)?$""")


def triggers(text: str) -> set[str]:
    """The events a workflow's top-level `on:` names, read without a YAML parser."""
    lines = text.splitlines()
    for at, line in enumerate(lines):
        found = ON.match(line)
        if not found:
            continue
        if inline := found["inline"]:
            return {word.strip(" '\"") for word in inline.strip("[]").split(",") if word.strip()}
        events: set[str] = set()
        indent = None
        for child in lines[at + 1 :]:
            if not child.strip() or child.lstrip().startswith("#"):
                continue
            width = len(child) - len(child.lstrip())
            if width == 0:
                break
            indent = indent or width
            if width == indent:
                events.add(child.strip().removeprefix("- ").split(":", 1)[0].strip(" '\""))
        return events
    return set()


def problems(root: Path) -> list[str]:
    found = []
    files = sorted((root / ".github" / "workflows").glob("*.y*ml")) + sorted(
        path for path in (root / ".github" / "actions").rglob("*") if path.is_file()
    )
    for path in files:
        name = path.relative_to(root).as_posix()
        text = path.read_text(errors="replace")
        if name == f".github/workflows/{NOT_APPLICABLE}":
            if triggers(text) != {"pull_request_target"}:
                found.append(f"{name}: runs on something other than pull_request_target")
            continue
        if STATUSES_WRITE.search(text):
            found.append(f"{name}: requests statuses: write")
        found.extend(f"{name}: names {status}" for status in STATUS_NAMES if status in text.lower())
    return found


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    found = problems(Path(args[0]) if args else Path.cwd())
    for problem in found:
        print(problem)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
