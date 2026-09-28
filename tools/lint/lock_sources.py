"""The lock check: every locked package comes from the package registry, and nothing is built.

The real-drawing check installs the locked wheels offline, by their hashes, inside its sandbox, and
builds nothing (the M0 plan, the real-drawing check, step 2; review R1). So `uv.lock` names no git,
URL, path or other index source; `pyproject.toml` redirects no package (`[tool.uv.sources]`), never
asks for a package to be built from source (`no-binary-package`), and keeps `package = false` and
`no-build = true`.

    uv run python -m tools.lint.lock_sources
"""

import argparse
import sys
import tomllib
from collections.abc import Sequence
from pathlib import Path
from typing import Any

REGISTRY = "https://pypi.org/simple"


def problems(root: Path) -> list[str]:
    pyproject = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    locked = tomllib.loads((root / "uv.lock").read_text(encoding="utf-8"))
    project = pyproject["project"]["name"]
    uv: dict[str, Any] = pyproject.get("tool", {}).get("uv", {})
    found = []
    for package in locked.get("package", []):
        source = package.get("source", {})
        is_registry = source == {"registry": REGISTRY}
        is_project = package["name"] == project and source == {"virtual": "."}
        if not (is_registry or is_project):
            found.append(f"{package['name']}: locked from {source}, not the registry {REGISTRY}")
    for key in ("sources", "no-binary-package", "no-binary", "index", "extra-index-url", "find-links"):
        if key in uv:
            found.append(f"pyproject.toml: [tool.uv] {key} is not allowed")
    if uv.get("package") is not False:
        found.append("pyproject.toml: [tool.uv] needs package = false (the project is never built)")
    if uv.get("no-build") is not True:
        found.append("pyproject.toml: [tool.uv] needs no-build = true (nothing is built from source)")
    return found


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--root", type=Path, default=Path.cwd())
    found = problems(parser.parse_args(argv).root)
    for problem in found:
        print(problem)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
