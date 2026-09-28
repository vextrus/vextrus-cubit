"""The run-to-run diff under the fixed matching (the M0 plan, "Run-to-run matching"), on the engine's
export as 06b writes it: exports made by 06b's harness (fixtures/), and invented ones for the
fine-grained cases.

Items join by where they are, never by what they say; each measure counts what was gained, lost and
changed. Positions (`{file, sheet[, view | register]}`, `{file, page}`) are only addresses inside one
export: they are mapped through the joins, so an item that moves to another position still joins.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from scripts.real_drawings.diff import MEASURES, compare, error_kind, failures, sizes
from scripts.real_drawings.schema import problems
from scripts.real_drawings.tests.exports import (
    SHA_A,
    SHA_B,
    SHA_PDF,
    check,
    dwg,
    export,
    match,
    page,
    pdf,
    process,
    ref,
    row,
    sheet,
    sourced,
    stage,
    view,
)

ROOT = Path(__file__).resolve().parents[3]
FIXTURES = Path(__file__).resolve().parent / "fixtures"
SCHEMA = json.loads((FIXTURES / "export.schema.json").read_text())
BOX = [0.0, 0.0, 100.0, 100.0]
NOTHING = {"gained": 0, "lost": 0, "changed": 0}


def fixture(name: str) -> dict[str, Any]:
    """An export 06b's harness wrote at 1807a644, inside this check's sandbox, on an invented set:
    `not-built` with no stage built; `fakes` with 06b's own fake stages at the stage table's targets;
    `fakes-moved` the same with one sheet per drawing and the plan view moved off its place."""
    return json.loads((FIXTURES / f"export-{name}.json").read_text())  # type: ignore[no-any-return]


def counts(old: dict[str, Any], new: dict[str, Any], measure: str) -> tuple[int, int, int]:
    found = compare(old, new).counts()[measure]
    return found["gained"], found["lost"], found["changed"]


# The harness's own exports ---------------------------------------------------------------------------


@pytest.mark.parametrize("name", ["not-built", "fakes", "fakes-moved"])
def test_the_harnesss_exports_conform_to_its_schema(name: str) -> None:
    assert problems(fixture(name), SCHEMA) == []
    main_schema = ROOT / "engine" / "export.schema.json"  # once 06b is merged: main's own
    if main_schema.exists():
        assert problems(fixture(name), json.loads(main_schema.read_text())) == []


@pytest.mark.parametrize("name", ["not-built", "fakes", "fakes-moved"])
def test_an_export_diffed_against_itself_reports_nothing(name: str) -> None:
    found = compare(fixture(name), fixture(name))

    assert found.counts() == dict.fromkeys(MEASURES, NOTHING)
    assert found.items == []


def test_a_lost_sheet_and_a_moved_view_are_reported_so() -> None:
    found = compare(fixture("fakes"), fixture("fakes-moved")).counts()

    # Each of the two drawings loses Layout2 (and its three views) and its plan view moves off its
    # place (lost there, gained where it went); the conflict that needed three sheets is lost, and
    # the continuation, now over the two drawings' first sheets, is lost and gained.
    assert found == dict.fromkeys(MEASURES, NOTHING) | {
        "sheets": {"gained": 0, "lost": 2, "changed": 0},
        "views": {"gained": 2, "lost": 8, "changed": 0},
        "conflicts": {"gained": 0, "lost": 1, "changed": 0},
        "continuations": {"gained": 1, "lost": 1, "changed": 0},
    }


def test_stages_not_built_give_empty_measures_never_a_crash() -> None:
    bare, full = fixture("not-built"), fixture("fakes")

    assert sizes(bare) == dict.fromkeys(MEASURES, 0) | {"files": 3}
    assert compare(bare, full).counts()["sheets"] == {"gained": 4, "lost": 0, "changed": 0}
    assert compare(full, bare).counts()["entity_counts"] == {"gained": 0, "lost": 4, "changed": 0}


def test_every_invented_export_here_has_the_engines_shape() -> None:
    document = export(
        dwg(SHA_A, sheet("L1", views=[view(BOX)], register=[row(BOX)], render_f1=0.9)),
        pdf(SHA_PDF),
        plot=[match(page(1, 1), ref(0, 0)), match(page(1, 2), None)],
        checks=[check("x", ref(0, 0, view=0), "fired", finding="engine.x.y", params={"n": 1})],
        conflicts=[{"kind": "same_number", "candidates": [ref(0, 0), ref(0, 0)], "evidence": {}}],
        continuations=[{"title": "Invented", "sheets": [ref(0, 0), ref(0, 0)]}],
    )

    assert problems(document, SCHEMA) == []


# The fixed matching, item by item --------------------------------------------------------------------


def test_sheets_join_by_layout_name_whatever_they_say() -> None:
    old = export(dwg(SHA_A, sheet("L1"), sheet("L2")))
    new = export(dwg(SHA_A, sheet("L1", number=sourced("X-102"), title=sourced("Another")), sheet("L3")))

    assert counts(old, new, "sheets") == (1, 1, 1)
    (changed,) = [c for c in compare(old, new).items if c.change == "changed"]
    assert set(changed.fields) == {"number", "title"}


def test_a_title_differing_only_in_case_whitespace_or_symbol_form_is_not_changed() -> None:
    def titled(text: str) -> dict[str, Any]:
        return export(dwg(SHA_A, sheet("L1", title=sourced(text))))

    old = titled("Column  Layout Ø16")

    assert counts(old, titled(" column\tlayout Ø16"), "sheets") == (0, 0, 0)
    assert counts(old, titled(chr(0xFF23) + "OLUMN LAYOUT Ø16"), "sheets") == (0, 0, 0)  # a full-width C
    assert counts(old, titled("Column Layout Ø20"), "sheets") == (0, 0, 1)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("number", sourced("X-102")),
        ("discipline", sourced("architectural", "file")),
        ("revision_mark", sourced("R1", "file_name")),
        ("revision_mark", sourced("R0", "title_block_attribute")),  # the mark's source
        ("issue_date", None),
        ("storeys_as_stated", sourced("first floor")),
    ],
)
def test_each_sheet_value_the_plan_names_counts_as_changed(field: str, value: object) -> None:
    changed: dict[str, Any] = {field: value}
    old = export(dwg(SHA_A, sheet("L1")))
    new = export(dwg(SHA_A, sheet("L1", **changed)))

    assert counts(old, new, "sheets") == (0, 0, 1)


def test_a_number_read_from_another_place_is_not_changed() -> None:
    old = export(dwg(SHA_A, sheet("L1")))
    new = export(dwg(SHA_A, sheet("L1", number=sourced("X-101", "title_block_attribute"))))

    assert counts(old, new, "sheets") == (0, 0, 0)


def test_model_space_sheets_join_by_frame_box_at_iou_09() -> None:
    old = export(dwg(SHA_A, sheet(box=[0, 0, 100, 100]), sheet(box=[500, 0, 600, 100])))
    new = export(
        dwg(
            SHA_A,
            sheet(box=[1, 1, 101, 101], title=sourced("Retitled")),  # IoU 0.96: joined
            sheet(box=[520, 0, 620, 100]),  # IoU 0.67: the other lost, this one gained
        )
    )

    assert counts(old, new, "sheets") == (1, 1, 1)


def test_sheets_never_join_across_files() -> None:
    old = export(dwg(SHA_A, sheet("L1")))
    new = export(dwg(SHA_A), dwg(SHA_B, sheet("L1")))

    assert counts(old, new, "sheets") == (1, 1, 0)
    assert counts(old, new, "files") == (1, 0, 0)


def test_views_join_inside_a_joined_sheet_at_iou_08() -> None:
    old = export(dwg(SHA_A, sheet("L1", views=[view([0, 0, 10, 10]), view([20, 0, 30, 10])])))
    new = export(
        dwg(
            SHA_A,
            sheet(
                "L1",
                views=[
                    view([0, 0, 10, 10.5], kind="section"),  # IoU 0.95: joined, kind changed
                    view([40, 0, 50, 10]),  # gained; the second old view lost
                ],
            ),
        )
    )

    assert counts(old, new, "views") == (1, 1, 1)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("kind", "section"),
        ("not_to_scale", True),
        ("stated_scale", "1:50"),
        ("storeys", ["first"]),
        ("storeys_meaning", "floor_to_floor"),
        ("subject", "beam"),
        ("layer", "bottom"),
        ("steps", ["beams"]),
        ("part", "electrical"),
        ("exclusion", {"reason": "duplicate", "text": None}),
        ("coverage", "excluded"),
    ],
)
def test_each_view_value_the_plan_names_counts_as_changed(field: str, value: object) -> None:
    changed: dict[str, Any] = {field: value}
    old = export(dwg(SHA_A, sheet("L1", views=[view(BOX)])))
    new = export(dwg(SHA_A, sheet("L1", views=[view(BOX, **changed)])))

    assert counts(old, new, "views") == (0, 0, 1)


def test_an_exclusions_text_alone_is_not_changed() -> None:
    old = export(dwg(SHA_A, sheet("L1", views=[view(BOX, exclusion={"reason": "other", "text": "a"})])))
    new = export(dwg(SHA_A, sheet("L1", views=[view(BOX, exclusion={"reason": "other", "text": "b"})])))

    assert counts(old, new, "views") == (0, 0, 0)


def test_the_views_of_a_lost_sheet_are_lost_with_it() -> None:
    old = export(dwg(SHA_A, sheet("L1", views=[view(BOX), view(BOX)], register=[row(BOX)])))
    new = export(dwg(SHA_A))

    assert counts(old, new, "sheets") == (0, 1, 0)
    assert counts(old, new, "views") == (0, 2, 0)
    assert counts(old, new, "register") == (0, 1, 0)


def test_register_entries_join_by_row_box_at_iou_08() -> None:
    old = export(dwg(SHA_A, sheet("L1", register=[row([0, 0, 100, 5]), row([0, 5, 100, 10])])))
    new = export(
        dwg(
            SHA_A,
            sheet("L1", register=[row([0, 0, 100, 5.2], revision_mark="R1"), row([0, 20, 100, 25])]),
        )
    )

    assert counts(old, new, "register") == (1, 1, 1)


def test_entity_counts_join_by_file_and_type() -> None:
    old = export(dwg(SHA_A, entity_counts={"LINE": 10, "ARC": 2, "MTEXT": 4}))
    new = export(dwg(SHA_A, entity_counts={"LINE": 11, "CIRCLE": 1, "MTEXT": 4}))

    assert counts(old, new, "entity_counts") == (1, 1, 1)


def test_font_pdf_and_bangla_counts_join_by_file_and_name() -> None:
    old = export(
        dwg(SHA_A, font_report={"missing": 0, "shx": 3}, pdf_report=None, bangla_ansi={"texts": 2})
    )
    new = export(
        dwg(SHA_A, font_report={"missing": 1}, pdf_report={"pages": 4}, bangla_ansi={"texts": 2})
    )

    assert counts(old, new, "report_counts") == (1, 1, 1)


def test_a_stage_not_built_is_null_and_its_counts_are_empty() -> None:
    built = export(dwg(SHA_A))
    unbuilt = export(
        dwg(SHA_A, entity_counts=None, font_report=None, bangla_ansi=None, decoders_agree=None)
    )

    assert counts(built, unbuilt, "entity_counts") == (0, 2, 0)
    assert counts(built, unbuilt, "report_counts") == (0, 2, 0)
    assert counts(built, unbuilt, "files") == (0, 0, 1)  # decoders agree: True, then null


def test_decoders_agree_is_a_file_value() -> None:
    old = export(dwg(SHA_A), dwg(SHA_B))
    new = export(dwg(SHA_A, decoders_agree=False), dwg("d" * 64))

    assert counts(old, new, "files") == (1, 1, 1)


def test_plot_matches_join_by_pdf_and_page_and_compare_the_joined_sheet() -> None:
    old = export(
        dwg(SHA_A, sheet("L1"), sheet("L2")),
        pdf(SHA_PDF),
        plot=[match(page(1, 1), ref(0, 0)), match(page(1, 2), ref(0, 1)), match(page(1, 3), None)],
    )
    new = export(
        pdf(SHA_PDF),  # the files in another order: positions differ, joins do not
        dwg(SHA_A, sheet("L0"), sheet("L1"), sheet("L2")),
        plot=[match(page(0, 1), ref(1, 1)), match(page(0, 2), ref(1, 1)), match(page(0, 4), ref(1, 2))],
    )

    assert counts(old, new, "plot_matches") == (1, 1, 1)  # page 4 gained, 3 lost, 2 moved to L1


def test_render_f1_moves_past_0005_to_change_and_falls_past_001_to_be_lost() -> None:
    def run(*f1: float | None) -> dict[str, Any]:
        return export(dwg(SHA_A, *[sheet(f"L{i}", render_f1=v) for i, v in enumerate(f1)]))

    old = run(0.900, 0.900, 0.900, None, 0.900)
    new = run(0.904, 0.906, 0.880, 0.800, None)  # still, changed, lost, gained, lost

    assert counts(old, new, "render_f1") == (1, 2, 1)
    assert counts(old, new, "sheets") == (0, 0, 0)


def test_checks_join_by_code_and_the_joined_subject_wherever_it_moved() -> None:
    old = export(
        dwg(SHA_A, sheet("L1", views=[view(BOX)]), sheet("L2")),
        pdf(SHA_PDF),
        checks=[
            check("coverage", ref(0, 0, view=0)),
            check("title_block", ref(0, 1)),
            check("numbering", None),
            check("plot_pages", page(1, 1)),
            check("decoders", ref(0, 1)),
        ],
    )
    new = export(
        pdf(SHA_PDF),
        dwg(SHA_A, sheet("L0"), sheet("L1", views=[view(BOX)]), sheet("L2")),  # L1 and L2 shifted
        checks=[
            check("coverage", ref(1, 1, view=0)),  # the same view: joined
            check("title_block", ref(1, 2), "fired", finding="engine.title_block.no_number"),  # changed
            check("numbering", None),
            check("plot_pages", page(0, 1)),
            check("bangla", ref(1, 2)),  # gained; "decoders" lost
        ],
    )

    assert counts(old, new, "checks") == (1, 1, 1)


def test_a_check_findings_parameters_moving_is_changed() -> None:
    def run(n: int) -> dict[str, Any]:
        return export(
            dwg(SHA_A, sheet("L1")),
            checks=[check("x", ref(0, 0), "fired", finding="engine.x.n", params={"n": n})],
        )

    assert counts(run(1), run(2), "checks") == (0, 0, 1)


def test_a_check_on_a_lost_sheet_is_lost_with_it() -> None:
    old = export(
        dwg(SHA_A, sheet("L1"), sheet("L2")), checks=[check("x", ref(0, 0)), check("x", ref(0, 1))]
    )
    new = export(dwg(SHA_A, sheet("L1")), checks=[check("x", ref(0, 0))])

    assert counts(old, new, "checks") == (0, 1, 0)


def test_conflicts_join_by_kind_and_joined_candidates() -> None:
    def conflict(kind: str, at: list[dict[str, Any]], evidence: str) -> dict[str, Any]:
        return {"kind": kind, "candidates": at, "evidence": {"why": evidence}}

    old = export(
        dwg(SHA_A, *[sheet(f"L{i}") for i in range(4)]),
        conflicts=[
            conflict("same_number", [ref(0, 0), ref(0, 1)], "a"),
            conflict("same_number", [ref(0, 2), ref(0, 3)], "a"),
        ],
    )
    new = export(
        dwg(SHA_A, sheet("L9"), *[sheet(f"L{i}") for i in range(4)]),  # every sheet one place on
        conflicts=[
            conflict("same_number", [ref(0, 2), ref(0, 1)], "b"),  # the first, its evidence changed
            conflict("storey_twice", [ref(0, 3), ref(0, 4)], "a"),  # gained; the second lost
        ],
    )

    assert counts(old, new, "conflicts") == (1, 1, 1)


def test_continuations_join_by_their_joined_sheets() -> None:
    sheets = [sheet(f"L{i}") for i in range(3)]
    old = export(dwg(SHA_A, *sheets), continuations=[{"title": "A", "sheets": [ref(0, 0), ref(0, 1)]}])
    new = export(dwg(SHA_A, *sheets), continuations=[{"title": "A", "sheets": [ref(0, 1), ref(0, 2)]}])

    assert counts(old, new, "continuations") == (1, 1, 0)


def test_read_time_and_peak_memory_are_shown_never_counted() -> None:
    old = export(dwg(SHA_A, process=process(1.0, 100)))
    new = export(dwg(SHA_A, process=process(9.0, 900)))

    found = compare(old, new)

    assert all(sum(c.values()) == 0 for c in found.counts().values())
    assert found.timings == [(SHA_A, 1.0, 9.0, 100, 900)]


def test_two_copies_of_one_file_join_by_their_paths() -> None:
    old = export(dwg(SHA_A, sheet("L1")), dwg(SHA_A, path="copy.dwg"))
    new = export(dwg(SHA_A, path="copy.dwg"), dwg(SHA_A, sheet("L1")))

    assert compare(old, new).counts() == dict.fromkeys(MEASURES, NOTHING)


# Stages that failed ------------------------------------------------------------------------------------

SANDBOX = "SandboxUnavailable: bwrap: Failed to mount tmpfs: the drawing A-201's words"


def failing(*shas: str, **stages: dict[str, Any]) -> dict[str, Any]:
    return export(*[dwg(sha, stages=dict(stages)) for sha in shas])


def test_a_stage_failed_on_the_head_where_main_had_it_ok_is_lost() -> None:
    ok, failed = (
        failing(SHA_A, SHA_B, read=stage()),
        failing(SHA_A, SHA_B, read=stage("failed", SANDBOX)),
    )

    assert counts(ok, failed, "failed_stages") == (0, 2, 0)
    assert counts(failed, ok, "failed_stages") == (2, 0, 0)
    assert counts(failed, failed, "failed_stages") == (0, 0, 0)


def test_a_stage_newly_built_that_fails_is_lost_too() -> None:
    unbuilt = failing(SHA_A, read=stage("not_built", "no module engine.read"))
    failed = failing(SHA_A, read=stage("failed", SANDBOX))

    assert counts(unbuilt, failed, "failed_stages") == (0, 1, 0)


def test_a_stage_failing_another_way_is_changed() -> None:
    before = failing(SHA_A, read=stage("failed", SANDBOX))
    after = failing(SHA_A, read=stage("failed", "RuntimeError: another"))

    assert counts(before, after, "failed_stages") == (0, 0, 1)


def test_a_set_stage_that_fails_is_counted_once_for_the_set() -> None:
    ok, failed = export(dwg(SHA_A)), export(dwg(SHA_A))
    ok["set_stages"] = {"checks": stage()}
    failed["set_stages"] = {"checks": stage("failed", "TypeError: bad")}

    assert counts(ok, failed, "failed_stages") == (0, 1, 0)


def test_failures_name_the_stage_the_file_count_and_the_error_kind_never_its_message() -> None:
    document = failing(SHA_A, SHA_B, read=stage("failed", SANDBOX))
    document["files"].append(
        dwg("d" * 64, stages={"read": stage("failed", "it returned str, not a list")})
    )
    document["set_stages"] = {"checks": stage("failed", "TypeError: a title from a drawing")}

    assert failures(document) == {
        ("read", "SandboxUnavailable"): 2,
        ("read", "broke its contract"): 1,
        ("set checks", "TypeError"): 1,
    }


@pytest.mark.parametrize(
    ("error", "kind"),
    [
        ("SandboxUnavailable: bwrap: Failed to mount tmpfs", "SandboxUnavailable"),
        ("engine.read.errors.ReadError: the words of a drawing", "engine.read.errors.ReadError"),
        ("MemoryError", "MemoryError"),
        ("it returned str, not a list of SheetCandidate", "broke its contract"),
        ("the file's process ended during this stage (killed by signal 9)", "process ended"),
        ("A-201 Column Layout: something", "other"),
        (None, "unknown"),
    ],
)
def test_the_error_kind_is_a_class_name_or_a_fixed_word(error: str | None, kind: str) -> None:
    assert error_kind(error) == kind
