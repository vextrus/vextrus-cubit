"""The sandbox the install and the pipeline run in (the M0 plan, the real-drawing check, steps 2 and 3).

As the owner, inside bwrap: every namespace unshared (no network), the environment cleared, bound
read-only: /usr, the toolchain (/opt/vextrus), the scratch checkout, the wheel folder, the requirements
and the Development Sets; writable: one fresh scratch folder and a private, in-memory /tmp (a bwrap
started inside, as 04's reader starts one, needs it; the host's /tmp is never seen), and nothing else
(the root is remounted read-only). Neither home and not the drop folder is mounted. Inside, a new
environment is made from the toolchain's Python and the locked wheels are installed offline from the
wheel folder only, by hash, binary only (nothing is built); then the engine harness reads each set into
`export-<set>.json`.

**`--job` mode** (21a; off by default until 21c makes it the check's): instead of the harness, the
product's read job reads each set, against a throwaway PostgreSQL 18 cluster started inside the
sandbox from the host's own binaries (`PG_BIN`, under the bound /usr): its data in the private /tmp,
its only socket a Unix one (`SOCKET`; no TCP), stopped when the script ends, however it ends. The export
is written by the job's export entry point (`JOB_ENTRY`, 21c's `takeoff/services/export.py`), called
as `python -m <JOB_ENTRY> --set <set> --out <export> --database <socket>` with the run's metadata as
flags. PostgreSQL refuses to run as root and needs its user's name, so in this mode the sandbox runs as
one unprivileged user (`UID`, mapped to the owner outside) named in its own read-only /etc/passwd.
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
PG_BIN = Path("/usr/lib/postgresql/18/bin")
"""PostgreSQL 18's own binaries, as the host's package installs them (under /usr, bound read-only)."""
JOB_ENTRY = "vextrus.takeoff.services.export"
"""The job's export entry point (21c): reads a set through the product's job, writes its export."""
SOCKET = "/tmp/pg-socket"
UID = 1000
USER = "vextrus"


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
    job: bool = False  # `--job` mode: the product's job against a throwaway cluster (see the module)


def identity(job: Job) -> tuple[Path, Path]:
    """The job mode's /etc/passwd and /etc/group, beside the scratch folder (never inside it)."""
    return job.scratch.with_name("sandbox-passwd"), job.scratch.with_name("sandbox-group")


def argv(job: Job) -> list[str]:
    binds = [
        *("--ro-bind", "/usr", "/usr"),
        *("--symlink", "usr/lib", "/lib"),
        *("--symlink", "usr/lib64", "/lib64"),
        *("--symlink", "usr/bin", "/bin"),
        *("--proc", "/proc", "--dev", "/dev"),
        *(
            "--tmpfs",
            "/tmp",
        ),  # private and in memory: 04's reader starts its own bwrap, which needs /tmp
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
    user: list[str] = []
    if job.job:
        passwd, group = identity(job)
        binds += ["--ro-bind", str(passwd), "/etc/passwd", "--ro-bind", str(group), "/etc/group"]
        user = ["--uid", str(UID), "--gid", str(UID)]
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
        *user,
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
    if job.job:
        pg = f"{PG_BIN}/pg_ctl -D /tmp/pg"
        lines += [
            (
                f"{PG_BIN}/initdb -D /tmp/pg -U {USER} --auth=trust -E UTF8 --no-sync"
                " > /work/out/pg-init.log 2>&1"
            ),
            f"mkdir {SOCKET}",
            f"trap '{pg} -m fast -w stop > /dev/null' EXIT",
            f'{pg} -l /work/out/pg.log -o "-k {SOCKET} -c listen_addresses=" -w start > /dev/null',
        ]
    for name in sorted(job.sets):
        out = f"/work/out/export-{name}.json"
        if job.job:
            lines.append(
                f"{python} -m {JOB_ENTRY} --set /work/sets/{name} --out {out}"
                f" --database {SOCKET}{metadata}"
            )
        else:
            lines.append(f"{python} -m engine.harness --set /work/sets/{name} --out {out}{metadata}")
    return "\n".join(lines)


def run(job: Job, log: Path) -> None:
    """The sandbox's output goes to `log`, never to the terminal (the PR's code writes it)."""
    if job.job:
        passwd, group = identity(job)
        with open_new(passwd) as written:
            written.write(f"{USER}:x:{UID}:{UID}:the check:/work/out/home:/bin/sh\n".encode())
        with open_new(group) as written:
            written.write(f"{USER}:x:{UID}:\n".encode())
    with open_new(log) as output:
        done = subprocess.run(
            argv(job), stdout=output, stderr=subprocess.STDOUT, check=False, timeout=6 * HOURS
        )
    if done.returncode != 0:
        raise Refused(f"the sandbox ended with exit code {done.returncode}; its output is in {log}")
