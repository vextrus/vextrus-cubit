"""The dumper built from the tree (ACadSharp 3.8.0's source plus #1205's DWG scale repair) reads an
INSERT whose stored scale is 0, as AutoCAD's AUDIT repairs it, so the file agrees with no special
rule; nothing else it reads changes, and the build is still the pin (ticket W317, section 3, cases
10-14). Needs the toolchain:

    uv run pytest -m needs_toolchain engine/read/acadsharp/tests/acceptance/w317/test_patched_reader.py

The zero-scale DWGs are the repo's `zero_z_scale` fixture and two generators defined here, each built by
the fixture writer (engine/fixtures/dwg/) and then patched by `zero_z_scale.patch`, which overwrites the
one stored double `zero_z_scale.MARK` with 0.0. Every name in them is invented.
"""

import hashlib
import subprocess
from collections.abc import Callable
from pathlib import Path
from types import ModuleType

import pytest
from ezdxf.document import Drawing

from engine.check.decoders_agree import run
from engine.fixtures import dwg
from engine.fixtures.dwg import new_drawing, zero_z_scale
from engine.read import acadsharp
from engine.read import read as read_dwg
from engine.read.acadsharp.tests.build import build_dumper
from engine.read.acadsharp.tests.conftest import dumper_prefix, dwg_fixture  # noqa: F401
from engine.recognise.types import CheckOutcome

pytestmark = pytest.mark.needs_toolchain

Fixture = Callable[..., Path]
MARK = zero_z_scale.MARK


class ZeroScale:
    """A generator for `engine.fixtures.dwg`: an AC1015 drawing whose one INSERT stores its scale as
    `scale` (MARK where the 0 goes), and `patch` turning MARK into 0.0.

    The INSERT carries XDATA of two registered applications: that moves the stored scale four bits,
    which lands MARK on a whole byte for the forms stored from the X scale (measured on 5 Oct 2026 with
    the writer at its pin; without it MARK is stored at a bit offset and `patch` finds it 0 times)."""

    VERSION = "AC1015"

    def __init__(self, scale: tuple[float, float, float]) -> None:
        self.scale = scale

    def draw(self) -> Drawing:
        doc = new_drawing()
        doc.layers.add("LYR-W317-PEGS")
        marker = doc.blocks.new("BLK-W317-PEG", base_point=(0, 0))
        marker.add_circle((0, 0), 0.4)
        model = doc.modelspace()
        model.add_line((-3, 2), (14, 2))
        x, y, z = self.scale
        insert = model.add_blockref(
            "BLK-W317-PEG",
            (6, -1),
            dxfattribs={"layer": "LYR-W317-PEGS", "xscale": x, "yscale": y, "zscale": z},
        )
        for application in ("W317-APP-ONE", "W317-APP-TWO"):
            doc.appids.new(application)
            insert.set_xdata(application, [(1000, "w317")])
        return doc

    @staticmethod
    def patch(data: bytes) -> bytes:
        return zero_z_scale.patch(data)


VARIANTS = {
    "w317_uniform_scale": ZeroScale((MARK, MARK, MARK)),  # stored once: "41 only"
    "w317_x_scale_only": ZeroScale((MARK, 2.0, 3.0)),  # stored as 41, 42 and 43
}


@pytest.fixture
def variants(monkeypatch: pytest.MonkeyPatch) -> None:
    """`dwg_fixture` and `dwg.build` find this file's generators by their names."""
    stock = dwg.generator

    def generator(name: str) -> ModuleType | ZeroScale:
        return VARIANTS[name] if name in VARIANTS else stock(name)

    monkeypatch.setattr(dwg, "generator", generator)


@pytest.fixture
def real_dumper(dumper_prefix: Path, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: F811
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper_prefix))
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)


def the_dumper(prefix: Path) -> Path:
    """The one program named `acadsharp-dump` a build left under `prefix`."""
    found = [path for path in prefix.rglob("acadsharp-dump") if path.is_file()]
    assert len(found) == 1, found
    return found[0]


# -- 10. the INSERT is read --------------------------------------------------------------------------


@pytest.mark.usefixtures("real_dumper")
def test_an_insert_whose_stored_z_scale_is_zero_is_read(dwg_fixture: Fixture) -> None:  # noqa: F811
    read = acadsharp.dump(dwg_fixture("zero_z_scale"))

    assert read.unread == {}
    assert read.types == {"LINE": 1, "CIRCLE": 1, "INSERT": 1}
    assert read.layers["SITE"] == 1
    assert read.acadsharp == "3.8.0"
    assert len(read.handles) == 3


# -- 11. the file agrees, with no special rule ------------------------------------------------------


@pytest.mark.usefixtures("real_dumper")
def test_the_file_with_a_zero_z_scale_agrees_with_no_finding(dwg_fixture: Fixture) -> None:  # noqa: F811
    path = dwg_fixture("zero_z_scale")
    first = read_dwg(path)
    assert [getattr(e, "scale", None) for e in first.entities.values() if e.type == "INSERT"] == [
        (1.0, 1.0, 0.0)
    ]

    result = run(path, first)

    assert result.outcome == CheckOutcome.PASSED, result.finding
    assert result.finding is None


# -- 12. the uniform and X-only forms --------------------------------------------------------------


@pytest.mark.usefixtures("real_dumper", "variants")
@pytest.mark.parametrize("name", sorted(VARIANTS))
def test_an_insert_whose_stored_x_scale_is_zero_is_read_and_agrees(
    dwg_fixture: Fixture,  # noqa: F811
    name: str,
) -> None:
    path = dwg_fixture(name)
    first = read_dwg(path)
    scales = [getattr(e, "scale", None) for e in first.entities.values() if e.type == "INSERT"]
    assert len(scales) == 1
    assert scales[0] is not None
    assert scales[0][0] == 0.0  # the first reader reads the stored 0

    read = acadsharp.dump(path)

    assert read.unread == {}
    assert read.types == {"LINE": 1, "CIRCLE": 1, "INSERT": 1}
    assert read.layers["LYR-W317-PEGS"] == 1
    assert run(path, first).outcome == CheckOutcome.PASSED


# -- 13. nothing else changed (green before and after) ---------------------------------------------


@pytest.mark.usefixtures("real_dumper")
def test_a_non_zero_scale_still_reads_and_agrees(dwg_fixture: Fixture) -> None:  # noqa: F811
    path = dwg_fixture("mirrored_insert")
    first = read_dwg(path)

    assert acadsharp.dump(path).unread == {}
    assert run(path, first).outcome == CheckOutcome.PASSED


@pytest.mark.usefixtures("real_dumper")
@pytest.mark.parametrize("name", ["second_reader_fails", "duplicate_layer"])
def test_the_other_failures_still_stop_the_dumper(dwg_fixture: Fixture, name: str) -> None:  # noqa: F811
    path = dwg_fixture(name)

    with pytest.raises(acadsharp.DumperStopped) as raised:
        run(path, read_dwg(path))

    assert raised.value.why == "exit 1"


# -- 14. the build is the pin (green before and after) ---------------------------------------------


def test_the_build_is_the_pin_in_any_folder_and_inside_a_git_work_tree(
    dumper_prefix: Path,  # noqa: F811
    tmp_path: Path,
) -> None:
    pinned = acadsharp.pinned_sha256()
    repository = tmp_path / "checkout-w317"
    repository.mkdir()
    git = ["git", "-C", str(repository), "-c", "user.email=w317@example.invalid", "-c", "user.name=w"]
    subprocess.run([*git, "init", "-q"], check=True, timeout=60)
    subprocess.run([*git, "commit", "-q", "--allow-empty", "-m", "w317"], check=True, timeout=60)

    builds = [
        the_dumper(dumper_prefix),
        the_dumper(build_dumper(tmp_path / "elsewhere")),
        the_dumper(build_dumper(repository / "nested" / "build")),
    ]

    assert [hashlib.sha256(path.read_bytes()).hexdigest() for path in builds] == [pinned] * 3
