"""Which changed files match a list of path globs (the M0 plan, Labels): `.github/engine-paths.txt`
makes a PR an engine PR, `web/**` a UI PR. Standard library only, so main's copy runs in the
not-applicable workflow before any dependency is installed.

    git diff --name-only main... | python -m tools.lint.engine_paths --patterns .github/engine-paths.txt
    ... | python -m tools.lint.engine_paths --pattern 'web/**'

Prints the paths that match, one per line, and exits 0; no output means none matched.
"""

import argparse
import sys
from collections.abc import Iterable
from pathlib import Path, PurePosixPath


def read_patterns(text: str) -> list[str]:
    """One glob per line; `#` starts a comment."""
    lines = (line.split("#", 1)[0].strip() for line in text.splitlines())
    return [line for line in lines if line]


def matching(paths: Iterable[str], patterns: Iterable[str]) -> list[str]:
    """The paths any pattern matches as a whole path (`**` spans folders, `*` stays inside one)."""
    globs = list(patterns)
    return [path for path in paths if any(PurePosixPath(path).full_match(glob) for glob in globs)]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--patterns", type=Path, help="a file of globs, one per line")
    source.add_argument("--pattern", help="one glob")
    args = parser.parse_args(argv)
    patterns = read_patterns(args.patterns.read_text()) if args.patterns else [args.pattern]
    paths = [line.strip() for line in sys.stdin if line.strip()]
    for path in matching(paths, patterns):
        print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
