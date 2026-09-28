"""The dumper built from tools/acadsharp-dump/ for tests, the way scripts/owner/toolchain.sh builds it.

The build restores ACadSharp from NuGet in locked mode (the tests that call it are `needs_toolchain`)
and its output must be the pinned build byte for byte, so the tests run the program the pin names:
a build that differs fails the pin test and is refused by the reader, as it would be on a server.
"""

import os
import shutil
import subprocess
from pathlib import Path

from engine.fixtures.dwg import dotnet

SOURCE = Path(__file__).resolve().parents[4] / "tools" / "acadsharp-dump"
FILES = ("acadsharp-dump.csproj", "Program.cs", "packages.lock.json")


def build_dumper(folder: Path) -> Path:
    """Publish the dumper into `folder/prefix/` (its sources copied, so the tree stays clean) with a
    NuGet cache of its own; returns the prefix, the folder `VEXTRUS_ACADSHARP_DUMP` names."""
    source = folder / "source"
    source.mkdir(parents=True)
    for name in FILES:
        shutil.copy(SOURCE / name, source / name)
    prefix = folder / "prefix"
    environment = {
        **os.environ,
        "DOTNET_CLI_TELEMETRY_OPTOUT": "1",
        "DOTNET_NOLOGO": "1",
        "DOTNET_CLI_HOME": str(folder / "dotnet-home"),
        "NUGET_PACKAGES": str(folder / "nuget"),
    }
    command = [str(dotnet()), "publish", str(source), "-c", "Release", "-o", str(prefix)]
    done = subprocess.run(command, capture_output=True, text=True, timeout=600, env=environment)
    if done.returncode != 0:
        raise RuntimeError(
            f"the dumper's build failed ({done.returncode}):\n{done.stdout}\n{done.stderr}"
        )
    return prefix
