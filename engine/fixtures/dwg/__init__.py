"""Synthetic DWG fixtures: one generator per file here (`<name>.py`), built at test time, never
committed.

A generator draws with ezdxf, starting from `new_drawing()`, and exposes `VERSION` (the DWG version to
write, an AutoCAD version name such as `AC1032`) and `draw() -> ezdxf.document.Drawing`.
`build(name, folder, writer)` saves the drawing as DXF and has the writer save it as DWG. They prove
the reader's mechanics only, never a reading (docs/sdlc.md: synthetic fixtures are never offered as
proof).

**The writer, and its licence** (checked 28 Sep 2026, ticket 04): ezdxf 1.4.4 writes the DXF (MIT, its
wheel's `License :: OSI Approved :: MIT License`); ACadSharp 3.8.0 writes the DWG (MIT: its NuGet
package's `<license type="expression">MIT</license>`), through `_writer/`, a C# program of ours built
by the test run against the package pinned by hash in `_writer/packages.lock.json`. Both licences
allow this use, and neither program ships: only tests build and run it.

LibreDWG's own `dxf2dwg` (GPL-3.0-or-later, whose output would be free of the licence too) was tried
first and rejected on quality: it writes only R2000 and R2004 (never the AC1021 and AC1032 of the real
sets), dropped every model-space entity's layer and the MTEXT heights, and on R2004 lost model space
altogether. ACadSharp writes AC1018 to AC1032, and LibreDWG 0.14 decodes its AC1024 and AC1032 ATTRIBs
with the null style seen on real files, so the ATTDEF-style repair is exercised as on real drawings.

Two things ezdxf will not write, and how a generator asks for them:
- a raw line break in MTEXT: write DXF's caret form `^J`, which ACadSharp stores as the line break;
- an MTEXT with no height (as MTEXT inside real blocks has): give `char_height=NO_HEIGHT`, which
  `build` writes as 0 (ezdxf replaces a zero height with its default).

The writer needs the .NET SDK (`/opt/vextrus/dotnet`, or `VEXTRUS_DOTNET`) and NuGet on its first
build; tests that build fixtures are marked `needs_toolchain`.
"""

import os
import shutil
import subprocess
from importlib import import_module
from pathlib import Path
from types import ModuleType

from ezdxf.document import Drawing
from ezdxf.filemanagement import new

NO_HEIGHT = 0.000123456789
WRITER = Path(__file__).with_name("_writer")


def new_drawing() -> Drawing:
    """An empty drawing with no styles, blocks or layers beyond the defaults, so a fixture's counts
    are its own (ezdxf's `setup` adds arrow blocks); the dimension style it names exists."""
    doc = new("R2018", setup=False)
    doc.header["$DIMSTYLE"] = "Standard"
    return doc


def dotnet() -> Path:
    return Path(os.environ.get("VEXTRUS_DOTNET", "/opt/vextrus/dotnet")) / "dotnet"


def generator(name: str) -> ModuleType:
    return import_module(f"{__name__}.{name}")


def build_writer(folder: Path) -> Path:
    """Build the writer into `folder` (its sources copied there, so the tree stays clean)."""
    source = folder / "writer-src"
    shutil.copytree(WRITER, source, ignore=shutil.ignore_patterns("bin", "obj"))
    output = folder / "writer"
    _run([str(dotnet()), "build", str(source), "-c", "Release", "-o", str(output), "-nologo"], 600)
    return output / "Writer.dll"


def build(name: str, folder: Path, writer: Path) -> Path:
    """Build fixture `name` into `folder` with a writer from `build_writer`; returns the DWG's path."""
    module = generator(name)
    dxf = folder / f"{name}.dxf"
    module.draw().saveas(dxf)
    marked = repr(NO_HEIGHT)
    text = dxf.read_text(encoding="utf-8")
    lines = ("0.0" if line.rstrip("\r") == marked else line for line in text.split("\n"))
    dxf.write_text("\n".join(lines), encoding="utf-8")
    dwg = folder / f"{name}.dwg"
    _run([str(dotnet()), str(writer), str(dxf), str(dwg), module.VERSION], 120)
    return dwg


def _run(command: list[str], timeout: int) -> None:
    environment = {**os.environ, "DOTNET_CLI_TELEMETRY_OPTOUT": "1", "DOTNET_NOLOGO": "1"}
    done = subprocess.run(command, capture_output=True, text=True, timeout=timeout, env=environment)
    if done.returncode != 0:
        raise RuntimeError(f"{command[0]} failed ({done.returncode}):\n{done.stdout}\n{done.stderr}")
