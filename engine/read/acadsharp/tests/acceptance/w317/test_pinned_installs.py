"""Each pinned dumper is installed beside the others, in a folder named by the first 12 hex digits of its
pin (`<install folder>/<sha256[:12]>/acadsharp-dump`), and a checkout runs the one its own pin names
(the session-13 orchestrator's addendum to ticket W317): so main and every branch on the old pin keep
reading with the old dumper after the new one is installed. A pin with no dumper installed is refused as
before, and the hash is still checked on every run.

Everywhere: the dumpers are shell scripts (as test_dumper.py's are), run with `VEXTRUS_SANDBOX=off`;
the install folder is `VEXTRUS_ACADSHARP_DUMP` and the checkout's pin `acadsharp.PIN`, both set here.
"""

import hashlib
from pathlib import Path

import pytest

from engine.read import acadsharp
from engine.read.acadsharp import DumperNotInstalled, DumperNotPinned

HEADER = '{"dumper":"acadsharp-dump","format":2,"acadsharp":"3.8.0","dwg_version":"AC1015"}'
END = '{"end":1,"unread":0}'


def dumper_reading(handle: str) -> bytes:
    """A fake dumper whose dump holds one LINE with `handle`: which one ran is seen in the dump."""
    return (
        f"#!/bin/sh\nprintf '%s\\n' '{HEADER}' '[\"{handle}\",\"LINE\",\"0\"]' '{END}' > \"$2\"\n"
    ).encode()


def install(folder: Path, program: bytes) -> str:
    """Install `program` the way toolchain.sh does, in its pin's own folder; returns its sha256."""
    digest = hashlib.sha256(program).hexdigest()
    target = folder / digest[:12] / "acadsharp-dump"
    target.parent.mkdir(parents=True)
    target.write_bytes(program)
    target.chmod(0o755)
    return digest


def pin(tmp_path: Path, digest: str) -> Path:
    path = tmp_path / "checkouts" / digest[:8] / "acadsharp-dump.sha256"
    path.parent.mkdir(parents=True)
    path.write_text(f"{digest}  acadsharp-dump\n", encoding="ascii")
    return path


@pytest.fixture
def installed(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    folder = tmp_path / "opt-vextrus" / "acadsharp-dump"
    folder.mkdir(parents=True)
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(folder))
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")
    return folder


@pytest.fixture
def drawing(tmp_path: Path) -> Path:
    folder = tmp_path / "drawings"
    folder.mkdir()
    path = folder / "W317-SAMPLE.dwg"
    path.write_bytes(b"AC1015" + bytes(64))
    return path


def test_a_checkout_runs_the_dumper_its_own_pin_names_of_two_installed(
    installed: Path, drawing: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    older = install(installed, dumper_reading("6A1"))
    newer = install(installed, dumper_reading("7B2"))

    monkeypatch.setattr(acadsharp, "PIN", pin(tmp_path, older))
    assert acadsharp.dump(drawing).handles == frozenset({0x6A1})

    monkeypatch.setattr(acadsharp, "PIN", pin(tmp_path, newer))
    assert acadsharp.dump(drawing).handles == frozenset({0x7B2})


def test_a_pin_with_no_dumper_installed_is_refused(
    installed: Path, drawing: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    install(installed, dumper_reading("6A1"))
    install(installed, dumper_reading("7B2"))
    absent = hashlib.sha256(dumper_reading("8C3")).hexdigest()
    monkeypatch.setattr(acadsharp, "PIN", pin(tmp_path, absent))

    with pytest.raises(DumperNotInstalled):
        acadsharp.dump(drawing)


def test_a_dumper_in_another_pins_folder_is_refused_and_never_run(
    installed: Path, drawing: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    ran = tmp_path / "ran"
    wanted = hashlib.sha256(dumper_reading("9D4")).hexdigest()
    swapped = installed / wanted[:12] / "acadsharp-dump"
    swapped.parent.mkdir()
    swapped.write_bytes(dumper_reading("9D4").replace(b"printf", f"touch {ran}; printf".encode()))
    swapped.chmod(0o755)
    monkeypatch.setattr(acadsharp, "PIN", pin(tmp_path, wanted))

    with pytest.raises(DumperNotPinned):
        acadsharp.dump(drawing)

    assert not ran.exists()
