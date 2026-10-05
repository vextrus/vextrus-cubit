"""G1's script layer: serve one head and walk the Development Sets (docs/specs/factory.md 5 "G1").

"it serves that head from a scratch worktree with its own database (`vextrus_walk_<sha8>`), its own
ports (`VEXTRUS_WEB_PORT`, `VEXTRUS_API_URL`) and both workers. `web/e2e/real/walk.spec.ts` ...
writes them to `walk.json`."

    python -m scripts.walk.run <sha40> [--root R] [--print-plan] [--set <slug> ...]
        [--smoke <file> ...] [--hold-minutes N]

It runs in the foreground (the orchestrator detaches it) and:
1. takes `.private/work/factory/g1.pid` (a live one refuses: one walk at a time; f3's governor reads it);
2. checks the head out in the one scratch worktree `.private/work/walks/_src` (reused, never deleted),
   makes its `.venv` (`uv sync --locked`, then the compiled ezdxf wheel `toolchain/ezdxf.lock` names, as
   `scripts/real_drawings` does) and its `web/node_modules`;
3. makes the database `vextrus_walk_<sha8>` afresh (`ensure_database`, `flush`, `migrate`,
   `sync_library`, `seed_demo`), with a demo password made for this run, in the children's environment
   (never printed or logged) and, for the agent layer's sign-in while the stack is served, in one
   owner-only file `.private/work/factory/g1.sign-in`, removed when the stack stops;
4. serves the API, both workers and the web dev server on two free ports (never 5410 or 8000);
5. runs `web/e2e/real/walk.spec.ts` from this checkout, which writes `walk.json`, its traces and
   screenshots under `.private/work/walks/<sha40>/` (private; `public/` is the only leavable folder);
6. appends `<UTC> WALK - <sha8> started|check <id> PASS|FAIL|UNSET|done PASS|done FAIL|error` to
   `.private/work/factory/events.log` (each check judged against `.private/work/walk-expect/`, with no
   agent layer, so this is never a verdict);
7. keeps the stack served for `/real-set-walk`'s agent layer until `verdict.json` appears, SIGTERM, or
   `--hold-minutes` pass; then stops what it started, by process group (never by pattern), drops
   `vextrus_walk_<sha8>` (once step 3 began; a failed drop is an event line, never the walk's code)
   and frees g1.pid.

`--smoke <file>` (repeatable) walks those files as the set `smoke` into
`.private/work/walks-smoke/<sha40>/` (a `"smoke": true` walk.json), never holds, and never writes a
verdict.
"""

import contextlib
import hashlib
import json
import os
import re
import secrets
import signal
import socket
import subprocess
import sys
import time
import tomllib
import urllib.error
import urllib.request
from collections.abc import Callable, Iterator
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from scripts.walk.cli import QuietParser

CODE = Path(__file__).resolve().parents[2]
"""This checkout: the walker's code (the spec, its config and node_modules) is the gate's own, never the
walked head's."""
SHA = re.compile(r"[0-9a-f]{40}")
SLUG = re.compile(r"[a-z0-9][a-z0-9_-]{0,39}")
OWNER_PORTS = frozenset({5410, 8000})
"""The owner's dev server and API (CLAUDE.md): a walk never takes them."""
DB_PREFIX = "vextrus_walk_"
WALK_DB = re.compile(re.escape(DB_PREFIX) + "[0-9a-f]{8}")
"""The only names `drop_database` drops."""
DEFAULT_SETS = ("edison", "sample-project")
"""The Development Sets: folders under `.private/reference/` (CLAUDE.md names them)."""
SET_SUFFIXES = (".dwg", ".pdf")
PYTHON_DIR = "/opt/vextrus/python"
WHEELS = (
    Path(os.environ.get("XDG_CACHE_HOME") or Path.home() / ".cache") / "vextrus-real-drawings" / "wheels"
)
STEP_TIMEOUT = 1800
SERVE_TIMEOUT = 240
SPEC_TIMEOUT = 4 * 3600
STOP_GRACE = 30
DROP_TIMEOUT = 300


class AlreadyRunning(RuntimeError):
    """A live walk holds g1.pid."""


class WalkError(RuntimeError):
    """A step of the walk failed; its kind only, never a path or drawing text."""


@dataclass(frozen=True)
class Plan:
    sha: str
    sha8: str
    db_name: str
    out_dir: Path
    worktree: Path
    web_port: int
    api_port: int
    env: dict[str, str] = field(default_factory=dict)

    def shown(self) -> dict[str, Any]:
        return {
            key: str(value) if isinstance(value, Path) else value for key, value in asdict(self).items()
        }


def _git(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=False, timeout=120
    )


def plan(sha: str, *, root: Path, web_port: int, api_port: int, smoke: bool = False) -> Plan:
    """What a walk of `sha` would use; refuses a short or symbolic sha and the owner's ports."""
    if not isinstance(sha, str) or not SHA.fullmatch(sha):
        raise ValueError("the walk takes a full 40-hex sha")
    for port in (web_port, api_port):
        if isinstance(port, bool) or not isinstance(port, int) or not 1024 <= port <= 65535:
            raise ValueError("a port is out of range")
        if port in OWNER_PORTS:
            raise ValueError("the owner's ports (5410, 8000) are never a walk's")
    if web_port == api_port:
        raise ValueError("the web and the API need two ports")
    if _git(root, "cat-file", "-e", f"{sha}^{{commit}}").returncode != 0:
        raise ValueError("the sha is not a commit in this repository")
    sha8 = sha[:8]
    db_name = f"{DB_PREFIX}{sha8}"
    work = root / ".private" / "work"
    out_dir = work / ("walks-smoke" if smoke else "walks") / sha
    return Plan(
        sha=sha,
        sha8=sha8,
        db_name=db_name,
        out_dir=out_dir,
        worktree=work / "walks" / "_src",
        web_port=web_port,
        api_port=api_port,
        env={
            "VEXTRUS_DB_NAME": db_name,
            "VEXTRUS_WEB_PORT": str(web_port),
            "VEXTRUS_API_URL": f"http://127.0.0.1:{api_port}",
        },
    )


def pick_ports() -> tuple[int, int]:
    """Two distinct free ports on 127.0.0.1, neither the owner's."""
    chosen: list[int] = []
    while len(chosen) < 2:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.bind(("127.0.0.1", 0))
            port = int(probe.getsockname()[1])
        if port not in OWNER_PORTS and port not in chosen:
            chosen.append(port)
    return chosen[0], chosen[1]


def pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def acquire(pidfile: Path, *, pid: int, is_alive: Callable[[int], bool] = pid_alive) -> None:
    """Write `pid` into `pidfile`; a live pid already there refuses, a stale one is replaced."""
    if pidfile.exists():
        text = pidfile.read_text(encoding="utf-8").strip()
        if text.isdigit() and is_alive(int(text)):
            raise AlreadyRunning("a walk is already running")
    pidfile.parent.mkdir(parents=True, exist_ok=True)
    temporary = pidfile.with_name(f".{pidfile.name}.{pid}.tmp")
    temporary.write_text(f"{pid}\n", encoding="utf-8")
    temporary.replace(pidfile)


def release(pidfile: Path, *, pid: int) -> None:
    with contextlib.suppress(OSError):
        if pidfile.read_text(encoding="utf-8").strip() == str(pid):
            pidfile.unlink()


def utc() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


class Events:
    """`.private/work/factory/events.log` in f3's form: `<UTC> WALK - <sha8> <detail>`."""

    def __init__(self, root: Path, sha8: str, *, smoke: bool = False) -> None:
        self.path = root / ".private" / "work" / "factory" / "events.log"
        self.sha8 = sha8
        self.ticket = "smoke" if smoke else "-"

    def __call__(self, detail: str) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as log:
            log.write(f"{utc()} WALK {self.ticket} {self.sha8} {detail}\n")


def set_files(root: Path, slugs: list[str]) -> dict[str, list[str]]:
    """Each set's DWG and PDF files (absolute paths, private), in name order, DWGs first."""
    sets: dict[str, list[str]] = {}
    for slug in slugs:
        if not SLUG.fullmatch(slug):
            raise ValueError("a set's name is not a slug")
        folder = root / ".private" / "reference" / slug
        files = sorted(
            (p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in SET_SUFFIXES),
            key=lambda p: (p.suffix.lower() != ".dwg", p.name),
        )
        if not files:
            raise WalkError("a set has no drawings")
        sets[slug] = [str(p) for p in files]
    return sets


def _child_env(walk: Plan, extra: dict[str, str] | None = None) -> dict[str, str]:
    env = {
        key: value
        for key, value in os.environ.items()
        # The database's name comes from VEXTRUS_DB_NAME alone; a URL would override it.
        if key not in {"DATABASE_URL", "DATABASE_OWNER_URL", "VIRTUAL_ENV", "VEXTRUS_DEMO_PASSWORD"}
    }
    env.update(walk.env)
    env.update(extra or {})
    return env


def _step(
    name: str,
    args: list[str],
    *,
    cwd: Path,
    env: dict[str, str],
    log: Path,
    timeout: float = STEP_TIMEOUT,
) -> None:
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a", encoding="utf-8") as out:
        out.write(f"--- {utc()} {name}\n")
        out.flush()
        done = subprocess.run(
            args,
            cwd=cwd,
            env=env,
            stdout=out,
            stderr=subprocess.STDOUT,
            check=False,
            timeout=timeout,
        )
    if done.returncode != 0:
        raise WalkError(f"{name} exited {done.returncode}")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def prepare_checkout(root: Path, walk: Plan, log: Path) -> None:
    """The scratch worktree at `sha`, its venv (with the compiled ezdxf) and its web dependencies."""
    tree = walk.worktree
    if not (tree / ".git").exists():
        tree.parent.mkdir(parents=True, exist_ok=True)
        _step(
            "worktree",
            ["git", "-C", str(root), "worktree", "add", "--detach", str(tree), walk.sha],
            cwd=root,
            env=dict(os.environ),
            log=log,
        )
    else:
        _step(
            "checkout",
            ["git", "-C", str(tree), "checkout", "--detach", walk.sha],
            cwd=root,
            env=dict(os.environ),
            log=log,
        )
    head = _git(tree, "rev-parse", "HEAD").stdout.strip()
    if head != walk.sha:
        raise WalkError("the scratch worktree is not at the sha")
    env = _child_env(walk, {"UV_PYTHON_INSTALL_DIR": PYTHON_DIR})
    _step("uv sync", ["uv", "sync", "--locked"], cwd=tree, env=env, log=log)
    lock = tomllib.loads((tree / "toolchain" / "ezdxf.lock").read_text(encoding="utf-8"))
    wheel_name = str(lock.get("wheel", ""))
    if wheel_name and not wheel_name.endswith("-py3-none-any.whl"):
        wheel = WHEELS / wheel_name
        if wheel.is_file() and _sha256(wheel) == lock.get("wheel_sha256"):
            _step(
                "ezdxf",
                [
                    "uv",
                    "pip",
                    "install",
                    "--python",
                    str(tree / ".venv" / "bin" / "python"),
                    "--no-deps",
                    "--reinstall",
                    str(wheel),
                ],
                cwd=tree,
                env=env,
                log=log,
            )
        else:
            with log.open("a", encoding="utf-8") as out:
                out.write("ezdxf: no cached compiled wheel; the registry's reads slower\n")
    lock_hash = _sha256(tree / "web" / "package-lock.json")
    stamp = tree / "web" / "node_modules" / ".walk-lock-sha256"
    if not stamp.exists() or stamp.read_text(encoding="utf-8").strip() != lock_hash:
        _step("npm ci", ["npm", "--prefix", str(tree / "web"), "ci"], cwd=tree, env=env, log=log)
        stamp.write_text(lock_hash + "\n", encoding="utf-8")


def prepare_database(walk: Plan, password: str, log: Path) -> None:
    if not walk.db_name.startswith(DB_PREFIX):
        raise WalkError("the walk's database must be vextrus_walk_*")
    python = str(walk.worktree / ".venv" / "bin" / "python")
    env = _child_env(walk, {"VEXTRUS_DEMO_PASSWORD": password})
    for name, args in (
        ("ensure_database", ["ensure_database"]),
        ("flush", ["flush", "--no-input"]),
        ("migrate", ["migrate", "--no-input"]),
        ("sync_library", ["sync_library"]),
        ("seed_demo", ["seed_demo"]),
    ):
        _step(name, [python, "manage.py", *args], cwd=walk.worktree, env=env, log=log)


def drop_database(walk: Plan, log: Path) -> None:
    """Drops the walk's own database (it holds data read from real drawings), connected to
    `postgres` as `vextrus`, whose password psql reads from the owner's pass file (never argv or the
    environment; .claude/rules/machine.md). Refuses, running nothing, any name but `vextrus_walk_`
    and 8 hex digits."""
    if not WALK_DB.fullmatch(walk.db_name):
        raise WalkError("only a walk's own database is dropped")
    # No PG* setting but the pass file's place may steer psql away from the flags below.
    env = {k: v for k, v in os.environ.items() if not k.startswith("PG") or k == "PGPASSFILE"}
    sql = f'DROP DATABASE IF EXISTS "{walk.db_name}" WITH (FORCE)'
    connect = ["-h", "127.0.0.1", "-p", "5432", "-U", "vextrus", "-d", "postgres", "-w"]
    _step(
        "drop database",
        ["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", *connect, "-c", sql],
        cwd=log.parent,
        env=env,
        log=log,
        timeout=DROP_TIMEOUT,
    )


def _signal_group(process: subprocess.Popen[bytes], signum: int) -> None:
    with contextlib.suppress(ProcessLookupError, PermissionError):
        os.killpg(process.pid, signum)


def end_groups(processes: list[subprocess.Popen[bytes]], *, grace: float) -> None:
    """Each process's group (started with `start_new_session=True`, so its group is its pid): TERM,
    a grace for the leaders to exit, then KILL to whatever is left of the group, a grandchild that
    outlived its leader included."""
    for process in processes:
        _signal_group(process, signal.SIGTERM)
    deadline = time.monotonic() + grace
    for process in processes:
        with contextlib.suppress(subprocess.TimeoutExpired):
            process.wait(timeout=max(0.1, deadline - time.monotonic()))
    for process in processes:
        _signal_group(process, signal.SIGKILL)
        with contextlib.suppress(subprocess.TimeoutExpired):
            process.wait(timeout=10)


@dataclass
class Stack:
    processes: list[subprocess.Popen[bytes]] = field(default_factory=list)

    def start(self, name: str, args: list[str], *, cwd: Path, env: dict[str, str], logs: Path) -> None:
        logs.mkdir(parents=True, exist_ok=True)
        out = (logs / f"{name}.txt").open("ab")
        self.processes.append(
            subprocess.Popen(
                args, cwd=cwd, env=env, stdout=out, stderr=subprocess.STDOUT, start_new_session=True
            )
        )

    def stop(self) -> None:
        """Each process group this walk started, by its pid: TERM, then KILL after a grace."""
        end_groups(self.processes, grace=STOP_GRACE)

    def all_running(self) -> bool:
        return all(process.poll() is None for process in self.processes)


def _wait_for(url: str, stack: Stack) -> None:
    deadline = time.monotonic() + SERVE_TIMEOUT
    while time.monotonic() < deadline:
        if not stack.all_running():
            raise WalkError("a served process ended while starting")
        try:
            with urllib.request.urlopen(url, timeout=5):
                return
        except urllib.error.URLError, OSError:
            time.sleep(2)
    raise WalkError("the stack did not answer in time")


QS_EMAIL = "nusrat@shapla-homes.example"
"""The seed's QS (docs/design/m0-screens.md 7), whom the scripted walk and the agent layer sign in as."""


def write_sign_in(path: Path, password: str) -> None:
    """The agent layer's sign-in for the served stack: one file, owner-only (0600), outside every walk
    folder (so no scan or summary reads it), removed when the stack stops. It is the only place the
    per-run password is written; it is never printed or logged."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    handle = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(handle, "w", encoding="utf-8") as file:
        file.write(json.dumps({"email": QS_EMAIL, "password": password}) + "\n")


def serve(walk: Plan, password: str, stack: Stack) -> None:
    python = str(walk.worktree / ".venv" / "bin" / "python")
    env = _child_env(walk, {"VEXTRUS_DEMO_PASSWORD": password})
    logs = walk.out_dir / "logs"
    tree = walk.worktree
    stack.start(
        "api",
        [python, "manage.py", "runserver", f"127.0.0.1:{walk.api_port}", "--noreload"],
        cwd=tree,
        env={**env, "VEXTRUS_DEBUG": "1"},
        logs=logs,
    )
    stack.start("worker", [python, "manage.py", "worker"], cwd=tree, env=env, logs=logs)
    stack.start(
        "worker-cad", [python, "manage.py", "worker", "--queue", "cad"], cwd=tree, env=env, logs=logs
    )
    stack.start(
        "web", ["npm", "--prefix", str(tree / "web"), "run", "dev"], cwd=tree, env=env, logs=logs
    )
    _wait_for(f"http://127.0.0.1:{walk.api_port}/api/auth/csrf", stack)
    _wait_for(f"http://127.0.0.1:{walk.web_port}/", stack)


def walk_spec(
    root: Path, walk: Plan, password: str, sets: dict[str, list[str]], *, smoke: bool, started_at: str
) -> int:
    """Runs this checkout's `web/e2e/real/walk.spec.ts` against the served head, in its own process
    group, which ends with it (a leftover node or chromium would hold the next walk's ports)."""
    walk.out_dir.mkdir(parents=True, exist_ok=True)
    manifest = walk.out_dir / "sets.json"  # private: the files' paths
    manifest.write_text(json.dumps(sets), encoding="utf-8")
    env = _child_env(
        walk,
        {
            "VEXTRUS_DEMO_PASSWORD": password,
            "WALK_URL": f"http://127.0.0.1:{walk.web_port}",
            "WALK_API_URL": f"http://127.0.0.1:{walk.api_port}",
            "WALK_OUT": str(walk.out_dir / "playwright"),
            "WALK_JSON": str(walk.out_dir / "walk.json"),
            "WALK_CONFLICTS": str(walk.out_dir / "conflicts.json"),
            "WALK_SETS": str(manifest),
            "WALK_SHA": walk.sha,
            "WALK_STARTED_AT": started_at,
            "WALK_SMOKE": "1" if smoke else "",
        },
    )
    web = CODE / "web"
    with (walk.out_dir / "logs" / "playwright.txt").open("ab") as out:
        process = subprocess.Popen(
            [
                "npx",
                "--prefix",
                str(web),
                "playwright",
                "test",
                "-c",
                str(web / "e2e" / "real" / "playwright.config.ts"),
            ],
            cwd=web,
            env=env,
            stdout=out,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        try:
            return process.wait(timeout=SPEC_TIMEOUT)
        finally:  # a signal, the timeout, or a grandchild left after a normal exit
            end_groups([process], grace=STOP_GRACE)


def judge_checks(root: Path, walk: Plan, events: Events) -> bool:
    """Logs each scripted check against the expectations (no agent layer: never a verdict)."""
    from scripts.walk.continuations import attach
    from scripts.walk.verdict import evaluate

    expect_dir = root / ".private" / "work" / "walk-expect"
    record = json.loads((walk.out_dir / "walk.json").read_text(encoding="utf-8"))
    record = attach(record, walk.out_dir, expect_dir)
    expect = {}
    for name in record.get("sets", {}):
        path = expect_dir / f"{name}.json"
        if SLUG.fullmatch(name) and path.exists():
            expect[name] = json.loads(path.read_text(encoding="utf-8"))
    judged = evaluate(record, expect, None, ref="main", started_at=utc(), finished_at=utc(), leak_hits=0)
    for check in judged["checks"]:
        events(f"check {check['check']} {check['status']}")
    return all(check["status"] == "PASS" for check in judged["checks"])


def verdict_written(out_dir: Path, since: float) -> bool:
    """This walk's verdict exists: a verdict.json written after the walk started (a re-walk's older
    one does not end the hold)."""
    try:
        return (out_dir / "verdict.json").stat().st_mtime > since
    except OSError:
        return False


SET_ASIDE = ("walk", "conflicts", "findings", "triage", "drafts")
"""A walk's record (walk.json and its conflict Questions' keys, conflicts.json) and its agent layer's
files (issues.py writes triage.json and drafts.json)."""


def set_aside(out_dir: Path) -> None:
    """An earlier walk's walk.json, conflicts.json, findings.json, triage.json and drafts.json move
    aside, each to `<name>.<its mtime>.json` (`-2`, `-3` after a move of the same second; never over
    one), so a new walk exists only once it wrote its own walk.json and is judged only on its own
    findings."""
    for name in SET_ASIDE:
        current = out_dir / f"{name}.json"
        if not current.exists():
            continue
        stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime(current.stat().st_mtime))
        target = out_dir / f"{name}.{stamp}.json"
        n = 1
        while target.exists():
            n += 1
            target = out_dir / f"{name}.{stamp}-{n}.json"
        current.replace(target)


def hold(walk: Plan, stack: Stack, minutes: float, stopping: list[bool], since: float) -> None:
    """Keeps the stack served for the agent layer until this walk's verdict exists, a signal, or time."""
    deadline = time.monotonic() + minutes * 60
    while time.monotonic() < deadline and not stopping:
        if verdict_written(walk.out_dir, since) or not stack.all_running():
            return
        time.sleep(5)


@contextlib.contextmanager
def _signals(stopping: list[bool], holding: list[bool]) -> Iterator[None]:
    """SIGTERM or SIGINT: stop. While the walk runs it interrupts (an error); while the stack is only
    held for the agent layer it ends the hold quietly (the walk is done)."""

    def handler(signum: int, frame: object) -> None:
        stopping.append(True)
        if not holding:
            raise KeyboardInterrupt

    before = {sig: signal.signal(sig, handler) for sig in (signal.SIGTERM, signal.SIGINT)}
    try:
        yield
    finally:
        for sig, previous in before.items():
            signal.signal(sig, previous)


def _said(error: BaseException) -> str:
    """A WalkError's own fixed words; nothing from any other error (it could carry a path)."""
    return str(error) if isinstance(error, WalkError) else ""


def run(root: Path, walk: Plan, *, sets: dict[str, list[str]], smoke: bool, hold_minutes: float) -> int:
    events = Events(root, walk.sha8, smoke=smoke)
    pidfile = root / ".private" / "work" / "factory" / "g1.pid"
    acquire(pidfile, pid=os.getpid())
    sign_in = pidfile.with_name("g1.sign-in")
    stack = Stack()
    stopping: list[bool] = []
    holding: list[bool] = []
    password = secrets.token_hex(24)
    log = walk.out_dir / "logs" / "prepare.txt"
    started_at = utc()
    since = time.time()
    made_database = False
    events("started")
    try:
        with _signals(stopping, holding):
            walk.out_dir.mkdir(parents=True, exist_ok=True)
            set_aside(walk.out_dir)
            prepare_checkout(root, walk, log)
            made_database = True  # from here the database may exist: the walk drops it
            prepare_database(walk, password, log)
            serve(walk, password, stack)
            if not smoke:
                write_sign_in(sign_in, password)
            code = walk_spec(root, walk, password, sets, smoke=smoke, started_at=started_at)
            if not (walk.out_dir / "walk.json").exists():
                raise WalkError(f"the walk wrote no walk.json (playwright exited {code})")
            passed = judge_checks(root, walk, events)
            events(f"done {'PASS' if passed else 'FAIL'}")
            print(f"walk: {walk.sha8} script layer {'PASS' if passed else 'FAIL'} (playwright {code})")
            if not smoke:
                holding.append(True)
                hold(walk, stack, hold_minutes, stopping, since)
            return 0 if passed else 1
    except (KeyboardInterrupt, WalkError, OSError, ValueError, subprocess.SubprocessError) as error:
        events("error")
        print(
            f"walk: {walk.sha8} error ({type(error).__name__}: {_said(error)})",
            file=sys.stderr,
        )
        return 2
    finally:
        sign_in.unlink(missing_ok=True)
        stack.stop()
        if made_database:
            try:
                drop_database(walk, log)
            except WalkError, OSError, subprocess.SubprocessError:
                events("drop failed")  # never the walk's code
        release(pidfile, pid=os.getpid())


def main(argv: list[str] | None = None) -> int:
    parser = QuietParser(prog="python -m scripts.walk.run")
    parser.add_argument("sha")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--print-plan", action="store_true")
    parser.add_argument("--set", dest="sets", action="append")
    parser.add_argument(
        "--smoke", type=Path, action="append", help="a file under .private/reference/ (repeatable)"
    )
    parser.add_argument("--web-port", type=int)
    parser.add_argument("--api-port", type=int)
    parser.add_argument("--hold-minutes", type=float, default=120)
    try:
        args = parser.parse_args(argv)
    except SystemExit:
        return 2
    root = args.root.resolve()
    smoke = args.smoke is not None
    try:
        web_port, api_port = (args.web_port, args.api_port)
        if web_port is None or api_port is None:
            web_port, api_port = pick_ports()
        walk = plan(args.sha, root=root, web_port=web_port, api_port=api_port, smoke=smoke)
    except ValueError as error:
        print(f"walk: refused ({error})", file=sys.stderr)
        return 2
    if args.print_plan:
        print(json.dumps(walk.shown(), indent=2, sort_keys=True))
        return 0
    try:
        if smoke:
            reference = (root / ".private" / "reference").resolve()
            files = [given.resolve() for given in args.smoke]
            if any(not f.is_file() or reference not in f.parents for f in files):
                raise ValueError("a smoke file must be a file under .private/reference/")
            sets = {"smoke": [str(f) for f in files]}
        else:
            sets = set_files(root, args.sets or list(DEFAULT_SETS))
    except (ValueError, OSError, WalkError) as error:
        print(f"walk: refused ({type(error).__name__})", file=sys.stderr)
        return 2
    try:
        return run(root, walk, sets=sets, smoke=smoke, hold_minutes=args.hold_minutes)
    except AlreadyRunning:
        print("walk: refused (a walk is already running)", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
