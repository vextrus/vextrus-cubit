"""The dumper runs only at its pin, in the sandbox, and nothing it does counts as agreement.

The refusals run everywhere. A fake dumper (a shell script, its sha256 given as the pin) attacks the
sandbox from the dumper's place; those need bubblewrap:
    uv run --no-sync pytest -m needs_bwrap engine/read/acadsharp/tests/test_dumper.py
The real dumper, built from the tree, is `needs_toolchain` (test_build.py).
"""

import hashlib
import os
import socket
import threading
from pathlib import Path

import pytest

from engine.read import acadsharp
from engine.read.acadsharp import (
    DumperNotInstalled,
    DumperNotPinned,
    DumperStopped,
    DumpTooLarge,
    run_dumper,
)
from engine.read.sandbox import Limits, SandboxRefused, SandboxUnavailable

STOPPED = {"code": "engine.decoders_agree.stopped", "params": {}}

HEADER = '{"dumper":"acadsharp-dump","format":2,"acadsharp":"3.8.0","dwg_version":"AC1032"}'
END = '{"end":1,"unread":0}'
GOOD = f"""printf '%s\\n' '{HEADER}' '["8D","LINE","0"]' '{END}' > "$2"\n"""


def script(folder: Path, body: str, shell: str = "/bin/sh") -> tuple[Path, str]:
    """A fake dumper at `folder/acadsharp-dump` and its sha256."""
    folder.mkdir(parents=True, exist_ok=True)
    program = folder / "acadsharp-dump"
    program.write_text(f"#!{shell}\n{body}")
    program.chmod(0o755)
    return program, hashlib.sha256(program.read_bytes()).hexdigest()


@pytest.fixture
def drawing(tmp_path: Path) -> Path:
    folder = tmp_path / "drawings"
    folder.mkdir()
    path = folder / "KR-STR-R0.dwg"
    path.write_bytes(b"AC1032" + bytes(100))
    return path


# -- the pin: everywhere ------------------------------------------------------------------------------


def test_the_pin_names_the_dumper_by_a_sha256() -> None:
    digest = acadsharp.pinned_sha256()

    assert len(digest) == 64
    assert acadsharp.PIN.read_text() == f"{digest}  acadsharp-dump\n"


def test_a_dumper_that_is_not_installed_is_refused(
    tmp_path: Path, drawing: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(tmp_path / "nowhere"))

    with pytest.raises(DumperNotInstalled) as raised:
        acadsharp.dump(drawing)

    assert raised.value.message == {"code": "engine.decoders_agree.not_installed", "params": {}}


def test_a_dumper_that_is_not_the_pinned_build_is_refused_and_never_run(
    tmp_path: Path, drawing: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    ran = tmp_path / "ran"
    # In the folder the pin names, where toolchain.sh installs it (ticket W317), but another build.
    pinned = acadsharp.pinned_sha256()[:12]
    program, _ = script(tmp_path / "swapped" / pinned, f"touch {ran}\n" + GOOD)
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(program.parent.parent))
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")

    with pytest.raises(DumperNotPinned) as raised:
        acadsharp.dump(drawing)

    assert raised.value.message == {"code": "engine.decoders_agree.not_pinned", "params": {}}
    assert not ran.exists()


def test_the_hash_is_taken_on_every_run_so_a_dumper_changed_after_one_run_is_refused(
    tmp_path: Path, drawing: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")
    program, digest = script(tmp_path / "bin", GOOD)
    assert run_dumper(program, drawing, sha256=digest).handles == frozenset({0x8D})

    program.write_text(program.read_text() + "# changed\n")

    with pytest.raises(DumperNotPinned):
        run_dumper(program, drawing, sha256=digest)


def test_a_link_is_followed_to_the_file_that_is_hashed(
    tmp_path: Path, drawing: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")
    program, digest = script(tmp_path / "real", GOOD)
    link = tmp_path / "link"
    link.symlink_to(program)

    assert run_dumper(link, drawing, sha256=digest).handles == frozenset({0x8D})
    with pytest.raises(DumperNotPinned):
        run_dumper(link, drawing, sha256=hashlib.sha256(b"another").hexdigest())


@pytest.mark.parametrize("kind", ["folder", "fifo"])
def test_a_folder_or_a_fifo_in_the_dumpers_place_is_not_a_dumper(
    tmp_path: Path, drawing: Path, kind: str
) -> None:
    place = tmp_path / "acadsharp-dump"
    if kind == "folder":
        place.mkdir()
    else:
        os.mkfifo(place)

    with pytest.raises(DumperNotInstalled):
        run_dumper(place, drawing, sha256="0" * 64)


def test_a_refusal_survives_the_trip_back_from_a_worker() -> None:
    import pickle

    for error in (
        DumperNotInstalled(),
        DumperNotPinned(),
        DumpTooLarge(10),
        DumperStopped("acadsharp-dump", "exit 139"),
    ):
        again = pickle.loads(pickle.dumps(error))
        assert (type(again), again.message, again.args) == (type(error), error.message, error.args)


def test_a_stopped_dumper_keeps_its_program_and_why_for_the_log_never_in_its_finding() -> None:
    error = DumperStopped("acadsharp-dump", "exit 139")

    assert error.message == STOPPED
    assert (error.program, error.why) == ("acadsharp-dump", "exit 139")
    assert "exit 139" in str(error)


# -- what the dumper did: run directly, where it needs no sandbox -----------------------------------


@pytest.mark.parametrize(
    ("body", "why"),
    [
        pytest.param("exit 1\n", "exit 1", id="exit-1"),
        pytest.param("kill -TERM $$\n", "exit -15", id="killed"),
        pytest.param("exit 0\n", "output unreadable", id="wrote-nothing"),
        pytest.param('printf garbage > "$2"\n', "output unreadable", id="wrote-garbage"),
        pytest.param('ln -s /etc/passwd "$2"\n', "output unreadable", id="left-a-link"),
        pytest.param('mkdir "$2"\n', "output unreadable", id="left-a-folder"),
    ],
)
def test_a_dumper_that_stops_or_leaves_no_readable_dump_has_stopped(
    tmp_path: Path, drawing: Path, monkeypatch: pytest.MonkeyPatch, body: str, why: str
) -> None:
    # The first reader read the file; the second stopped: never 04's "could not be read", and
    # never the program's name or an exit code in the finding.
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")
    program, digest = script(tmp_path / "bin", (GOOD if why.startswith("exit") else "") + body)

    with pytest.raises(DumperStopped) as raised:
        run_dumper(program, drawing, sha256=digest)

    assert raised.value.message == STOPPED
    assert raised.value.why == why


def test_a_dumper_past_its_time_has_stopped_and_never_agrees(
    tmp_path: Path, drawing: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")
    program, digest = script(tmp_path / "bin", GOOD + "exec sleep 30\n")

    with pytest.raises(DumperStopped) as raised:
        run_dumper(program, drawing, sha256=digest, limits=Limits(wall_seconds=0.5))

    assert (raised.value.message, raised.value.why) == (STOPPED, "limit wall")


def test_a_dumper_that_cannot_start_has_stopped(
    tmp_path: Path, drawing: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")
    program, digest = script(tmp_path / "bin", GOOD)
    program.chmod(0o644)  # the pinned bytes, but not a program the sandbox can start

    with pytest.raises(DumperStopped) as raised:
        run_dumper(program, drawing, sha256=digest)

    assert raised.value.message == STOPPED


@pytest.mark.parametrize("refusal", [SandboxUnavailable("no bwrap"), SandboxRefused()])
def test_a_machine_that_cannot_sandbox_keeps_the_sandboxs_own_words(
    tmp_path: Path, drawing: Path, monkeypatch: pytest.MonkeyPatch, refusal: Exception
) -> None:
    # Decided: a missing or refused sandbox stops both readers, and the first reader, run first,
    # fails on it before this one runs; 04's words ("Drawings cannot be read here…") stay true.
    program, digest = script(tmp_path / "bin", GOOD)

    def refuse(*args: object, **kwargs: object) -> None:
        raise refusal

    monkeypatch.setattr(acadsharp, "run", refuse)

    with pytest.raises(type(refusal)):
        run_dumper(program, drawing, sha256=digest)


def test_a_dumper_that_writes_past_the_dumps_bound_is_stopped_as_too_large(
    tmp_path: Path, drawing: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")
    monkeypatch.setattr(acadsharp, "MAX_BYTES", 64 * 1024)
    program, digest = script(tmp_path / "bin", 'exec head -c 10000000 /dev/zero > "$2"\n')

    with pytest.raises(DumpTooLarge):
        run_dumper(program, drawing, sha256=digest)


# -- what the sandbox holds against the dumper: needs bwrap ------------------------------------------


@pytest.fixture
def sandboxed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_in_the_sandbox_it_reads_what_the_dumper_wrote(tmp_path: Path, drawing: Path) -> None:
    program, digest = script(tmp_path / "bin", GOOD)

    read = run_dumper(program, drawing, sha256=digest)

    assert (read.handles, read.types, read.layers) == (frozenset({0x8D}), {"LINE": 1}, {"0": 1})


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_the_dumper_cannot_reach_the_network_even_on_the_hosts_loopback(
    tmp_path: Path, drawing: Path
) -> None:
    listener = socket.create_server(("127.0.0.1", 0))
    port = listener.getsockname()[1]
    listener.settimeout(5)
    accepted: list[bool] = []
    thread = threading.Thread(target=lambda: accepted.append(_accepted(listener)))
    thread.start()
    # The dump says whether the connection was made: its layer is "connected" or "refused".
    body = (
        f"if exec 3<>/dev/tcp/127.0.0.1/{port}; then layer=connected; else layer=refused; fi\n"
        f"""printf '%s\\n' '{HEADER}' "[\\"1\\",\\"LINE\\",\\"$layer\\"]" '{END}' > "$2"\n"""
    )
    program, digest = script(tmp_path / "bin", body, shell="/bin/bash")

    read = run_dumper(program, drawing, sha256=digest)
    listener.close()
    thread.join()

    assert read.layers == {"refused": 1}
    assert accepted == [False]


def _accepted(listener: socket.socket) -> bool:
    try:
        connection, _ = listener.accept()
    except OSError:
        return False
    connection.close()
    return True


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_the_dumper_cannot_write_outside_its_output_folder(tmp_path: Path, drawing: Path) -> None:
    program, digest = script(
        tmp_path / "bin",
        f'echo x > "{drawing}"; echo x > "{drawing.parent}/planted.dwg"; '
        f'echo x > "{program_path(tmp_path)}"; echo x > /tmp/planted; echo x > "$HOME/../planted"\n'
        + GOOD,
    )
    original = drawing.read_bytes()

    run_dumper(program, drawing, sha256=digest)

    assert drawing.read_bytes() == original
    assert sorted(p.name for p in drawing.parent.iterdir()) == [drawing.name]
    assert hashlib.sha256(program.read_bytes()).hexdigest() == digest
    assert not Path("/tmp/planted").exists()


def program_path(tmp_path: Path) -> Path:
    return tmp_path / "bin" / "acadsharp-dump"


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_the_dumper_sees_no_environment_and_no_home(
    tmp_path: Path, drawing: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_SECRET_FOR_TEST", "must-not-reach")
    body = (
        "seen=$(env | grep -c VEXTRUS_SECRET_FOR_TEST); homes=$(ls /home /root 2>/dev/null | wc -l)\n"
        f"""printf '%s\\n' '{HEADER}' "[\\"1\\",\\"$seen\\",\\"$homes\\"]" '{END}' > "$2"\n"""
    )
    program, digest = script(tmp_path / "bin", body)

    read = run_dumper(program, drawing, sha256=digest)

    assert (read.types, read.layers) == ({"0": 1}, {"0": 1})


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_in_the_sandbox_a_dumper_past_its_time_never_agrees(tmp_path: Path, drawing: Path) -> None:
    program, digest = script(tmp_path / "bin", GOOD + "exec sleep 30\n")

    with pytest.raises(DumperStopped):
        run_dumper(program, drawing, sha256=digest, limits=Limits(wall_seconds=1))


@pytest.mark.needs_bwrap
@pytest.mark.usefixtures("sandboxed")
def test_in_the_sandbox_a_huge_dump_is_stopped_at_the_bound(
    tmp_path: Path, drawing: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(acadsharp, "MAX_BYTES", 64 * 1024)
    program, digest = script(tmp_path / "bin", 'exec head -c 100000000 /dev/zero > "$2"\n')

    with pytest.raises(DumpTooLarge):
        run_dumper(program, drawing, sha256=digest)
