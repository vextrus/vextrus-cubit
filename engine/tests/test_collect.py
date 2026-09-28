"""The glob collector: a package's submodules, found by listing its directory."""

from pathlib import Path

import pytest

from engine.collect import submodules


def write_package(root: Path, name: str, files: dict[str, str]) -> None:
    package = root / name
    package.mkdir()
    (package / "__init__.py").write_text("")
    for relative, text in files.items():
        path = package / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)


def test_submodules_are_imported_in_name_order(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    write_package(tmp_path, "pkg_order", {"zeta.py": "X = 1\n", "alpha.py": "X = 2\n"})
    monkeypatch.syspath_prepend(str(tmp_path))

    found = submodules("pkg_order")

    assert [module.__name__ for module in found] == ["pkg_order.alpha", "pkg_order.zeta"]
    assert found[0].X == 2


def test_private_modules_and_tests_are_skipped(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    write_package(
        tmp_path,
        "pkg_skip",
        {
            "_types.py": "",
            "jobs.py": "",
            "tests/__init__.py": "",
            "tests/test_jobs.py": "",
            "conventions/__init__.py": "",
        },
    )
    monkeypatch.syspath_prepend(str(tmp_path))

    names = [module.__name__ for module in submodules("pkg_skip")]

    assert names == ["pkg_skip.conventions", "pkg_skip.jobs"]


def test_an_empty_package_has_no_submodules(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    write_package(tmp_path, "pkg_empty", {})
    monkeypatch.syspath_prepend(str(tmp_path))

    assert submodules("pkg_empty") == []
