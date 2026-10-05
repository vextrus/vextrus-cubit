"""The second decoder: ACadSharp's reading of a DWG, for the cross-check (ticket 10; ADR 0029).

`dump(path) -> Dump` runs the ACadSharp dumper (tools/acadsharp-dump/) on the file, in the sandbox
LibreDWG runs in (engine/read/sandbox.py: no network, the file and the program read-only, only a fresh
output folder writable, the same limits), and reads what it wrote strictly (dump.py). It raises
`ReadError` with the file's finding when it cannot; it never returns a reading it did not get.

**How the dumper arrives, and why it is trusted** (the M0 plan, ticket 10: pinned and verifiable, as
LibreDWG is). The dumper is one self-contained file, the .NET runtime inside it, built reproducibly from
tools/acadsharp-dump/ with the pinned SDK (its global.json), ACadSharp compiled from its source (ticket
W317: ACadSharp 3.8.0's commit and its CSUtilities submodule's, each file pinned by a manifest, plus
DomCR/ACadSharp#1205's DWG scale repair, a patch pinned by sha256, all in
`toolchain/acadsharp-source.lock`), the packages its lock files pin by hash, and the .NET runtime pack
no lock lists, pinned by its own sha512 (`toolchain/acadsharp-dump.runtime.sha512`); the file's sha256
is pinned in `toolchain/acadsharp-dump.sha256`, read from the checkout this code runs from.
scripts/owner/toolchain.sh builds it and installs it in `/opt/vextrus/acadsharp-dump/<sha256[:12]>/`,
a folder of its pin's own, only when its hash is the pin, and removes no other pin's: a checkout runs
the dumper its own pin names, so checkouts on two pins read side by side. That is the one install today
(the product's worker, when it is built, installs it the same way). `VEXTRUS_ACADSHARP_DUMP` names
another install folder, for tests and a machine that installs it elsewhere: it moves where the program
is looked for, never the pin. Nothing is restored, built or downloaded when a file is read.

**Every run checks the program's hash against the pin first** and refuses a program that is missing
(`DumperNotInstalled`) or differs (`DumperNotPinned`): a swapped or rebuilt dumper never reads a file.
The hash is taken on each run, never cached, so a program replaced between two files is refused at
the second. What it cannot stop is a swap between the hash and the start, a moment apart: that needs
write access to the install folder, which only root has (toolchain.sh leaves it writable by none).
The program's path is resolved first, so a link is followed to the file that is hashed and run.
"""

import hashlib
import os
import stat
import tempfile
from dataclasses import replace
from pathlib import Path

from engine.messages import decoders_agree as codes
from engine.read.acadsharp.dump import DUMPER, MAX_BYTES, MAX_ENTITIES, Dump, DumpTooLarge, parse
from engine.read.errors import ReadError
from engine.read.sandbox import (
    DEFAULT_LIMITS,
    LimitReached,
    Limits,
    SandboxRefused,
    SandboxUnavailable,
    open_output,
    run,
)

__all__ = [
    "Dump",
    "DumpTooLarge",
    "DumperNotInstalled",
    "DumperNotPinned",
    "DumperStopped",
    "dump",
    "run_dumper",
]

READER = "acadsharp"
PIN = Path(__file__).resolve().parents[3] / "toolchain" / "acadsharp-dump.sha256"


class DumperNotInstalled(ReadError):
    """The dumper is not where the reader looks for it: the file is read by one reader only."""

    def __init__(self) -> None:
        super().__init__(codes.NOT_INSTALLED())

    def __reduce__(self) -> tuple[type, tuple[object, ...]]:
        return (DumperNotInstalled, ())


class DumperNotPinned(ReadError):
    """The dumper installed is not the pinned build, so it is not run."""

    def __init__(self) -> None:
        super().__init__(codes.NOT_PINNED())

    def __reduce__(self) -> tuple[type, tuple[object, ...]]:
        return (DumperNotPinned, ())


class DumperStopped(ReadError):
    """The dumper ran and stopped before it finished: it exited with an error, could not start,
    reached a limit, or left no dump that can be read. The first reader read the file, so the finding
    is the cross-check's own (`stopped`), never 04's "could not be read". `program` and `why`
    (`exit 139`, `limit wall`, `could not start`, `output unreadable`) are in its args for the log;
    the finding carries neither (a program's name and an exit code are not for a QS)."""

    def __init__(self, program: str, why: str) -> None:
        super().__init__(codes.STOPPED())
        self.program = program
        self.why = why
        self.args = (*self.args, program, why)

    def __reduce__(self) -> tuple[type, tuple[object, ...]]:
        return (DumperStopped, (self.program, self.why))


def prefix() -> Path:
    return Path(os.environ.get("VEXTRUS_ACADSHARP_DUMP", "/opt/vextrus/acadsharp-dump"))


def pinned_sha256() -> str:
    """The pinned build's sha256, from toolchain/acadsharp-dump.sha256 (`sha256sum`'s format)."""
    digest, name = PIN.read_text(encoding="ascii").split()
    if name != DUMPER or len(digest) != 64 or digest.strip("0123456789abcdef"):
        raise ValueError(f"{PIN.name} does not pin {DUMPER} by a sha256")
    return digest


def dump(path: Path, *, limits: Limits = DEFAULT_LIMITS) -> Dump:
    """ACadSharp's reading of the DWG at `path`, by the dumper installed at the checkout's pin, in
    the install folder's `<sha256[:12]>/`."""
    pinned = pinned_sha256()
    return run_dumper(prefix() / pinned[:12] / DUMPER, Path(path), sha256=pinned, limits=limits)


def run_dumper(program: Path, path: Path, *, sha256: str, limits: Limits = DEFAULT_LIMITS) -> Dump:
    """Run `program` on `path` in the sandbox, only if its sha256 is `sha256`, and read its dump."""
    program = _verified(program, sha256)
    path = path.resolve()
    # The dump's own bound is the largest file it may write: a dumper that writes more is stopped.
    # (The .NET runtime needs some of it to start: measured, it starts under 16 MiB and not 1 MiB.)
    capped = replace(limits, output_bytes=min(limits.output_bytes, MAX_BYTES))
    with tempfile.TemporaryDirectory(prefix="vextrus-read-") as scratch:
        folder = Path(scratch, "acadsharp")
        folder.mkdir()
        target = folder / "dump.jsonl"
        try:
            finished = run(
                [str(program), str(path), str(target)],
                reads=[program, path],
                output=folder,
                limits=capped,
            )
        except SandboxUnavailable, SandboxRefused:
            # The machine cannot read drawings at all: both readers stop on it, the first (run first)
            # already has, and 04's words about it stay true. Kept as they are.
            raise
        except LimitReached as error:
            raise DumperStopped(DUMPER, f"limit {error.limit}") from error
        except ReadError as error:  # the sandbox was built; the program could not be started in it
            raise DumperStopped(DUMPER, "could not start") from error
        if finished.exit_code != 0:
            if _reached(target, capped.output_bytes):
                raise DumpTooLarge(MAX_ENTITIES)
            raise DumperStopped(DUMPER, f"exit {finished.exit_code}")
        try:
            with open_output(target, DUMPER) as stream:
                return parse(stream, max_bytes=MAX_BYTES, max_entities=MAX_ENTITIES)
        except DumpTooLarge:
            raise
        except (ReadError, ValueError, OSError) as error:
            raise DumperStopped(DUMPER, "output unreadable") from error


def _reached(target: Path, limit: int) -> bool:
    """Whether the dumper stopped because its dump reached the largest file it may write. The
    limit's signal (SIGXFSZ) is not seen: Python ignores it and the program inherits that, so its
    write fails instead; a dump as large as the limit is what tells it. The dump is looked at, never
    followed (a link there is not a dump)."""
    try:
        status = os.lstat(target)
    except OSError:
        return False
    return stat.S_ISREG(status.st_mode) and status.st_size >= limit


def _verified(program: Path, sha256: str) -> Path:
    try:
        program = program.resolve(strict=True)
        descriptor = os.open(program, os.O_RDONLY | os.O_NONBLOCK | os.O_CLOEXEC)
    except OSError as error:
        raise DumperNotInstalled() from error
    if not stat.S_ISREG(os.fstat(descriptor).st_mode):  # a folder or a FIFO is no program
        os.close(descriptor)
        raise DumperNotInstalled()
    with os.fdopen(descriptor, "rb") as file:
        digest = hashlib.file_digest(file, "sha256").hexdigest()
    if digest != sha256:
        raise DumperNotPinned()
    return program
