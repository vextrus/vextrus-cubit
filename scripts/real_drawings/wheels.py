"""The wheel folder (the M0 plan, the real-drawing check, step 2): main's code fetches every locked wheel
by uv.lock's hashes, outside the sandbox, so the install inside it runs offline and builds nothing.

uv turns the head's lock (already refused if it names any source but the registry) into requirements
with every hash, without resolving or building; the toolchain's pip downloads the wheels for the
toolchain's own Python, binary only, each checked against those hashes. When `toolchain/ezdxf.lock`
names the compiled wheel, the requirements carry its hash alone in place of the registry's, so the
install inside can take only that wheel; it comes from the named release of this repository, checked by
the same hash. Nothing here runs the head's code.
"""

import hashlib
import re
import subprocess
import tomllib
from pathlib import Path

from scripts.real_drawings.source import Refused

REPOSITORY = "vextrus/vextrus-cubit"


def fetch(checkout: Path, wheels: Path, python: Path, requirements: Path) -> None:
    exported = _run(
        [
            *("uv", "export", "--frozen", "--no-config", "--no-dev", "--no-emit-project", "--no-header"),
            *("--no-annotate", "--format", "requirements.txt", "--project", str(checkout)),
        ],
        "uv export",
    )
    text = pin_ezdxf(exported, checkout, wheels)
    requirements.write_text(text)
    wheels.mkdir(parents=True, exist_ok=True)
    _run(
        [
            *(
                str(python),
                "-m",
                "pip",
                "download",
                "--quiet",
                "--disable-pip-version-check",
                "--no-deps",
            ),
            *("--only-binary", ":all:", "--require-hashes", "-r", str(requirements), "-d", str(wheels)),
            *("--find-links", str(wheels)),  # the compiled ezdxf wheel, which the registry does not have
        ],
        "pip download",
    )


def pin_ezdxf(requirements: str, checkout: Path, wheels: Path) -> str:
    """The requirements with ezdxf's hashes replaced by the compiled wheel's, when the lock names one."""
    with (checkout / "toolchain" / "ezdxf.lock").open("rb") as file:
        lock = tomllib.load(file)
    if lock["wheel"].endswith("-py3-none-any.whl"):
        return requirements  # the registry's pure wheel, which uv.lock already names
    line = re.compile(
        rf"^ezdxf=={re.escape(lock['version'])}(?: ;[^\\\n]*)?(?: \\\n +--hash=sha256:\w+)+", re.M
    )
    if len(line.findall(requirements)) != 1:
        raise Refused(f"uv.lock does not lock ezdxf {lock['version']}, which toolchain/ezdxf.lock pins")
    wheel = wheels / lock["wheel"]
    if not _has(wheel, lock["wheel_sha256"]):
        wheels.mkdir(parents=True, exist_ok=True)
        _run(
            [
                *("gh", "release", "download", lock["release"], "-R", REPOSITORY, "-p", lock["wheel"]),
                *("-D", str(wheels), "--clobber"),
            ],
            "the compiled ezdxf wheel's download",
        )
        if not _has(wheel, lock["wheel_sha256"]):
            raise Refused(
                f"{lock['wheel']} from {lock['release']} does not have the hash ezdxf.lock pins"
            )
    return line.sub(
        f"ezdxf=={lock['version']} \\\\\n    --hash=sha256:{lock['wheel_sha256']}", requirements
    )


def _has(path: Path, sha256: str) -> bool:
    return path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == sha256


def _run(command: list[str], what: str) -> str:
    done = subprocess.run(command, capture_output=True, text=True, check=False)
    if done.returncode != 0:
        raise Refused(f"{what} failed: {done.stderr.strip()[-2000:]}")
    return done.stdout
