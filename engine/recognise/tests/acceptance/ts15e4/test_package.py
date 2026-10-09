"""S15-E4: the views module (2,278 lines) is split into a package at its seams, with no behaviour change
(tickets.md, S15-E4; discovery 01, section 1 "Too many jobs in one module" and section 4 item 4).

The package keeps the module's path, `engine.recognise.views`: every caller (the harness's stage
`engine.recognise.views:find`, export, conflicts, the product's read and Step 1, the acceptance tests of
17, 21c and "not read in full") keeps importing its names from there, so none is moved. Its five
submodules are the parts later tickets each own one of: `paper` (S15-E2: one paper for view boxes),
`storeys` (S15-E3: one owner of a Sheet's storeys), `routing` (S15-E5: every View gets a home),
`titles` (S15-E6: a View's title and what it says) and `segment` (the drawing cut into Views).

The seams pinned are those that let each later ticket change its part alone: routing and storeys read
words, never paper or segments; paper is read before any title, storey or Step. No file of the package
is over `MAX_LINES`.
"""

import ast
from importlib import import_module
from pathlib import Path
from types import ModuleType

import pytest

PACKAGE = "engine.recognise.views"
SUBMODULES = ("segment", "titles", "storeys", "paper", "routing")

MAX_LINES = 1000
"""A file's most lines. Under half of the 2,278-line module, so no one file keeps most of it; the
largest part its outline names (walking a space, the grid's pieces, ruled tables and shared cuts:
views.py:356-510, 919-1180 and 1619-1897, about 700 lines) fits with its constants and docstring,
and so does the composition (`find` and `_views`, views.py:1365-1619, about 250)."""

CALLERS_NAMES = (
    "find",
    "FoundViews",
    "LIMITS",
    "working_view",
    "kind_steps",
    "subjects",
    "describe",
    "Described",
    "default_conventions",
    "ViewBudget",
)
"""What callers import from `engine.recognise.views` today (engine/export.py, conflicts.py, harness.py,
vextrus/takeoff/services), and the file's budget the split makes an argument of `find`."""


def package() -> ModuleType:
    found = import_module(PACKAGE)
    assert hasattr(found, "__path__"), f"'{PACKAGE}' is not a package"
    return found


def sources(name: str) -> dict[str, Path]:
    """The part's source files by module name: its file, or every file of it when it is a package."""
    folder = Path(package().__path__[0])
    if (folder / f"{name}.py").is_file():
        return {f"{PACKAGE}.{name}": folder / f"{name}.py"}
    found = {}
    for path in sorted((folder / name).rglob("*.py")):
        parts = path.relative_to(folder).with_suffix("").parts
        dotted = ".".join([PACKAGE, *parts])
        found[dotted.removesuffix(".__init__")] = path
    return found


def imported(name: str) -> set[str]:
    """Every module the part's source imports, by absolute name (relative imports resolved), with
    each `from X import y` also counted as `X.y`."""
    found: set[str] = set()
    for module, path in sources(name).items():
        is_package = path.name == "__init__.py"
        here = module.split(".") if is_package else module.split(".")[:-1]
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Import):
                found.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                if node.level:
                    parts = here[: len(here) - (node.level - 1)]
                    base = ".".join([*parts, *([node.module] if node.module else [])])
                else:
                    base = node.module or ""
                found.add(base)
                found.update(f"{base}.{alias.name}" for alias in node.names)
    return found


def reaches(name: str, forbidden: str) -> bool:
    target = f"{PACKAGE}.{forbidden}"
    return any(m == target or m.startswith(f"{target}.") for m in imported(name))


@pytest.mark.parametrize("name", SUBMODULES)
def test_the_views_package_has_its_part(name: str) -> None:
    module = import_module(f"{PACKAGE}.{name}")
    assert module.__name__ == f"{PACKAGE}.{name}"


def test_every_name_callers_import_is_still_on_engine_recognise_views() -> None:
    found = package()
    missing = [name for name in CALLERS_NAMES if not hasattr(found, name)]
    assert missing == []


def test_kind_steps_is_the_routing_parts() -> None:
    routing = import_module(f"{PACKAGE}.routing")
    assert package().kind_steps is routing.kind_steps
    assert routing.kind_steps.__module__ == f"{PACKAGE}.routing"


def test_describe_and_subjects_are_the_titles_parts() -> None:
    titles = import_module(f"{PACKAGE}.titles")
    found = package()
    assert found.describe is titles.describe
    assert found.subjects is titles.subjects
    assert titles.describe.__module__ == f"{PACKAGE}.titles"
    assert titles.subjects.__module__ == f"{PACKAGE}.titles"


@pytest.mark.parametrize("part", ["routing", "storeys"])
def test_routing_and_storeys_read_neither_paper_nor_segments(part: str) -> None:
    import_module(f"{PACKAGE}.{part}")
    assert not reaches(part, "paper"), f"{part} imports the paper part"
    assert not reaches(part, "segment"), f"{part} imports the segment part"


def test_paper_reads_no_title_storey_or_step() -> None:
    import_module(f"{PACKAGE}.paper")
    for later in ("titles", "storeys", "routing"):
        assert not reaches("paper", later), f"paper imports the {later} part"


def test_no_file_of_the_package_is_over_the_most_lines() -> None:
    folder = Path(package().__path__[0])
    sizes = {
        str(p.relative_to(folder)): len(p.read_text(encoding="utf-8").splitlines())
        for p in folder.rglob("*.py")
    }
    assert all(sources(name) for name in SUBMODULES)
    assert {name: n for name, n in sizes.items() if n > MAX_LINES} == {}
