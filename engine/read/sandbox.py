"""The sandbox every subprocess reader runs in (docs/architecture.md, the engine; ADRs 0029, 0031).

A drawing is untrusted input, and the programs that decode it (LibreDWG's `dwgread` and `dwg2dxf`;
ACadSharp's dumper, 10) are C and .NET parsers. Each runs here, under bubblewrap:

- **no network:** every namespace is unshared (network, IPC, PID, UTS, cgroup, user), so the program
  sees only its own loopback; no new user namespace can be made inside; every capability is dropped;
- **a read-only file system but one output folder:** the root is empty and read-only; `/usr` (with the
  `/bin` and `/lib` links), the sandbox's own `/proc`, the paths the caller names and four devices
  (`null`, `zero`, `random`, `urandom`) are bound read-only; only `output` is writable. No home
  folder, no `/etc`, no `/tmp`, and no `/dev/shm` or other memory-backed folder to fill. A path to
  read that lies inside `output`, or holds it, is refused, since the writable bind would cover it;
- **a cleared environment:** no variable of the caller's reaches the program (so no key or database
  address), only `PATH`, `LANG`, `HOME` and `TMPDIR`, the last two pointing at `output`;
- **limits:** CPU seconds, address space (memory) and the largest file it may write, set by `prlimit`
  before bubblewrap starts and inherited by every process inside, **each process's own** (a program
  that forks shares nothing, so its children may use as much again); and a wall-clock timeout after
  which the whole run is killed, which bounds the run as a whole. When the program ends, anything it
  left running dies with it (the PID namespace ends). At its CPU limit the program gets SIGXCPU
  (`LimitReached("cpu")`), and SIGKILL a second later if it ignores that; a run killed by SIGKILL
  that the timeout did not kill (that, or the kernel's memory killer) is `LimitReached("killed")`.
  Not limited: the output folder's total size (the file-size limit is per file, so many files can
  fill the disk it lives on) and the number of processes (`RLIMIT_NPROC` counts every process of the
  calling user, not only the run's, so a low one would refuse the run on a busy worker; the PID
  namespace and the wall clock end them all).

The program is started with `posix_spawn` (never a fork of this process: Python 3.14's pools start
with forkserver, and the worker may hold threads). Its CPU time and peak memory are not reported:
bubblewrap's PID namespace keeps the program's rusage from reaching this process (measured: 0.005 s
reported for a 1 s loop), and the peak that matters is the parse in the worker (ticket 24).

`bwrap` and `prlimit` are taken from `/usr/bin` by their full paths, never from `PATH`.

**What the program wrote is untrusted too.** The caller reads it outside the sandbox, so a compromised
program could leave a link to a host file where its output should be. `open_output` opens an output
without following a link (`O_NOFOLLOW`) and, on the open descriptor, requires a regular file with one
link; the caller parses that open stream and never opens the output by its path again.

**It refuses to run unsandboxed.** Without a working bubblewrap it raises `SandboxUnavailable`. Only
when `VEXTRUS_SANDBOX` is exactly `off` *and* the call happens inside a pytest test (pytest is
imported and `PYTEST_CURRENT_TEST` is set, which pytest does only while a test runs) does it run the
program directly, for a developer's machine without bubblewrap; `VEXTRUS_SANDBOX=off` anywhere else
raises `SandboxRefused`. That check guards against the setting reaching a server by mistake; code
running inside the worker could fake it, but such code needs no sandbox to escape. Run directly, the
limits and the timeout still apply, but a child that leaves the process group escapes the kill, and
the program's working folder is the caller's.
"""

import contextlib
import os
import shutil
import signal
import stat
import sys
import tempfile
import threading
import time
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Literal

from engine.messages import read as codes
from engine.read.errors import ReadError

BWRAP = "/usr/bin/bwrap"
PRLIMIT = "/usr/bin/prlimit"
_DEVICES = ("null", "zero", "random", "urandom")
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

    def __reduce__(self) -> tuple[type, tuple[object, ...]]:
        return (SandboxUnavailable, (self.detail,))


class SandboxRefused(SandboxError):
    def __init__(self) -> None:
        super().__init__(codes.SANDBOX_REFUSED())

    def __reduce__(self) -> tuple[type, tuple[object, ...]]:
        return (SandboxRefused, ())


type Limit = Literal["cpu", "wall", "killed"]


class LimitReached(SandboxError):
    def __init__(self, program: str, limit: Limit) -> None:
        super().__init__(codes.LIMIT_REACHED(limit=limit))
        self.program = program
        self.limit = limit

    def __reduce__(self) -> tuple[type, tuple[object, ...]]:
        return (LimitReached, (self.program, self.limit))


def run(
    argv: Sequence[str], *, reads: Sequence[Path], output: Path, limits: Limits = DEFAULT_LIMITS
) -> Finished:
    """Run `argv` (its first item an absolute path) in the sandbox, able to read `reads` and to
    write only in `output`, which must exist. Raises `SandboxError`s; returns however it exited."""
    output = output.resolve()
    if not output.is_dir():
        raise ValueError(f"the sandbox's output folder {output} does not exist")
    program = Path(argv[0]).name
    for path in reads:
        resolved = Path(path).resolve()
        if resolved.is_relative_to(output) or output.is_relative_to(resolved):
            raise ValueError(f"{resolved} would be writable: a path to read must lie outside {output}")
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
        "--proc", "/proc",
        *(item for name in _DEVICES for item in ("--dev-bind", f"/dev/{name}", f"/dev/{name}")),
        "--symlink", "/proc/self/fd", "/dev/fd",
        "--symlink", "/proc/self/fd/0", "/dev/stdin",
        "--symlink", "/proc/self/fd/1", "/dev/stdout",
        "--symlink", "/proc/self/fd/2", "/dev/stderr",
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
        run = _Run(pid)
        timer = threading.Timer(limits.wall_seconds, run.kill)
        timer.start()
        try:
            status = run.wait()
        finally:
            timer.cancel()
        wall = time.monotonic() - started
        stdout, stderr = _tail(out), _tail(err)
    if run.killed:
        raise LimitReached(program, "wall")
    exit_code = os.waitstatus_to_exitcode(status)
    if sandboxed and exit_code == 1 and stderr.startswith(b"bwrap: "):
        if stderr.startswith(b"bwrap: execvp"):  # the sandbox was built; the program is not there
            raise ReadError(codes.READER_FAILED(), program=program, exit_code=127)
        raise SandboxUnavailable(stderr.decode(errors="replace").strip())  # it could not build it
    if _signalled(exit_code, signal.SIGXCPU):
        raise LimitReached(program, "cpu")
    if _signalled(exit_code, signal.SIGKILL):
        raise LimitReached(program, "killed")
    return Finished(
        exit_code=exit_code,
        stdout=stdout,
        stderr=stderr,
        wall_seconds=wall,
        sandboxed=sandboxed,
    )


def open_output(path: Path, program: str) -> BinaryIO:
    """Open what `program` wrote at `path` for reading, as the file itself: never through a link, and
    only a regular file with one name. Raises `ReadError` (`output_unreadable`) otherwise."""
    try:
        descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC)
    except OSError as error:  # missing, or a symbolic link (ELOOP)
        raise ReadError(codes.OUTPUT_UNREADABLE(), program=program) from error
    status = os.fstat(descriptor)
    if not stat.S_ISREG(status.st_mode) or status.st_nlink != 1:  # a folder, a FIFO, a hard link
        os.close(descriptor)
        raise ReadError(codes.OUTPUT_UNREADABLE(), program=program)
    return os.fdopen(descriptor, "rb")


def _signalled(exit_code: int, number: int) -> bool:
    return exit_code in (-number, 128 + number)  # run directly, minus it; bubblewrap reports 128 + it


class _Run:
    """One spawned run, killed at most once and never after it has ended: the process is waited on
    without being reaped, so its id cannot be reused before `kill` has seen that it ended."""

    def __init__(self, pid: int) -> None:
        self.pid = pid
        self.killed = False
        self._ended = False
        self._lock = threading.Lock()

    def wait(self) -> int:
        os.waitid(os.P_PID, self.pid, os.WEXITED | os.WNOWAIT)
        with self._lock:
            self._ended = True
        _, status = os.waitpid(self.pid, 0)
        return status

    def kill(self) -> None:
        with self._lock:
            if self._ended:
                return
            self.killed = True
            with contextlib.suppress(ProcessLookupError):
                os.killpg(self.pid, signal.SIGKILL)  # its own process group: bubblewrap, or the program


def _tail(path: Path) -> bytes:
    with path.open("rb") as file:
        file.seek(0, os.SEEK_END)
        file.seek(max(0, file.tell() - _KEPT))
        return file.read()
