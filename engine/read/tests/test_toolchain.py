"""The toolchain the engine reads with (the M0 plan, 01c; s02 reviews A3, R5): pinned in `toolchain/`,
installed under /opt/vextrus everywhere (locally by scripts/owner/toolchain.sh, in CI by engine.yml, in
the cloud by scripts/cloud/setup.sh), where the real-drawing check's sandbox binds it read-only.

The pins' own consistency runs in every test run; the rest runs where the toolchain is installed:
    uv run pytest -m "needs_toolchain or needs_bwrap" engine/read/tests/test_toolchain.py
"""

import hashlib
import importlib
import os
import platform
import re
import subprocess
import sys
import tomllib
from importlib import metadata
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
PINS = ROOT / "toolchain"
PREFIX = Path("/opt/vextrus")


def pin(name: str) -> str:
    return (PINS / name).read_text().strip()


def ezdxf_lock() -> dict[str, str]:
    with (PINS / "ezdxf.lock").open("rb") as file:
        return tomllib.load(file)


def run(*command: str | Path) -> str:
    env = {**os.environ, "DOTNET_CLI_TELEMETRY_OPTOUT": "1", "DOTNET_NOLOGO": "1"}
    done = subprocess.run(command, capture_output=True, text=True, check=True, timeout=60, env=env)
    return done.stdout + done.stderr


def test_the_libredwg_source_hash_names_the_pinned_version() -> None:
    digest, name = pin("libredwg.sha256").split()

    assert name == f"libredwg-{pin('libredwg.version')}.tar.xz"
    assert len(digest) == 64


def test_the_cloud_setup_carries_the_same_pins() -> None:
    setup = (ROOT / "scripts" / "cloud" / "setup.sh").read_text()
    carried = dict(re.findall(r"^([A-Z0-9_]+)=(\S+)$", setup, flags=re.MULTILINE))

    assert {
        "PY_VERSION": pin("python.version"),
        "DOTNET_SDK_VERSION": pin("dotnet.version"),
        "LIBREDWG_VERSION": pin("libredwg.version"),
        "LIBREDWG_SHA256": pin("libredwg.sha256").split()[0],
    }.items() <= carried.items()


def test_the_ezdxf_lock_agrees_with_uv_lock_and_the_build_constraints() -> None:
    lock = ezdxf_lock()
    with (ROOT / "uv.lock").open("rb") as file:
        (locked,) = [p for p in tomllib.load(file)["package"] if p["name"] == "ezdxf"]
    constraints = (PINS / "ezdxf-build-constraints.txt").read_bytes()

    assert lock["version"] == locked["version"]
    assert f"sha256:{lock['sdist_sha256']}" == locked["sdist"]["hash"]
    assert lock["constraints_sha256"] == hashlib.sha256(constraints).hexdigest()
    assert lock["wheel"].startswith(f"ezdxf-{lock['version']}-")
    if lock["wheel"].endswith("-py3-none-any.whl"):  # the registry's pure wheel, as uv.lock has it
        assert lock["release"] == ""
        assert {"url": locked["wheels"][0]["url"], "hash": f"sha256:{lock['wheel_sha256']}"} == {
            "url": locked["wheels"][0]["url"],
            "hash": locked["wheels"][0]["hash"],
        }
    else:
        assert lock["release"] == f"toolchain-ezdxf-{lock['version']}"


@pytest.mark.needs_toolchain
@pytest.mark.parametrize("piece", ["python", "libredwg", "dotnet"])
def test_the_toolchain_sits_under_opt_vextrus_read_only(piece: str) -> None:
    path = (PREFIX / piece).resolve()

    assert path.is_dir()
    assert path.is_relative_to(PREFIX)
    assert not os.access(path, os.W_OK), f"{path} is writable by this user"


@pytest.mark.needs_toolchain
def test_dwgread_is_the_pinned_libredwg() -> None:
    assert run(PREFIX / "libredwg" / "bin" / "dwgread", "--version").split() == [
        "dwgread",
        pin("libredwg.version"),
    ]


@pytest.mark.needs_toolchain
def test_dotnet_runs_the_pinned_sdk() -> None:
    sdks = run(PREFIX / "dotnet" / "dotnet", "--list-sdks").splitlines()

    assert pin("dotnet.version") in [line.split()[0] for line in sdks]


@pytest.mark.needs_toolchain
def test_python_is_the_pinned_build_under_opt_vextrus() -> None:
    assert platform.python_version() == pin("python.version")
    assert Path(sys.base_prefix).resolve().is_relative_to(PREFIX / "python")


@pytest.mark.needs_toolchain
def test_ezdxf_is_the_wheel_the_lock_names() -> None:
    lock = ezdxf_lock()
    wheel = metadata.distribution("ezdxf").read_text("WHEEL") or ""
    tags = [line.removeprefix("Tag:").strip() for line in wheel.splitlines() if line.startswith("Tag:")]
    locked_tag = lock["wheel"].removesuffix(".whl").split("-", 2)[2]

    assert metadata.version("ezdxf") == lock["version"]
    assert tags == [locked_tag]
    if locked_tag != "py3-none-any":
        importlib.import_module("ezdxf.acc.vector")  # the compiled extension loads


@pytest.mark.needs_bwrap
def test_bwrap_unshares_the_network() -> None:
    inside = run(
        "bwrap", "--unshare-net", "--ro-bind", "/", "/", "--dev", "/dev",
        sys.executable, "-c", "import socket; print([n for _, n in socket.if_nameindex()])",
    )  # fmt: skip

    assert inside.strip() == "['lo']"
