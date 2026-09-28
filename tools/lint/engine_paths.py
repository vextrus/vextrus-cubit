"""Which changed files match a list of path globs (the M0 plan, Labels): `.github/engine-paths.txt`
makes a PR an engine PR, `web/**` a UI PR. Standard library only and Python 3.12 or later, so main's
copy runs as a plain script on a runner's own python3, before anything is installed.

    git diff --name-only main... | python3 tools/lint/engine_paths.py --patterns .github/engine-paths.txt
    ... | python3 tools/lint/engine_paths.py --pattern 'web/**'

Prints the paths that match, one per line, and exits 0; no output means none matched.
"""

import argparse
import re
import sys
from collections.abc import Iterable
from pathlib import Path

# A glob's pieces: `**/` (any folders, or none), `**`, `*` and `?` (inside one folder), or a literal.
GLOB_PIECE = re.compile(r"\*\*/|\*\*|\*|\?|[^*?]+")
AS_REGEX = {"**/": "(?:.*/)?", "**": ".*", "*": "[^/]*", "?": "[^/]"}


def read_patterns(text: str) -> list[str]:
    """One glob per line; `#` starts a comment."""
    lines = (line.split("#", 1)[0].strip() for line in text.splitlines())
    return [line for line in lines if line]


def compile_glob(glob: str) -> re.Pattern[str]:
    return re.compile(
        "".join(AS_REGEX.get(piece, re.escape(piece)) for piece in GLOB_PIECE.findall(glob))
    )


def matching(paths: Iterable[str], patterns: Iterable[str]) -> list[str]:
    """The paths any pattern matches as a whole path (`**` spans folders, `*` stays inside one)."""
    globs = [compile_glob(pattern) for pattern in patterns]
    return [path for path in paths if any(glob.fullmatch(path) for glob in globs)]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    parser.add_argument("--patterns", type=Path, action="append", default=[], help="a file of globs")
    parser.add_argument("--pattern", action="append", default=[], help="one glob")
    args = parser.parse_args(argv)
    if not args.patterns and not args.pattern:
        parser.error("give --patterns FILE or --pattern GLOB")
    patterns = [
        glob for file in args.patterns for glob in read_patterns(file.read_text())
    ] + args.pattern
    paths = [line.strip() for line in sys.stdin if line.strip()]
    for path in matching(paths, patterns):
        print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
