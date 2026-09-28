"""The dumper built from tools/acadsharp-dump/ for tests, the way scripts/owner/toolchain.sh builds it.

Restore (ACadSharp locked by hash), then the .NET runtime pack's .nupkg checked against
toolchain/acadsharp-dump.runtime.sha512, then publish with nothing more restored; parent-folder
imports, response files and node reuse off, and TMPDIR inside the build's folder. The tests that call
it are `needs_toolchain` (NuGet on the first restore). Its output must be the pinned build byte for
byte, so the tests run the program the pin names: a build that differs fails the pin test and is
refused by the reader, as it would be on a server.
"""

import hashlib
import os
import shutil
import subprocess
from pathlib import Path

from engine.fixtures.dwg import dotnet

ROOT = Path(__file__).resolve().parents[4]
SOURCE = ROOT / "tools" / "acadsharp-dump"
RUNTIME_PIN = ROOT / "toolchain" / "acadsharp-dump.runtime.sha512"
RUNTIME_PACK = "microsoft.netcore.app.runtime.linux-x64"
FILES = ("acadsharp-dump.csproj", "Program.cs", "packages.lock.json", "global.json")
FLAGS = (
    "-noAutoResponse", "-nodeReuse:false", "-p:ImportDirectoryBuildProps=false",
    "-p:ImportDirectoryBuildTargets=false", "-p:ImportDirectoryPackagesProps=false",
)  # fmt: skip


class RuntimePackNotPinned(RuntimeError):
    """The runtime pack NuGet gave is not the pinned one; nothing was built."""


def build_dumper(folder: Path, *, runtime_pin: Path = RUNTIME_PIN) -> Path:
    """Publish the dumper into `folder/prefix/` (its sources copied, so the tree stays clean) with a
    NuGet cache of its own; returns the prefix, the folder `VEXTRUS_ACADSHARP_DUMP` names."""
    source = folder / "source"
    source.mkdir(parents=True)
    for name in FILES:
        shutil.copy(SOURCE / name, source / name)
    (folder / "tmp").mkdir()
    environment = {
        **os.environ,
        "DOTNET_CLI_TELEMETRY_OPTOUT": "1",
        "DOTNET_NOLOGO": "1",
        "DOTNET_CLI_HOME": str(folder / "dotnet-home"),
        "NUGET_PACKAGES": str(folder / "nuget"),
        "TMPDIR": str(folder / "tmp"),
    }

    def dotnet_here(*arguments: str) -> None:
        command = [str(dotnet()), *arguments[:1], str(source), *arguments[1:], *FLAGS]
        done = subprocess.run(
            command, capture_output=True, text=True, timeout=600, env=environment, cwd=source
        )
        if done.returncode != 0:
            raise RuntimeError(
                f"the dumper's {arguments[0]} failed ({done.returncode}):\n{done.stdout}\n{done.stderr}"
            )

    dotnet_here("restore")
    check_runtime_pack(folder / "nuget", runtime_pin)
    prefix = folder / "prefix"
    dotnet_here("publish", "-c", "Release", "-o", str(prefix), "--no-restore")
    return prefix


def check_runtime_pack(nuget: Path, pin: Path) -> None:
    """The restored runtime pack's .nupkg has the pinned sha512 (`sha512sum`'s format)."""
    digest, name = pin.read_text(encoding="ascii").split()
    packs = list((nuget / RUNTIME_PACK).glob(f"*/{name}"))
    if len(packs) != 1 or hashlib.sha512(packs[0].read_bytes()).hexdigest() != digest:
        raise RuntimePackNotPinned(f"{RUNTIME_PACK} restored is not {pin.name}'s")
