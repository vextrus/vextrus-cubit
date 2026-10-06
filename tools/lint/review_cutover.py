"""The review cutover check (factory-next.md section 3 and section 8, row 11; issue #368). Once
`scripts.factory.review` reviews a PR head by code, no workflow script reviews one: the only script under
`.claude/workflows/` is `real-set-walk.js`, and no `agent(` call in it mentions the ledger (a prompt that
tells an agent to run `ledger` is the old way: the ledger is written by code, never by an agent). It
reads the files as text, comments inside the call included, and so errs towards failing. Standard
library only.

    python -m tools.lint.review_cutover [root]
"""

import re
import sys
from pathlib import Path

KEPT = "real-set-walk.js"
AGENT_CALL = re.compile(r"(?<![\w$.])agent\s*\(")
LEDGER = re.compile(r"ledger", re.IGNORECASE)
QUOTES = "'\"`"


def scripts(root: Path) -> list[Path]:
    folder = root / ".claude" / "workflows"
    return sorted(path for path in folder.glob("*.js") if path.is_file()) if folder.is_dir() else []


def call_end(text: str, start: int) -> int:
    """The index just past the `)` closing the call whose `(` is at `start` (the end of the text when
    it never closes). Strings and template literals are skipped; `${...}` is not entered, so a ledger
    word inside one still counts, as it is part of the prompt."""
    depth, index, quote = 0, start, ""
    while index < len(text):
        char = text[index]
        if quote:
            if char == "\\":
                index += 1
            elif char == quote:
                quote = ""
        elif char in QUOTES:
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return index + 1
        index += 1
    return len(text)


def ledger_calls(text: str) -> list[int]:
    """The line numbers of the `agent(` calls whose text mentions the ledger."""
    lines = []
    for found in AGENT_CALL.finditer(text):
        end = call_end(text, found.end() - 1)
        if LEDGER.search(text[found.start() : end]):
            lines.append(text.count("\n", 0, found.start()) + 1)
    return lines


def problems(root: Path) -> list[str]:
    found = []
    for path in scripts(root):
        name = path.relative_to(root).as_posix()
        if path.name != KEPT:
            found.append(f"{name}: only {KEPT} may remain: review is `scripts.factory.review`")
            continue
        text = path.read_text(errors="replace")
        found.extend(
            f"{name}:{line}: an agent( prompt mentions the ledger: code writes the ledger, not an agent"
            for line in ledger_calls(text)
        )
    return found


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) > 1:
        print("usage: python -m tools.lint.review_cutover [root]", file=sys.stderr)
        return 2
    found = problems(Path(args[0]) if args else Path.cwd())
    for problem in found:
        print(problem)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
