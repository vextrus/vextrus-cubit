"""The lock check: every locked package comes from the registry, and nothing is built from source."""

from pathlib import Path

import pytest

from tools.lint.lock_sources import main, problems

REPO = Path(__file__).resolve().parents[3]

PYPROJECT = '[project]\nname = "vextrus"\n\n[tool.uv]\npackage = false\nno-build = true\n'
REGISTRY = '{ registry = "https://pypi.org/simple" }'


def lock(*packages: tuple[str, str]) -> str:
    return "version = 1\n" + "".join(
        f'\n[[package]]\nname = "{name}"\nversion = "1.0"\nsource = {source}\n'
        for name, source in packages
    )


def write(root: Path, pyproject: str, lock_text: str) -> Path:
    (root / "pyproject.toml").write_text(pyproject)
    (root / "uv.lock").write_text(lock_text)
    return root


def test_registry_packages_and_the_virtual_project_pass(tmp_path: Path) -> None:
    root = write(tmp_path, PYPROJECT, lock(("django", REGISTRY), ("vextrus", '{ virtual = "." }')))

    assert problems(root) == []


@pytest.mark.parametrize(
    "source",
    [
        '{ git = "https://github.com/someone/ezdxf?rev=abc" }',
        '{ url = "https://example.com/ezdxf-1.4.4.tar.gz" }',
        '{ path = "wheels/ezdxf-1.4.4-cp314-cp314-linux_x86_64.whl" }',
        '{ registry = "https://mirror.example.com/simple" }',
        '{ editable = "../ezdxf" }',
    ],
)
def test_any_other_source_fails(tmp_path: Path, source: str) -> None:
    root = write(tmp_path, PYPROJECT, lock(("ezdxf", source)))

    assert [problem.split(":")[0] for problem in problems(root)] == ["ezdxf"]


@pytest.mark.parametrize(
    "extra",
    [
        '\n[tool.uv]\nno-binary-package = ["ezdxf"]\n',
        '\n[tool.uv.sources]\nezdxf = { git = "https://github.com/someone/ezdxf" }\n',
    ],
)
def test_building_from_source_or_a_redirected_source_in_pyproject_fails(
    tmp_path: Path, extra: str
) -> None:
    pyproject = '[project]\nname = "vextrus"\n' + extra
    root = write(tmp_path, pyproject, lock(("django", REGISTRY)))

    assert problems(root) != []


def test_the_project_must_never_build(tmp_path: Path) -> None:
    root = write(tmp_path, '[project]\nname = "vextrus"\n', lock(("django", REGISTRY)))

    assert any("no-build" in problem for problem in problems(root))


def test_this_repository_s_lock_passes(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--root", str(REPO)]) == 0, capsys.readouterr().out
