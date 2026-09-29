"""The Check catalogue (ticket 19b): what it lists, what it refuses, and what `run` checks."""

import textwrap
import uuid
from pathlib import Path
from typing import Any

import pytest

from engine.check import catalogue
from engine.check.catalogue import CatalogueError, Entry, entries, run, run_all, scan
from engine.recognise.tests.candidates import plan, sheet, view
from engine.recognise.tests.stand_ins import stand_ins
from engine.recognise.types import (
    DisciplineConvention,
    DrawingList,
    ListEntry,
    ListSource,
    PlotMatch,
    SetReading,
    SheetConventions,
    ViewKind,
)

READERS = stand_ins({"GROUND FLOOR": ("ground",)})
CONVENTIONS = SheetConventions(disciplines=(DisciplineConvention("structural", ("S",)),))


def test_the_catalogue_lists_every_check_in_code_order_with_its_library_row() -> None:
    assert entries() == (
        Entry("bangla_ansi", 1, "M0", "sanity", "engine.catalogue.bangla_ansi", set=False),
        Entry("coverage", 1, "M0", "conservation", "engine.catalogue.coverage", set=True),
        Entry("decoders_agree", 1, "M0", "source", "engine.catalogue.decoders_agree", set=False),
        Entry("plot_pages", 1, "M0", "source", "engine.catalogue.plot_pages", set=True),
        Entry("register", 1, "M0", "source", "engine.catalogue.register", set=True),
        Entry("storey_titles", 1, "M0", "source", "engine.catalogue.storey_titles", set=True),
    )


# A stray file in engine/check/ ----------------------------------------------------------------------

GOOD = """
from engine.messages import catalogue as names
CODE = "{code}"
VERSION = 1
MILESTONE = "M0"
KIND = "source"
MESSAGE = names.COVERAGE
"""


def package(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, modules: dict[str, str]) -> str:
    name = f"checks_{uuid.uuid4().hex}"
    folder = tmp_path / name
    folder.mkdir()
    (folder / "__init__.py").write_text("")
    for module, source in modules.items():
        (folder / f"{module}.py").write_text(textwrap.dedent(source))
    monkeypatch.syspath_prepend(str(tmp_path))
    return name


@pytest.mark.parametrize(
    ("source", "match"),
    [
        ("def run(artefact):\n    return None\n", "declares no CODE, VERSION, MILESTONE, KIND, MESSAGE"),
        (GOOD.format(code="Not A Key"), "not a lower-case key"),
        (GOOD.format(code="x").replace("VERSION = 1", "VERSION = 0"), "VERSION"),
        (GOOD.format(code="x").replace("VERSION = 1", "VERSION = True"), "VERSION"),
        (GOOD.format(code="x").replace("VERSION = 1", 'VERSION = "1"'), "VERSION"),
        (GOOD.format(code="x").replace('"M0"', '"m0"'), "MILESTONE"),
        (GOOD.format(code="x").replace('KIND = "source"', 'KIND = "vibes"'), "KIND"),
        (GOOD.format(code="x").replace("names.COVERAGE", '"engine.catalogue.coverage"'), "MESSAGE"),
        (  # a finding's code, with its values: the Library shows a name with none (review round 1)
            GOOD.format(code="x").replace(
                "names.COVERAGE", '__import__("engine.messages.coverage").messages.coverage.UNACCOUNTED'
            ),
            "no parameters",
        ),
        (
            GOOD.format(code="x").replace(
                "names.COVERAGE",
                '__import__("engine.messages").messages.MessageCode("engine.nowhere.said")',
            ),
            "MESSAGE",
        ),
        (GOOD.format(code="x") + "SET = 3\n", "SET is not a function"),
    ],
)
def test_a_module_that_is_not_a_check_is_refused_loudly(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, source: str, match: str
) -> None:
    name = package(tmp_path, monkeypatch, {"fine": GOOD.format(code="fine"), "stray": source})

    with pytest.raises(CatalogueError, match=match):
        scan(name)


def test_a_code_given_twice_is_refused(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    name = package(
        tmp_path, monkeypatch, {"one": GOOD.format(code="twin"), "two": GOOD.format(code="twin")}
    )

    with pytest.raises(CatalogueError, match=r"declares the code 'twin', which .*\.one declares"):
        scan(name)


def test_a_module_whose_import_raises_is_not_skipped(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    name = package(tmp_path, monkeypatch, {"broken": 'raise RuntimeError("a stray import")\n'})

    with pytest.raises(RuntimeError, match="a stray import"):
        scan(name)


def test_the_catalogue_leaves_itself_out(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    name = package(tmp_path, monkeypatch, {"catalogue": "", "fine": GOOD.format(code="fine")})

    assert [check.entry.code for check in scan(name)] == ["fine"]


# run: what each Check returns is checked -------------------------------------------------------------


def one_check(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, body: str) -> str:
    source = (
        GOOD.format(code="probe")
        + textwrap.dedent(
            """
        from engine.recognise.types import CheckResult, CheckOutcome

        def check(reading, *, recognisers):
        """
        )
        + textwrap.indent(textwrap.dedent(body), "    ")
        + "\nSET = check\n"
    )
    return package(tmp_path, monkeypatch, {"probe": source})


@pytest.mark.parametrize(
    ("body", "error", "match"),
    [
        ("return ()", TypeError, "not a list"),
        ("return ['passed']", TypeError, "not a CheckResult"),
        ("return [CheckResult('other', CheckOutcome.PASSED)]", ValueError, "not its own"),
        (
            (
                "return [CheckResult('probe', CheckOutcome.FIRED, finding={"
                "'code': 'engine.nowhere.said', 'params': {}})]"
            ),
            ValueError,
            "no engine code",
        ),
        (
            (
                "return [CheckResult('probe', CheckOutcome.FIRED, finding={'code': "
                "'engine.coverage.unaccounted', 'params': {'sheet': 'S-01'}})]"
            ),
            ValueError,
            "is not given",
        ),
        ("raise KeyError('a Check that fails')", KeyError, "a Check that fails"),
    ],
)
def test_what_a_check_returns_outside_the_contract_fails_the_stage(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    body: str,
    error: type[Exception],
    match: str,
) -> None:
    name = one_check(tmp_path, monkeypatch, body)

    with pytest.raises(error, match=match):
        run(SetReading(), recognisers=READERS, package=name)


def test_run_takes_a_set_reading_and_refuses_an_unstamped_group() -> None:
    with pytest.raises(TypeError, match="SetReading"):
        run({"sheets": ()}, recognisers=READERS)  # type: ignore[arg-type]
    unstamped = sheet("S-01", group=None)
    with pytest.raises(ValueError, match="no group"):
        run(SetReading(sheets=(unstamped,), views=((),)), recognisers=READERS)


# run over the real Checks ------------------------------------------------------------------------------


def test_every_set_check_runs_in_code_order_on_one_reading() -> None:
    s1 = sheet("S-01", "Ground floor beams", storeys="GROUND FLOOR")
    s3 = sheet("S-03", "Notes")
    views = (
        (plan(["ground"], title="Ground floor beam layout", steps=("beams",))),
        view(ViewKind.NOTES),
    )
    reading = SetReading(
        sheets=(s1, s3),
        views=((views[0],), (views[1],)),
        plot=(PlotMatch(page=type("Page", (), {"number": 1})(), reason="no_sheet_matched"),),
        lists=(DrawingList("set", "structural", ListSource.TYPED, (ListEntry("S-01", 1),)),),
        read=frozenset({"views", "register", "plot", "conflicts"}),
        conventions=CONVENTIONS,
    )

    results = run(reading, recognisers=READERS)

    assert [(r.code, str(r.outcome), r.finding and r.finding["code"]) for r in results] == [
        ("coverage", "passed", None),
        ("coverage", "fired", "engine.coverage.unaccounted_untitled"),
        ("plot_pages", "fired", "engine.plot_pages.no_sheet"),
        ("register", "passed", None),
        ("register", "passed", None),
        ("register", "fired", "engine.register_check.not_listed"),
        ("storey_titles", "passed", None),
    ]


def test_the_harness_path_runs_with_13s_readers() -> None:
    """Part 2: `run_all` binds 13's readers to the reading's conventions."""
    assert run_all(SetReading()) == []
    coverage_only = SetReading(sheets=(sheet("S-01"),), views=((view(),),), read=frozenset({"views"}))
    assert [r.code for r in run_all(coverage_only)] == ["coverage"]
    numbered = SetReading(
        sheets=(sheet("S-01"), sheet("S-02"), sheet("S-05")),
        views=((), (), ()),
        read=frozenset({"register"}),
        conventions=CONVENTIONS,
    )
    gaps = [r.finding for r in run_all(numbered) if r.finding is not None]
    assert gaps == [
        {
            "code": "engine.register_check.gap",
            "params": {"after": "S-02", "before": "S-05", "missing": 2, "discipline": "structural"},
        }
    ]
    storeys = SetReading(
        sheets=(sheet("S-06", "Beams", storeys="3RD, 5TH & 7TH FLOOR"),),
        views=((plan(["floor_3", "floor_5", "floor_7"]),),),
        read=frozenset({"views"}),
        conventions=CONVENTIONS,
    )
    assert [(r.code, str(r.outcome)) for r in run_all(storeys) if r.code == "storey_titles"] == [
        ("storey_titles", "passed")
    ]


def test_the_harness_stage_is_run_all() -> None:
    assert catalogue.run_all.__name__ == "run_all"
    params: Any = catalogue.run_all.__code__.co_varnames[: catalogue.run_all.__code__.co_argcount]
    assert params == ("reading",)
