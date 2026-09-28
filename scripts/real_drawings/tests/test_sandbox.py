"""The real sandbox, with the real toolchain and bwrap (the M0 plan, the real-drawing check, steps 2
and 3): an invented wheel installed offline by hash, and a probing harness in place of the engine's,
which reports what the PR's code could reach from inside. Run where the toolchain is installed:

    uv run pytest -m "needs_toolchain or needs_bwrap" scripts/real_drawings/tests/test_sandbox.py
"""

import base64
import hashlib
import json
import os
import zipfile
from pathlib import Path
from typing import Any

import pytest

from scripts.real_drawings.drop import take
from scripts.real_drawings.sandbox import Job, run
from scripts.real_drawings.source import Refused

pytestmark = [pytest.mark.needs_toolchain, pytest.mark.needs_bwrap]

ROOT = Path(__file__).resolve().parents[3]
TOOLCHAIN = Path("/opt/vextrus")
PIN = (ROOT / "toolchain" / "python.version").read_text().strip()
PYTHON = TOOLCHAIN / "python" / f"cpython-{PIN}-linux-x86_64-gnu" / "bin" / "python3"

PROBE = """
import json, os, socket, sys
from pathlib import Path

def writable(path):
    try:
        Path(path, "probe").write_text("x")
        return True
    except OSError:
        return False

def connects():
    try:
        socket.create_connection(("1.1.1.1", 53), timeout=3).close()
        return True
    except OSError:
        return False

import invented_probe
PLACES = ("/work/src", "/work/wheels", "/opt/vextrus", "/usr", "/", "/work/out")
out = Path(sys.argv[sys.argv.index("--out") + 1])
out.write_text(json.dumps({"files": [], "probe": {
    "installed": invented_probe.VALUE,
    "connects": connects(),
    "interfaces": [name for _, name in socket.if_nameindex()],
    "env": sorted(os.environ),
    "home_visible": os.path.exists(HOME),
    "drop_visible": os.path.exists(DROP),
    "set_files": sorted(os.listdir(sys.argv[sys.argv.index("--set") + 1])),
    "writable": {p: writable(p) for p in PLACES},
}}))
"""


def wheel(folder: Path) -> tuple[str, str]:
    """An invented pure wheel, as a wheel is laid out; returns its name and sha256."""
    name = "invented_probe-1.0-py3-none-any.whl"
    info = "invented_probe-1.0.dist-info"
    files = {
        "invented_probe.py": b"VALUE = 'installed offline'\n",
        f"{info}/METADATA": b"Metadata-Version: 2.1\nName: invented-probe\nVersion: 1.0\n",
        f"{info}/WHEEL": b"Wheel-Version: 1.0\nRoot-Is-Purelib: true\nTag: py3-none-any\n",
    }
    record = "".join(
        f"{path},sha256={base64.urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b'=').decode()},"
        f"{len(data)}\n"
        for path, data in files.items()
    )
    record += "invented_probe-1.0.dist-info/RECORD,,\n"
    with zipfile.ZipFile(folder / name, "w") as archive:
        for path, data in files.items():
            archive.writestr(path, data)
        archive.writestr("invented_probe-1.0.dist-info/RECORD", record)
    return name, hashlib.sha256((folder / name).read_bytes()).hexdigest()


def job(tmp_path: Path, requirements: str) -> Job:
    checkout, wheels, sets, scratch = (tmp_path / n for n in ("src", "wheels", "sets", "out"))
    (checkout / "engine").mkdir(parents=True)
    (checkout / "engine" / "__init__.py").write_text("")
    drop = tmp_path / "drop"
    drop.mkdir()
    probe = f"HOME = {str(Path.home())!r}\nDROP = {str(drop)!r}\n" + PROBE
    (checkout / "engine" / "harness.py").write_text(probe)
    wheels.mkdir()
    (sets / "invented").mkdir(parents=True)
    (sets / "invented" / "sheet-1.bin").write_bytes(b"invented")
    scratch.mkdir()
    _, sha = wheel(wheels)
    (tmp_path / "requirements.txt").write_text(requirements.format(sha=sha))
    env = {"VEXTRUS_RUN_ID": "invented-run"}
    return Job(
        PYTHON,
        TOOLCHAIN,
        checkout,
        wheels,
        tmp_path / "requirements.txt",
        {"invented": sets / "invented"},
        scratch,
        env,
    )


def probe(tmp_path: Path) -> dict[str, Any]:
    take(tmp_path / "out", "export-invented.json", tmp_path / "export.json")
    return json.loads((tmp_path / "export.json").read_text())["probe"]  # type: ignore[no-any-return]


def test_the_pipeline_runs_offline_with_only_its_scratch_writable(tmp_path: Path) -> None:
    run(job(tmp_path, "invented-probe==1.0 --hash=sha256:{sha}\n"), tmp_path / "sandbox.log")

    found = probe(tmp_path)
    assert found["installed"] == "installed offline"
    assert found["connects"] is False
    assert found["interfaces"] == ["lo"]
    assert found["home_visible"] is False
    assert found["drop_visible"] is False
    assert found["set_files"] == ["sheet-1.bin"]
    assert found["writable"] == {
        "/work/src": False,
        "/work/wheels": False,
        "/opt/vextrus": False,
        "/usr": False,
        "/": False,
        "/work/out": True,
    }
    assert set(found["env"]) <= {"HOME", "LANG", "PATH", "PWD", "TMPDIR", "LC_CTYPE", "VEXTRUS_RUN_ID"}


def test_a_wheel_whose_hash_is_not_the_locked_one_is_not_installed(tmp_path: Path) -> None:
    with pytest.raises(Refused, match="exit code"):
        run(
            job(tmp_path, "invented-probe==1.0 --hash=sha256:" + "0" * 64 + "\n"),
            tmp_path / "sandbox.log",
        )

    assert "export-invented.json" not in os.listdir(tmp_path / "out")
    assert "THESE PACKAGES DO NOT MATCH THE HASHES" in (tmp_path / "sandbox.log").read_text()
