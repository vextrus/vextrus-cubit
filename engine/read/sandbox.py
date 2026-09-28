"""The sandbox every subprocess reader runs in (docs/architecture.md, the engine; ADRs 0029, 0031).

A drawing is untrusted input, and the programs that decode it (LibreDWG's `dwgread` and `dwg2dxf`;
ACadSharp's dumper, 10) are C and .NET parsers. Each runs here, under bubblewrap:

- **no network:** every namespace is unshared (network, IPC, PID, UTS, cgroup, user), so the program
  sees only its own loopback; no new user namespace can be made inside; every capability is dropped;
- **a read-only file system but one output folder:** the root is empty and read-only; `/usr` (with the
  `/bin` and `/lib` links), a minimal `/proc` and `/dev`, and the paths the caller names are bound
  read-only; only `output` is writable. No home folder, no `/etc`, no `/tmp`;
- **a cleared environment:** no variable of the caller's reaches the program (so no key or database
  address), only `PATH`, `LANG`, `HOME` and `TMPDIR`, the last two pointing at `output`;
- **limits:** CPU seconds, address space (memory), the largest file it may write (all three set by
  `prlimit` on the process before bubblewrap starts, so they hold for everything inside), and a
  wall-clock timeout after which the whole run is killed; when the program ends, anything it left
  running dies with it (the PID namespace ends). At its CPU limit the program gets SIGXCPU, and
  SIGKILL a second later if it ignores that.

The program is started with `posix_spawn` (never a fork of this process: Python 3.14's pools start
with forkserver, and the worker may hold threads). Its CPU time and peak memory are not reported:
bubblewrap's PID namespace keeps the program's rusage from reaching this process (measured: 0.005 s
reported for a 1 s loop), and the peak that matters is the parse in the worker (ticket 24).

**It refuses to run unsandboxed.** Without a working bubblewrap it raises `SandboxUnavailable`. Only
when `VEXTRUS_SANDBOX` is exactly `off` *and* the call happens inside a pytest test does it run the
program directly (the limits and the timeout still apply), for a developer's machine without
bubblewrap; `VEXTRUS_SANDBOX=off` anywhere else raises `SandboxRefused`.
"""

import contextlib
import os
import shutil
import signal
import sys
import tempfile
import threading
import time
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from engine.messages import read as codes
from engine.read.errors import ReadError

BWRAP = "bwrap"
PRLIMIT = "prlimit"
_KEPT = 64 * 1024  # bytes of stdout and stderr kept (the end of each)


@dataclass(frozen=True)
class Limits:
    """A run's limits. The defaults are a first guess over docs/research/dwg-reader-evidence.md's
    measurements (`dwg2dxf` ≤ 0.84 s and ≤ 233 MB on seven real files); ticket 24 measures them."""

    cpu_seconds: int = 120
    memory_bytes: int = 3 * 2**30
    wall_seconds: float = 300.0
    output_bytes: int = 2 * 2**30


DEFAULT_LIMITS = Limits()


@dataclass(frozen=True)
class Finished:
    """A run that ended by itself, whatever its exit code."""

    exit_code: int
    stdout: bytes
    stderr: bytes
    wall_seconds: float
    sandboxed: bool


class SandboxError(ReadError):
    """A run that could not start, or was killed; `message` is what the file's finding says."""


class SandboxUnavailable(SandboxError):
    def __init__(self, detail: str) -> None:
        super().__init__(codes.SANDBOX_UNAVAILABLE())
        self.detail = detail


class SandboxRefused(SandboxError):
    def __init__(self) -> None:
        super().__init__(codes.SANDBOX_REFUSED())


class LimitReached(SandboxError):
    def __init__(self, program: str, limit: Literal["cpu", "wall"]) -> None:
        super().__init__(codes.LIMIT_REACHED(program=program, limit=limit))
        self.limit = limit


def run(
    argv: Sequence[str], *, reads: Sequence[Path], output: Path, limits: Limits = DEFAULT_LIMITS
) -> Finished:
    """Run `argv` (its first item an absolute path) in the sandbox, able to read `reads` and to
    write only in `output`, which must exist. Raises `SandboxError`s; returns however it exited."""
    output = output.resolve()
    if not output.is_dir():
        raise ValueError(f"the sandbox's output folder {output} does not exist")
    program = Path(argv[0]).name
    if _unsandboxed_permitted():
        return _spawn(program, argv, output, limits, sandboxed=False)
    if os.environ.get("VEXTRUS_SANDBOX") == "off":
        raise SandboxRefused()
    bwrap = shutil.which(BWRAP)
    if bwrap is None:
        raise SandboxUnavailable(f"{BWRAP} is not installed")
    command = [bwrap, *_bwrap_arguments(reads, output), "--", *argv]
    return _spawn(program, command, output, limits, sandboxed=True)


def _unsandboxed_permitted() -> bool:
    # Both: the word, and a test running now (pytest sets PYTEST_CURRENT_TEST only while one runs).
    return (
        os.environ.get("VEXTRUS_SANDBOX") == "off"
        and "pytest" in sys.modules
        and "PYTEST_CURRENT_TEST" in os.environ
    )


def _bwrap_arguments(reads: Sequence[Path], output: Path) -> list[str]:
    arguments = [
        "--unshare-all", "--unshare-user", "--disable-userns", "--cap-drop", "ALL",
        "--die-with-parent", "--new-session",
        "--ro-bind", "/usr", "/usr",
    ]  # fmt: skip
    for top in ("/bin", "/sbin", "/lib", "/lib32", "/lib64", "/libx32"):
        if os.path.islink(top):
            arguments += ["--symlink", os.readlink(top), top]
        elif os.path.isdir(top):
            arguments += ["--ro-bind", top, top]
    for path in reads:
        resolved = str(Path(path).resolve())
        arguments += ["--ro-bind", resolved, resolved]
    arguments += [
        "--proc", "/proc", "--dev", "/dev",
        "--bind", str(output), str(output),
        "--remount-ro", "/",
        "--chdir", str(output),
        "--clearenv",
        "--setenv", "PATH", "/usr/bin:/bin",
        "--setenv", "LANG", "C.UTF-8",
        "--setenv", "HOME", str(output),
        "--setenv", "TMPDIR", str(output),
    ]  # fmt: skip
    return arguments


def _spawn(
    program: str, argv: Sequence[str], output: Path, limits: Limits, *, sandboxed: bool
) -> Finished:
    prlimit = shutil.which(PRLIMIT)
    if prlimit is None:
        raise SandboxUnavailable(f"{PRLIMIT} is not installed")
    command = [
        prlimit,
        f"--cpu={limits.cpu_seconds}:{limits.cpu_seconds + 1}",
        f"--as={limits.memory_bytes}",
        f"--fsize={limits.output_bytes}",
        "--",
        *argv,
    ]
    environment = (
        {"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8", "HOME": str(output), "TMPDIR": str(output)}
        if not sandboxed
        else {"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"}
    )
    with tempfile.TemporaryDirectory(prefix="vextrus-sandbox-") as logs:
        out, err = Path(logs, "stdout"), Path(logs, "stderr")
        actions = [
            (os.POSIX_SPAWN_OPEN, 0, os.devnull, os.O_RDONLY, 0),
            (os.POSIX_SPAWN_OPEN, 1, str(out), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600),
            (os.POSIX_SPAWN_OPEN, 2, str(err), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600),
        ]
        started = time.monotonic()
        pid = os.posix_spawn(command[0], command, environment, file_actions=actions, setpgroup=0)
        timed_out = threading.Event()
        timer = threading.Timer(limits.wall_seconds, _kill, (pid, timed_out))
        timer.start()
        try:
            _, status = os.waitpid(pid, 0)
        finally:
            timer.cancel()
        wall = time.monotonic() - started
        stdout, stderr = _tail(out), _tail(err)
    if timed_out.is_set():
        raise LimitReached(program, "wall")
    exit_code = os.waitstatus_to_exitcode(status)
    if sandboxed and exit_code == 1 and stderr.startswith(b"bwrap: "):  # it could not build the sandbox
        raise SandboxUnavailable(stderr.decode(errors="replace").strip())
    if exit_code in (-signal.SIGXCPU, 128 + signal.SIGXCPU):  # bubblewrap reports 128 + the signal
        raise LimitReached(program, "cpu")
    return Finished(
        exit_code=exit_code,
        stdout=stdout,
        stderr=stderr,
        wall_seconds=wall,
        sandboxed=sandboxed,
    )


def _kill(pid: int, timed_out: threading.Event) -> None:
    timed_out.set()
    with contextlib.suppress(ProcessLookupError):
        os.killpg(pid, signal.SIGKILL)  # the run's own process group: bubblewrap, or the program


def _tail(path: Path) -> bytes:
    with path.open("rb") as file:
        file.seek(0, os.SEEK_END)
        file.seek(max(0, file.tell() - _KEPT))
        return file.read()
