"""The sandbox every subprocess reader runs in (docs/architecture.md; ADR 0031).

The refusals run everywhere. What the sandbox holds (no network, nothing writable but the output
folder, killed at its limits) needs bubblewrap able to make namespaces:
    uv run --no-sync pytest -m needs_bwrap engine/read/tests/test_sandbox.py
"""

import os
import socket
import sys
import threading
from pathlib import Path

import pytest

from engine.read import sandbox
from engine.read.errors import ReadError
from engine.read.sandbox import LimitReached, Limits, SandboxRefused, SandboxUnavailable

PYTHON_HOME = Path(sys.base_prefix).resolve()
PYTHON = str(PYTHON_HOME / "bin" / "python3")


def python(
    code: str, output: Path, limits: Limits = sandbox.DEFAULT_LIMITS, reads: tuple[Path, ...] = ()
) -> sandbox.Finished:
    argv = [PYTHON, "-I", "-S", "-c", code]
    return sandbox.run(argv, reads=(PYTHON_HOME, *reads), output=output, limits=limits)


# -- refusals: everywhere ---------------------------------------------------------------------------


def test_without_bwrap_it_refuses_to_run(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)
    monkeypatch.setattr(sandbox, "BWRAP", "bwrap-that-is-not-installed")

    with pytest.raises(SandboxUnavailable) as raised:
        python("print(1)", tmp_path)

    assert raised.value.message == {"code": "engine.read.sandbox_unavailable", "params": {}}


def test_a_bwrap_that_cannot_build_the_sandbox_is_unavailable_not_a_reader_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)
    fake = tmp_path / "bwrap"
    fake.write_text("#!/bin/sh\necho 'bwrap: No permissions to create new namespace' >&2\nexit 1\n")
    fake.chmod(0o755)
    monkeypatch.setattr(sandbox, "BWRAP", str(fake))

    with pytest.raises(SandboxUnavailable) as raised:
        python("print(1)", tmp_path)

    assert "namespace" in raised.value.detail


def test_sandbox_off_runs_unsandboxed_only_under_pytest(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")
    monkeypatch.setattr(sandbox, "BWRAP", "bwrap-that-is-not-installed")

    finished = python("print('hello')", tmp_path)

    assert (finished.exit_code, finished.stdout, finished.sandboxed) == (0, b"hello\n", False)


def test_sandbox_off_outside_pytest_is_refused(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")
    monkeypatch.delenv("PYTEST_CURRENT_TEST")

    with pytest.raises(SandboxRefused) as raised:
        python("print(1)", tmp_path)

    assert raised.value.message == {"code": "engine.read.sandbox_refused", "params": {}}


@pytest.mark.parametrize("value", ["0", "false", "OFF", ""])
def test_only_the_exact_word_off_turns_the_sandbox_off(
    value: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", value)
    monkeypatch.setattr(sandbox, "BWRAP", "bwrap-that-is-not-installed")

    with pytest.raises(SandboxUnavailable):
        python("print(1)", tmp_path)


def test_the_output_folder_must_exist(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="output"):
        python("print(1)", tmp_path / "missing")


@pytest.mark.parametrize("inside", [True, False], ids=["read-inside-output", "output-inside-read"])
def test_a_path_to_read_that_the_output_would_cover_is_refused(tmp_path: Path, inside: bool) -> None:
    output = tmp_path / "out"
    (output / "input").mkdir(parents=True)
    reads = (output / "input",) if inside else (tmp_path,)

    with pytest.raises(ValueError, match="writable"):
        python("print(1)", output, reads=reads)


def test_bwrap_and_prlimit_are_never_taken_from_path() -> None:
    assert Path(sandbox.BWRAP).is_absolute()
    assert Path(sandbox.PRLIMIT).is_absolute()


def test_unsandboxed_runs_keep_the_wall_clock_limit(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")

    with pytest.raises(LimitReached) as raised:
        python("import time; time.sleep(30)", tmp_path, Limits(wall_seconds=0.5))

    assert raised.value.message == {
        "code": "engine.read.limit_reached",
        "params": {"limit": "wall"},
    }


# -- what the sandbox holds: needs bwrap -----------------------------------------------------------


@pytest.fixture
def sandboxed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_it_runs_the_program_and_reports_what_it_used(tmp_path: Path) -> None:
    finished = python("import sys; print('out'); print('err', file=sys.stderr)", tmp_path)

    assert (finished.exit_code, finished.stdout, finished.stderr) == (0, b"out\n", b"err\n")
    assert finished.sandboxed
    assert finished.wall_seconds > 0


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_it_writes_into_its_output_folder(tmp_path: Path) -> None:
    finished = python(f"open({str(tmp_path / 'made.txt')!r}, 'w').write('made')", tmp_path)

    assert finished.exit_code == 0
    assert (tmp_path / "made.txt").read_text() == "made"


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_it_cannot_reach_the_network_even_on_the_hosts_loopback(tmp_path: Path) -> None:
    listener = socket.create_server(("127.0.0.1", 0))
    port = listener.getsockname()[1]
    accepted: list[object] = []
    listener.settimeout(5)
    thread = threading.Thread(target=lambda: accepted.append(_accept(listener)))
    thread.start()
    code = f"""
import socket
for address in [("127.0.0.1", {port}), ("1.1.1.1", 443)]:
    s = socket.socket()
    s.settimeout(3)
    try:
        s.connect(address)
    except OSError as error:
        print("refused", error.errno)
    else:
        print("connected", address)
print(sorted(n for _, n in socket.if_nameindex()))
"""
    finished = python(code, tmp_path)
    listener.close()
    thread.join()

    lines = finished.stdout.decode().splitlines()
    assert [line.split()[0] for line in lines[:2]] == ["refused", "refused"]
    assert lines[2] == "['lo']"
    assert accepted == [None]


def _accept(listener: socket.socket) -> object:
    try:
        connection, _ = listener.accept()
    except OSError:
        return None
    connection.close()
    return "a connection reached the host"


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_it_cannot_write_outside_its_output_folder(tmp_path: Path) -> None:
    output = tmp_path / "out"
    output.mkdir()
    readable = tmp_path / "input"
    readable.mkdir()
    (readable / "drawing.dwg").write_bytes(b"original")
    code = f"""
import os
targets = [
    {str(readable / "drawing.dwg")!r},
    {str(readable / "new.txt")!r},
    {str(tmp_path / "beside.txt")!r},
    "/usr/planted.txt",
    "/planted.txt",
    "/tmp/planted.txt",
    {str(Path.home() / "planted.txt")!r},
]
for target in targets:
    try:
        with open(target, "wb") as file:
            file.write(b"planted")
    except OSError as error:
        print("refused", error.errno)
    else:
        print("wrote", target)
"""
    finished = python(code, output, reads=(readable,))

    assert finished.exit_code == 0, finished.stderr
    assert all(line.startswith("refused") for line in finished.stdout.decode().splitlines())
    assert len(finished.stdout.decode().splitlines()) == 7
    assert (readable / "drawing.dwg").read_bytes() == b"original"
    assert sorted(p.name for p in tmp_path.iterdir()) == ["input", "out"]
    assert sorted(p.name for p in readable.iterdir()) == ["drawing.dwg"]


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_it_sees_only_what_it_was_given(tmp_path: Path) -> None:
    code = f"""
import os
for path in ["/home", "/root", "/etc/passwd", {str(Path.cwd())!r}, "/opt/vextrus/dotnet"]:
    print(os.path.exists(path))
print(sorted(os.environ))
"""
    finished = python(code, tmp_path)

    lines = finished.stdout.decode().splitlines()
    assert lines[:5] == ["False"] * 5
    assert "TYPESAFE_API_KEY" not in lines[5]
    assert "DATABASE_URL" not in lines[5]


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_it_is_killed_at_its_cpu_limit(tmp_path: Path) -> None:
    with pytest.raises(LimitReached) as raised:
        python("while True: pass", tmp_path, Limits(cpu_seconds=1, wall_seconds=30))

    assert raised.value.limit == "cpu"


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_a_program_that_ignores_its_cpu_limit_is_killed_and_said_so(tmp_path: Path) -> None:
    code = "import signal\nsignal.signal(signal.SIGXCPU, signal.SIG_IGN)\nwhile True: pass"

    with pytest.raises(LimitReached) as raised:
        python(code, tmp_path, Limits(cpu_seconds=1, wall_seconds=30))

    assert raised.value.limit == "killed"


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_it_has_no_memory_backed_folder_to_fill(tmp_path: Path) -> None:
    code = """
import os
for target in ["/dev/shm/fill", "/dev/fill", "/run/fill", "/tmp/fill"]:
    try:
        with open(target, "wb") as file:
            file.write(b"x" * (1 << 20))
    except OSError as error:
        print("refused", error.errno)
    else:
        print("wrote", target)
print(sorted(os.listdir("/dev")))
"""
    finished = python(code, tmp_path)

    lines = finished.stdout.decode().splitlines()
    assert all(line.startswith("refused") for line in lines[:4]), lines
    assert lines[4] == str(["fd", "null", "random", "stderr", "stdin", "stdout", "urandom", "zero"])


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_a_program_the_sandbox_cannot_find_is_a_reader_failure(tmp_path: Path) -> None:
    with pytest.raises(ReadError) as raised:
        sandbox.run(["/opt/nowhere/dwgread"], reads=(), output=tmp_path)

    assert raised.value.message == {
        "code": "engine.read.reader_failed",
        "params": {},
    }
    assert (raised.value.program, raised.value.exit_code) == ("dwgread", 127)


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_it_is_killed_at_its_wall_clock_limit(tmp_path: Path) -> None:
    with pytest.raises(LimitReached) as raised:
        python("import time; time.sleep(30)", tmp_path, Limits(wall_seconds=1))

    assert raised.value.limit == "wall"


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_it_cannot_take_more_memory_than_its_limit(tmp_path: Path) -> None:
    code = "import sys\ntry:\n    x = bytearray(1 << 30)\nexcept MemoryError:\n    sys.exit(3)\n"

    finished = python(code, tmp_path, Limits(memory_bytes=256 * 2**20))

    assert finished.exit_code == 3


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_it_cannot_write_a_file_larger_than_its_limit(tmp_path: Path) -> None:
    code = f"open({str(tmp_path / 'big')!r}, 'wb').write(b'x' * (2 << 20))"

    finished = python(code, tmp_path, Limits(output_bytes=1 << 20))

    assert finished.exit_code != 0
    assert (tmp_path / "big").stat().st_size <= 1 << 20


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_a_child_left_running_dies_with_the_run(tmp_path: Path) -> None:
    marker = tmp_path / "late"
    code = (
        "import subprocess, sys\n"
        f"subprocess.Popen([sys.executable, '-I', '-S', '-c', "
        f"\"import time; time.sleep(2); open({str(marker)!r}, 'w')\"])\n"
    )

    python(code, tmp_path, Limits(wall_seconds=10))

    import time

    time.sleep(3)
    assert not marker.exists()


def test_no_engine_code_starts_a_process_pool_with_fork() -> None:
    # Python 3.14 starts pools with forkserver on Linux; nothing in the engine may ask for fork.
    import multiprocessing

    engine = Path(__file__).resolve().parents[2]
    offenders = [
        str(path.relative_to(engine))
        for path in engine.rglob("*.py")
        if "tests" not in path.parts
        and any(needle in path.read_text() for needle in ('"fork"', "'fork'", "os.fork("))
    ]

    assert multiprocessing.get_start_method() == "forkserver"
    assert offenders == []
    assert os.name == "posix"


# -- reading what the program wrote: everywhere ------------------------------------------------------


def test_an_output_file_is_opened_as_the_file_itself(tmp_path: Path) -> None:
    (tmp_path / "file.json").write_bytes(b"{}")

    with sandbox.open_output(tmp_path / "file.json", "dwgread") as stream:
        assert stream.read() == b"{}"


@pytest.mark.parametrize("plant", ["symlink", "hard link", "folder", "fifo", "missing"])
def test_an_output_that_is_not_one_regular_file_is_refused(tmp_path: Path, plant: str) -> None:
    host_file = tmp_path / "host-secret.json"
    host_file.write_bytes(b'{"secret": true}')
    output = tmp_path / "out"
    output.mkdir()
    target = output / "file.json"
    if plant == "symlink":
        target.symlink_to(host_file)
    elif plant == "hard link":
        (output / "made.json").write_bytes(b"{}")
        os.link(output / "made.json", target)
    elif plant == "folder":
        target.mkdir()
    elif plant == "fifo":
        os.mkfifo(target)

    with pytest.raises(ReadError) as raised:
        sandbox.open_output(target, "dwgread")

    assert raised.value.message == {
        "code": "engine.read.output_unreadable",
        "params": {},
    }
