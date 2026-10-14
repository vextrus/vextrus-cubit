"""The placed-view lint (docs/plans/M1.md C4, A6; M1-00). A family's acceptance test never builds a
`ViewArtefact` without its view: in the slice a fixture's `view=None` hid a reader that used a paper box
as its model-space window and read nothing. `ViewArtefact.view` is required and never None, and
`placement` is a `PlacedView`; this lint refuses a `ViewArtefact(...)` call whose `view` (keyword, or
the fourth positional argument) or `placement` (keyword, or the fifth) is the literal `None`.

    python -m tools.lint.placed_view [FILE ...]

With no FILE, reads the family acceptance tests git tracks
(`engine/families/<family>/tests/acceptance/`).
Prints `<path>:<line>: ...` for each such call; exit 1 when any, else 0.
"""

import ast
import subprocess
import sys
from pathlib import Path

FIELDS = {"view": 3, "placement": 4}
"""The fields that are never None, and their places among `ViewArtefact`'s positional arguments."""


def family_acceptance_tests() -> list[str]:
    done = subprocess.run(
        ["git", "ls-files", "-z", "--", "engine/families/*/tests/acceptance/*.py"],
        capture_output=True,
        text=True,
        check=True,
    )
    return sorted(path for path in done.stdout.split("\0") if path)


def _named_view_artefact(call: ast.Call) -> bool:
    target = call.func
    if isinstance(target, ast.Name):
        return target.id == "ViewArtefact"
    return isinstance(target, ast.Attribute) and target.attr == "ViewArtefact"


def _is_none(node: ast.expr) -> bool:
    return isinstance(node, ast.Constant) and node.value is None


def unplaced(source: str, path: str) -> list[str]:
    """Each `ViewArtefact(...)` call in `source` giving `view` or `placement` as None."""
    found = []
    for node in ast.walk(ast.parse(source, filename=path)):
        if not isinstance(node, ast.Call) or not _named_view_artefact(node):
            continue
        given = {keyword.arg: keyword.value for keyword in node.keywords if keyword.arg}
        for field, place in FIELDS.items():
            value = given.get(field)
            if value is None and len(node.args) > place:
                value = node.args[place]
            if value is not None and _is_none(value):
                found.append(
                    f"{path}:{node.lineno}: ViewArtefact({field}=None): a family's acceptance test "
                    f"gives every view and its PlacedView (docs/plans/M1.md C4)"
                )
    return found


def main(argv: list[str]) -> int:
    paths = argv or family_acceptance_tests()
    found = []
    for path in paths:
        found += unplaced(Path(path).read_text(encoding="utf-8"), path)
    for line in found:
        print(line)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
