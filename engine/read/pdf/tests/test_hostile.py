"""The trust boundary (engine/read/pdf): each attack as a generated hostile PDF, refused or bounded.

Nothing a PDF names is run, followed or opened; a bomb stops at the memory limit, a loop at the CPU
limit; a damaged page or font is marked and the rest read. The class at the end runs the worst of them
in bubblewrap, as production does.
"""

import os
import socket
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest

from engine.messages import pdf_report as codes
from engine.read import pdf, sandbox
from engine.read.errors import ReadError
from engine.read.pdf.tests.conftest import SMALL
from engine.read.sandbox import Finished

type Fixture = Callable[..., Path]


@contextmanager
def listener() -> Iterator[tuple[str, Callable[[], int]]]:
    """A local web address that counts the connections made to it."""
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(("127.0.0.1", 0))
    server.listen(8)
    server.setblocking(False)

    def accepted() -> int:
        count = 0
        while True:
            try:
                connection, _ = server.accept()
            except BlockingIOError:
                return count
            connection.close()
            count += 1

    try:
        yield f"http://127.0.0.1:{server.getsockname()[1]}/drawing.png", accepted
    finally:
        server.close()


def refused(path: Path) -> dict[str, object]:
    with pytest.raises(ReadError) as raised:
        pdf.report(path, limits=SMALL)
    return dict(raised.value.message)


def test_scripts_actions_links_and_attached_files_are_counted_and_never_acted_on(tmp_path: Path) -> None:
    fifo = tmp_path / "secret"
    os.mkfifo(fifo)  # opening it to read would block until the wall-clock limit
    with listener() as (url, accepted):
        path = tmp_path / "extras.pdf"
        from engine.fixtures.pdf import extras

        path.write_bytes(extras.write(url=url, target=str(fifo)))
        started = time.monotonic()
        found = pdf.report(path, limits=SMALL)
        text = pdf.page_text(path, limits=SMALL)
        time.sleep(0.2)
        assert accepted() == 0
    assert time.monotonic() - started < SMALL.wall_seconds
    assert found.extras == {"scripts": 3, "launches": 1, "links": 1, "remote": 3, "files": 2}
    assert codes.EXTRAS_IGNORED(count=10) in found.messages
    assert [item.text for item in text[0].items] == ["S-201", "FOUNDATION PLAN"]


@pytest.mark.parametrize("where", ["content", "object_stream"])
def test_a_stream_that_inflates_to_gigabytes_stops_at_the_memory_limit(
    pdf_fixture: Fixture, where: str
) -> None:
    assert refused(pdf_fixture("inflate", where=where)) == codes.LIMIT_REACHED(limit="memory")


def test_a_page_tree_that_loops_gives_each_page_once(pdf_fixture: Fixture) -> None:
    found = pdf.report(pdf_fixture("page_tree", kind="loop"), limits=SMALL)

    assert found.counts["pages"] == 2


def test_a_page_tree_deeper_than_a_walk_is_refused_as_damaged(pdf_fixture: Fixture) -> None:
    assert refused(pdf_fixture("page_tree", kind="deep")) == codes.UNREADABLE()


def test_an_image_claiming_huge_dimensions_is_counted_and_never_decoded(pdf_fixture: Fixture) -> None:
    found = pdf.report(pdf_fixture("damaged", kind="huge_image"), limits=SMALL)

    assert found.counts["images"] == 1
    assert found.pages[0].picture_share == pytest.approx(0.1)


def test_a_font_with_a_malformed_table_is_marked_and_the_rest_read(pdf_fixture: Fixture) -> None:
    path = pdf_fixture("bad_font", kind="table")
    found = pdf.report(path, limits=SMALL)

    assert [(f.name, f.kind) for f in found.fonts] == [
        ("ArialNarrow", "truetype"),
        ("Broken", "unreadable"),
    ]
    assert codes.FONTS_UNREADABLE(fonts=1) in found.messages
    assert codes.UNMAPPED_TEXT(chars=4) in found.messages
    assert [i.text for i in pdf.page_text(path, limits=SMALL)[0].items] == ["S-501", "STAIR DETAILS"]


def test_a_font_table_that_would_loop_for_minutes_stops_at_the_cpu_limit(pdf_fixture: Fixture) -> None:
    assert refused(pdf_fixture("bad_font", kind="cmap_loop")) == codes.LIMIT_REACHED(limit="cpu")


def test_forms_nested_past_the_stack_mark_their_page_and_the_rest_is_read(pdf_fixture: Fixture) -> None:
    found = pdf.report(pdf_fixture("damaged", kind="nested_forms"), limits=SMALL)

    assert [p.readable for p in found.pages] == [True, False]
    assert codes.PAGE_UNREADABLE(page=2) in found.messages


def test_a_locked_pdf_is_refused(pdf_fixture: Fixture) -> None:
    assert refused(pdf_fixture("damaged", kind="locked")) == codes.LOCKED()


def test_noise_after_a_pdf_header_is_refused_as_damaged(pdf_fixture: Fixture) -> None:
    assert refused(pdf_fixture("damaged", kind="garbage")) == codes.UNREADABLE()


def test_a_child_that_crashes_is_a_damaged_file(
    pdf_fixture: Fixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(pdf, "CHILD", "import sys; sys.exit(3)")
    with pytest.raises(ReadError) as raised:
        pdf.report(pdf_fixture("plot"), limits=SMALL)
    assert raised.value.message == codes.UNREADABLE()


def test_a_child_that_runs_past_the_wall_clock_is_stopped(
    pdf_fixture: Fixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(pdf, "CHILD", "import time; time.sleep(60)")
    limits = SMALL.__class__(
        cpu_seconds=5, memory_bytes=SMALL.memory_bytes, wall_seconds=1.0, output_bytes=SMALL.output_bytes
    )
    with pytest.raises(ReadError) as raised:
        pdf.report(pdf_fixture("plot", producer="wall"), limits=limits)
    assert raised.value.message == codes.LIMIT_REACHED(limit="wall")


@pytest.mark.parametrize(
    "written",
    [
        '{"refused": "locked", "extra": 1}',
        '{"producer": null}',
        "[1, 2",
        (
            '{"producer": null, "creator": null, "pages": [], "extras": '
            '{"scripts": -1, "launches": 0, "links": 0, "remote": 0, "files": 0}}'
        ),
    ],
)
def test_what_the_child_writes_is_refused_unless_it_is_what_walk_writes(
    pdf_fixture: Fixture, monkeypatch: pytest.MonkeyPatch, written: str
) -> None:
    child = f"import sys; open(sys.argv[3], 'w').write({written!r})"
    monkeypatch.setattr(pdf, "CHILD", child)
    with pytest.raises(ReadError) as raised:
        pdf.report(pdf_fixture("plot", producer=f"shape {len(written)}"), limits=SMALL)
    assert raised.value.message == codes.UNREADABLE()


def test_a_link_the_child_leaves_in_place_of_its_output_is_not_followed(
    pdf_fixture: Fixture, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    secret = tmp_path / "secret.json"
    secret.write_text('{"refused": "locked"}')
    monkeypatch.setattr(pdf, "CHILD", f"import os, sys; os.symlink({str(secret)!r}, sys.argv[3])")
    with pytest.raises(ReadError) as raised:
        pdf.report(pdf_fixture("plot", producer="link"), limits=SMALL)
    assert raised.value.message["code"] == "engine.read.output_unreadable"


@pytest.mark.needs_bwrap
class TestInTheSandbox:
    """The same reading in bubblewrap: no network, nothing but the PDF and Python bound."""

    @pytest.fixture(autouse=True)
    def runs(self, monkeypatch: pytest.MonkeyPatch) -> list[Finished]:
        runs: list[Finished] = []
        real = sandbox.run

        def recorded(*args: object, **kwargs: object) -> Finished:
            finished = real(*args, **kwargs)  # type: ignore[arg-type]
            runs.append(finished)
            return finished

        monkeypatch.setattr("engine.read.pdf.run", recorded)
        return runs

    def test_a_plot_is_read_in_the_sandbox(self, pdf_fixture: Fixture, runs: list[Finished]) -> None:
        found = pdf.report(pdf_fixture("plot", producer="sandboxed"))

        assert found.counts["pages"] == 3
        assert [run.sandboxed for run in runs] == [True]

    def test_nothing_a_pdf_names_is_fetched_from_the_sandbox(self, tmp_path: Path) -> None:
        from engine.fixtures.pdf import extras

        with listener() as (url, accepted):
            path = tmp_path / "extras.pdf"
            path.write_bytes(extras.write(url=url, target=str(tmp_path / "missing")))
            found = pdf.report(path, limits=SMALL)
            time.sleep(0.2)
            assert accepted() == 0
        assert found.counts["extras_links"] == 1

    def test_a_bomb_stops_at_the_memory_limit_in_the_sandbox(self, pdf_fixture: Fixture) -> None:
        assert refused(pdf_fixture("inflate", where="content")) == codes.LIMIT_REACHED(limit="memory")

    def test_the_child_cannot_reach_the_network(
        self, pdf_fixture: Fixture, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        with listener() as (url, accepted):
            port = int(url.split(":")[2].split("/")[0])
            probe = (
                "import socket, sys\n"
                "try:\n"
                f"    socket.create_connection(('127.0.0.1', {port}), timeout=2)\n"
                "except OSError:\n"
                "    sys.exit(4)\n"
            )
            monkeypatch.setattr(pdf, "CHILD", probe)
            with pytest.raises(ReadError):
                pdf.report(pdf_fixture("plot", producer="network"), limits=SMALL)
            time.sleep(0.2)
            assert accepted() == 0
