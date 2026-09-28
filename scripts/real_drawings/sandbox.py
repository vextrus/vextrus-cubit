"""The sandbox the install and the pipeline run in (the M0 plan, the real-drawing check, steps 2 and 3).

As the owner, inside bwrap: every namespace unshared (no network), the environment cleared, bound
read-only: /usr, the toolchain (/opt/vextrus), the scratch checkout, the wheel folder, the requirements
and the Development Sets; writable: one fresh scratch folder, and nothing else (the root is remounted
read-only). Neither home and not the drop folder is mounted. Inside, a new environment is made from the
toolchain's Python and the locked wheels are installed offline from the wheel folder only, by hash,
binary only (nothing is built); then the engine harness reads each set into `export-<set>.json`.
"""

import re
import shlex
import subprocess
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from scripts.real_drawings.drop import open_new
from scripts.real_drawings.source import Refused

HOURS = 3600
SET_NAME = re.compile(r"^[a-z0-9][a-z0-9-]*$")


@dataclass(frozen=True)
class Job:
    python: Path  # the toolchain's Python, under the toolchain folder
    toolchain: Path
    checkout: Path
    wheels: Path
    requirements: Path
    sets: Mapping[str, Path]
    scratch: Path
    env: Mapping[str, str]  # the run's id, commit and code hash: set, and passed to the harness as flags


def argv(job: Job) -> list[str]:
    binds = [
        *("--ro-bind", "/usr", "/usr"),
        *("--symlink", "usr/lib", "/lib"),
        *("--symlink", "usr/lib64", "/lib64"),
        *("--symlink", "usr/bin", "/bin"),
        *("--proc", "/proc", "--dev", "/dev"),
        *("--ro-bind", str(job.toolchain), str(job.toolchain)),
        *("--ro-bind", str(job.checkout), "/work/src"),
        *("--ro-bind", str(job.wheels), "/work/wheels"),
        *("--ro-bind", str(job.requirements), "/work/requirements.txt"),
        *("--bind", str(job.scratch), "/work/out"),
    ]
    for name, folder in sorted(job.sets.items()):
        if not SET_NAME.match(name):
            raise ValueError(f"a set's name must be plain: {name!r}")
        binds += ["--ro-bind", str(folder), f"/work/sets/{name}"]
    env = {
        "PATH": "/usr/bin:/bin",
        "HOME": "/work/out/home",
        "TMPDIR": "/work/out/tmp",
        "LANG": "C.UTF-8",
    }
    env |= job.env
    return [
        "bwrap",
        *("--unshare-all", "--die-with-parent", "--new-session", "--cap-drop", "ALL", "--clearenv"),
        *binds,
        "--remount-ro",
        "/",
        *[arg for key, value in sorted(env.items()) for arg in ("--setenv", key, value)],
        *("--chdir", "/work/src"),
        *("/bin/sh", "-c", script(job)),
    ]


def script(job: Job) -> str:
    python = "/work/out/venv/bin/python"
    offline = "--no-index --find-links /work/wheels --only-binary :all: --no-deps --require-hashes"
    quiet = "-q --disable-pip-version-check --no-cache-dir"
    lines = [
        "set -eu",
        "mkdir /work/out/home /work/out/tmp",
        f"{job.python} -m venv /work/out/venv",
        f"{python} -m pip install {quiet} {offline} -r /work/requirements.txt",
    ]
    flags = {
        "--run-id": "VEXTRUS_RUN_ID",
        "--commit": "VEXTRUS_COMMIT",
        "--code-hash": "VEXTRUS_CODE_HASH",
    }
    metadata = "".join(
        f" {flag} {shlex.quote(job.env[key])}" for flag, key in flags.items() if key in job.env
    )
    for name in sorted(job.sets):
        out = f"/work/out/export-{name}.json"
        lines.append(f"{python} -m engine.harness --set /work/sets/{name} --out {out}{metadata}")
    return "\n".join(lines)


def run(job: Job, log: Path) -> None:
    """The sandbox's output goes to `log`, never to the terminal (the PR's code writes it)."""
    with open_new(log) as output:
        done = subprocess.run(
            argv(job), stdout=output, stderr=subprocess.STDOUT, check=False, timeout=6 * HOURS
        )
    if done.returncode != 0:
        raise Refused(f"the sandbox ended with exit code {done.returncode}; its output is in {log}")
