"""Reads a verify plan's pytest invocations from their argv (the plan's boundary), whatever the check
names: the worker count (`-n N`, `-nN`, `--numprocesses N`, `--numprocesses=N`), the folders it
collects (its positional arguments; none is the whole suite) and what it leaves out (`--ignore`,
`--ignore-glob`)."""

from collections.abc import Iterable
from dataclasses import dataclass, field
from fnmatch import fnmatch
from pathlib import Path

from scripts.verify import Check, plan_with_notes

VALUED = {
    "-p",
    "-n",
    "--numprocesses",
    "--maxprocesses",
    "--dist",
    "-k",
    "-m",
    "-c",
    "--rootdir",
    "-o",
    "--override-ini",
    "--ignore",
    "--ignore-glob",
    "--deselect",
    "--junitxml",
    "--basetemp",
    "-W",
    "--tb",
    "--durations",
    "--confcutdir",
    "--maxfail",
}


def _path(text: str) -> str:
    text = text.removeprefix("./").rstrip("/")
    return text or "."


@dataclass
class Pytest:
    name: str
    argv: tuple[str, ...]
    workers: str | None = None
    plugins: list[str] = field(default_factory=list)
    targets: list[str] = field(default_factory=list)
    ignores: list[str] = field(default_factory=list)
    ignore_globs: list[str] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)

    @property
    def parallel(self) -> bool:
        """Distributed over two or more xdist workers."""
        return self.workers is not None and self.workers.isdigit() and int(self.workers) >= 2

    @property
    def serial(self) -> bool:
        """No `-n` at all, or xdist switched off (`-p no:xdist`)."""
        return self.workers is None or "no:xdist" in self.plugins

    def ignored(self, probe: str) -> bool:
        if any(probe == path or probe.startswith(path + "/") for path in self.ignores):
            return True
        samples = (probe, probe + "/", probe + "/test_x.py")
        return any(fnmatch(sample, glob) for glob in self.ignore_globs for sample in samples)

    def collects_all(self, probe: str) -> bool:
        """Every test under `probe` is collected by this run."""
        whole = any(t == "." or probe == t or probe.startswith(t + "/") for t in self.targets or ["."])
        return whole and not self.ignored(probe)

    def collects_any(self, probe: str) -> bool:
        """Some test under `probe` is collected by this run."""
        if self.collects_all(probe):
            return True
        return any(t.startswith(probe + "/") and not self.ignored(t) for t in self.targets)


def _program_end(argv: tuple[str, ...]) -> int | None:
    """The index just after the `pytest` program (`uv run pytest`, `python -m pytest`), else None."""
    for index, token in enumerate(argv):
        if token == "pytest" and (index <= 2 or argv[index - 1] == "-m"):
            return index + 1
    return None


def pytest_of(check: Check) -> Pytest | None:
    start = _program_end(check.argv)
    if start is None:
        return None
    found = Pytest(check.name, check.argv)
    tokens = list(check.argv[start:])
    index = 0
    while index < len(tokens):
        token = tokens[index]
        key, value = token, None
        if token in VALUED and index + 1 < len(tokens):
            value = tokens[index + 1]
            index += 1
        elif token.startswith("--") and "=" in token:
            key, value = token.split("=", 1)
        elif token.startswith("-n") and len(token) > 2:
            key, value = "-n", token[2:]
        elif token.startswith("-p") and len(token) > 2:
            key, value = "-p", token[2:]
        index += 1
        if value is None:
            (found.flags if token.startswith("-") else found.targets).append(
                token if token.startswith("-") else _path(token)
            )
        elif key in ("-n", "--numprocesses"):
            found.workers = value
        elif key == "-p":
            found.plugins.append(value)
        elif key == "--ignore":
            found.ignores.append(_path(value))
        elif key == "--ignore-glob":
            found.ignore_globs.append(value.removeprefix("./"))
    return found


def pytests(paths: Iterable[str], root: Path) -> list[Pytest]:
    """The pytest invocations verify plans for these changed paths."""
    checks, _ = plan_with_notes(paths, have=lambda tool: False, root=root)
    return [run for check in checks if (run := pytest_of(check)) is not None]
