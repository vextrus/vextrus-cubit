"""The dumper built from the tree is the pinned build, ships only MIT code, and reads in the sandbox.

    uv run --no-sync pytest -m "needs_toolchain or needs_bwrap" engine/read/acadsharp

Built with the pinned SDK (/opt/vextrus/dotnet) and a NuGet cache of its own, as
scripts/owner/toolchain.sh builds it. The locked restore and the pin are checked everywhere.
"""

import hashlib
import json
import re
from collections.abc import Callable
from pathlib import Path

import pytest

from engine.read import acadsharp
from engine.read.acadsharp import DumpTooLarge
from engine.read.acadsharp.tests.build import SOURCE
from engine.read.errors import ReadError

Fixture = Callable[..., Path]


def test_every_package_is_restored_by_the_hash_its_lock_pins() -> None:
    project = (SOURCE / "acadsharp-dump.csproj").read_text()
    lock = json.loads((SOURCE / "packages.lock.json").read_text())

    assert "<RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>" in project
    assert "<RestoreLockedMode>true</RestoreLockedMode>" in project
    assert '<PackageReference Include="ACadSharp" Version="[3.8.0]" />' in project
    packages = {name: entry for group in lock["dependencies"].values() for name, entry in group.items()}
    assert packages["ACadSharp"]["resolved"] == "3.8.0"
    assert all(entry["contentHash"] for entry in packages.values())


def test_toolchain_sh_installs_the_dumper_only_at_its_pin() -> None:
    script = (SOURCE.parents[1] / "scripts" / "owner" / "toolchain.sh").read_text()
    body = script[script.index("install_acadsharp_dump() {") :]

    assert 'NUGET_PACKAGES="$WORK/nuget"' in body
    assert '[ "$built" = "$pinned" ] ||' in body
    assert body.index('[ "$built" = "$pinned" ]') < body.index('install -m 0755 "$out/acadsharp-dump"')


@pytest.mark.needs_toolchain
def test_the_build_from_the_tree_is_the_pinned_build_byte_for_byte(dumper_prefix: Path) -> None:
    built = hashlib.sha256((dumper_prefix / "acadsharp-dump").read_bytes()).hexdigest()

    assert built == acadsharp.pinned_sha256(), (
        "the dumper built from tools/acadsharp-dump/ is not the pin: after changing its source, its "
        "lock or toolchain/dotnet.version, write the new sha256 into toolchain/acadsharp-dump.sha256; "
        "if the source did not change, the build is not reproducible on this machine"
    )


@pytest.mark.needs_toolchain
def test_every_package_the_build_fetched_is_mit(dumper_prefix: Path) -> None:
    nuspecs = sorted((dumper_prefix.parent / "nuget").glob("*/*/*.nuspec"))
    licences = {
        path.parent.parent.name: re.findall(
            r"<license type=\"expression\">([^<]+)</license>", path.read_text()
        )
        for path in nuspecs
    }

    assert "acadsharp" in licences
    assert "microsoft.netcore.app.runtime.linux-x64" in licences  # the runtime inside the file
    assert licences == {name: ["MIT"] for name in licences}


@pytest.mark.needs_toolchain
@pytest.mark.parametrize(
    ("name", "version"),
    [
        ("entity_kinds", "AC1032"),
        ("entity_kinds", "AC1027"),
        ("entity_kinds", "AC1024"),
        ("title_block", "AC1032"),
        ("text_kinds", "AC1032"),
        ("sheet_layout", "AC1032"),
    ],
)
def test_the_real_dumper_reads_a_fixture_in_the_sandbox(
    dumper_prefix: Path, dwg_fixture: Fixture, monkeypatch: pytest.MonkeyPatch, name: str, version: str
) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper_prefix))
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)

    read = acadsharp.dump(dwg_fixture(name, version=version))

    assert (read.acadsharp, read.dwg_version) == ("3.8.0", version)
    assert len(read.handles) == sum(read.types.values()) == sum(read.layers.values()) > 0


@pytest.mark.needs_toolchain
def test_the_real_dumper_on_a_file_it_cannot_read_is_a_failure(
    dumper_prefix: Path, dwg_fixture: Fixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper_prefix))
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)

    with pytest.raises(ReadError) as raised:
        acadsharp.dump(dwg_fixture("second_reader_fails"))

    assert raised.value.message == {
        "code": "engine.read.reader_failed",
        "params": {"program": "acadsharp-dump", "exit_code": 1},
    }


@pytest.mark.needs_toolchain
def test_the_real_dumper_on_garbage_is_a_failure(
    dumper_prefix: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper_prefix))
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)
    garbage = tmp_path / "garbage.dwg"
    garbage.write_bytes(b"AC1032" + hashlib.sha256(b"x").digest() * 1000)

    with pytest.raises(ReadError) as raised:
        acadsharp.dump(garbage)

    assert raised.value.message["code"] == "engine.read.reader_failed"


@pytest.mark.needs_toolchain
def test_the_real_dumper_over_the_entity_bound_is_too_large(
    dumper_prefix: Path, dwg_fixture: Fixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper_prefix))
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)
    monkeypatch.setattr(acadsharp, "MAX_ENTITIES", 10)

    with pytest.raises(DumpTooLarge):
        acadsharp.dump(dwg_fixture("entity_kinds"))
