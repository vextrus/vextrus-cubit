"""The installed real-drawing command starts from its installed copy alone (hotfix, session 08).

`scripts/owner/keys-custody.sh` installs exactly `runner.FILES` under root's installed folder and a
launcher that runs the toolchain's Python with `-I`, puts that folder first on `sys.path` and calls
`scripts.real_drawings.runner.launch()`. Its wall check "may run the installed command as vxrun (its
usage)" runs that launcher with `--help`. These tests build the same copy, nothing else, in a temporary
folder and run it with the interpreter the tests run under, `-I`, from a folder outside the repository.
"""

import re
import shutil
import subprocess
import sys
from pathlib import Path

from scripts.real_drawings import runner

REPO = Path(__file__).resolve().parents[5]
KEYS_CUSTODY = REPO / "scripts" / "owner" / "keys-custody.sh"


def installed_copy(into: Path) -> Path:
    """Exactly `runner.FILES`, copied from the repository under `into`, as keys-custody.sh installs."""
    root = into / "runner"
    for path in runner.FILES:
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(REPO / path, target)
    return root


def launcher_code(root: Path) -> str:
    """keys-custody.sh's launcher, its installed folder replaced by `root`."""
    match = re.search(r"(?s)<<LAUNCHER\n(.*?)\nLAUNCHER\n", KEYS_CUSTODY.read_text())
    assert match, "keys-custody.sh writes its launcher in a LAUNCHER heredoc"
    body = match.group(1)
    assert '"$INSTALLED"' in body
    return body.replace('"$INSTALLED"', repr(str(root)))


def run_isolated(code: str, *args: str, cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-I", "-c", code, *args],
        cwd=cwd,
        env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"},
        capture_output=True,
        text=True,
        check=False,
    )


def test_the_installed_command_prints_its_usage_from_the_installed_copy_alone(tmp_path: Path) -> None:
    root = installed_copy(tmp_path)
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    # vxrun's home (/var/lib/vxrun) does not exist on a test machine: `launch()`'s change of folder is
    # the only step neutralised; everything else is the launcher as installed.
    code = "import os\nos.chdir = lambda path: None\n" + launcher_code(root)
    result = run_isolated(code, "--help", cwd=elsewhere)
    assert result.returncode == 0, result.stderr
    assert "usage: real-drawings-run" in result.stdout


def test_every_module_in_the_installed_copy_imports_from_it_alone(tmp_path: Path) -> None:
    """The class: no module in FILES reads, at import, a file the installed copy does not carry."""
    root = installed_copy(tmp_path)
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    modules = [
        path.removesuffix(".py").removesuffix("/__init__").replace("/", ".")
        for path in runner.FILES
        if path.endswith(".py")  # FILES may also carry a data file the modules read
    ]
    code = (
        "import importlib, sys\n"
        f"sys.path.insert(0, {str(root)!r})\n"
        f"for name in {modules!r}:\n"
        "    module = importlib.import_module(name)\n"
        f"    assert module.__file__.startswith({str(root)!r}), (name, module.__file__)\n"
    )
    result = run_isolated(code, cwd=elsewhere)
    assert result.returncode == 0, result.stderr
