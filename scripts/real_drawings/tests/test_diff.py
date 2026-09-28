"""The run-to-run diff under the fixed matching (the M0 plan, "Run-to-run matching"), on invented
exports.

Items join by where they are, never by what they say; each measure counts what was gained, lost and
changed. Every joined kind is shown gaining, losing and changing an item, except a continuation, for
which the plan names no changed value.
"""

from typing import Any

import pytest

from scripts.real_drawings.diff import MEASURES, compare, sizes
from scripts.real_drawings.tests.exports import (
    SHA_A,
    SHA_B,
    SHA_PDF,
    dwg,
    export,
    pdf,
    row,
    sheet,
    view,
)

BOX = [0.0, 0.0, 100.0, 100.0]


def counts(old: dict[str, Any], new: dict[str, Any], measure: str) -> tuple[int, int, int]:
    found = compare(old, new).counts()[measure]
    return found["gained"], found["lost"], found["changed"]


def test_identical_runs_change_nothing() -> None:
    run = export(dwg(SHA_A, sheet("s1", layout="L1", views=[view("v1", BOX)], register=[row(BOX)])))

    assert compare(run, run).counts() == {m: {"gained": 0, "lost": 0, "changed": 0} for m in MEASURES}


def test_sheets_join_by_layout_name_whatever_they_say() -> None:
    old = export(dwg(SHA_A, sheet("s1", layout="L1"), sheet("s2", layout="L2")))
    new = export(
        dwg(SHA_A, sheet("n1", layout="L1", number="X-102", title="Another"), sheet("n3", layout="L3"))
    )

    assert counts(old, new, "sheets") == (1, 1, 1)
    (changed,) = [c for c in compare(old, new).items if c.change == "changed"]
    assert set(changed.fields) == {"number", "title"}


def test_a_title_differing_only_in_case_whitespace_or_symbol_form_is_not_changed() -> None:
    old = export(dwg(SHA_A, sheet("s1", layout="L1", title="Column  Layout Ø16")))
    new = export(dwg(SHA_A, sheet("s1", layout="L1", title=" column\tlayout Ø16")))
    full_width = export(
        dwg(SHA_A, sheet("s1", layout="L1", title="\uff23OLUMN LAYOUT Ø16"))
    )  # full-width C
    other = export(dwg(SHA_A, sheet("s1", layout="L1", title="Column Layout Ø20")))

    assert counts(old, new, "sheets") == (0, 0, 0)
    assert counts(old, full_width, "sheets") == (0, 0, 0)
    assert counts(old, other, "sheets") == (0, 0, 1)


@pytest.mark.parametrize(
    "field",
    [
        "number",
        "discipline",
        "revision_mark",
        "revision_mark_source",
        "issue_date",
        "storeys",
        "storeys_meaning",
    ],
)
def test_each_sheet_value_the_plan_names_counts_as_changed(field: str) -> None:
    old = export(dwg(SHA_A, sheet("s1", layout="L1")))
    changed: dict[str, Any] = {field: ["other"]}
    new = export(dwg(SHA_A, sheet("s1", layout="L1", **changed)))

    assert counts(old, new, "sheets") == (0, 0, 1)


def test_model_space_sheets_join_by_frame_box_at_iou_09() -> None:
    old = export(dwg(SHA_A, sheet("s1", box=[0, 0, 100, 100]), sheet("s2", box=[500, 0, 600, 100])))
    new = export(
        dwg(
            SHA_A,
            sheet("n1", box=[1, 1, 101, 101], title="Retitled"),  # IoU 0.96: joined
            sheet("n2", box=[520, 0, 620, 100]),  # IoU 0.67: s2 lost, n2 gained
        )
    )

    assert counts(old, new, "sheets") == (1, 1, 1)


def test_sheets_never_join_across_files() -> None:
    old = export(dwg(SHA_A, sheet("s1", layout="L1")))
    new = export(dwg(SHA_A), dwg(SHA_B, sheet("s1", layout="L1")))

    assert counts(old, new, "sheets") == (1, 1, 0)
    assert counts(old, new, "files") == (1, 0, 0)


def test_views_join_inside_a_joined_sheet_at_iou_08() -> None:
    old = export(
        dwg(
            SHA_A,
            sheet("s1", layout="L1", views=[view("v1", [0, 0, 10, 10]), view("v2", [20, 0, 30, 10])]),
        )
    )
    new = export(
        dwg(
            SHA_A,
            sheet(
                "s1",
                layout="L1",
                views=[
                    view("w1", [0, 0, 10, 10.5], kind="section"),  # IoU 0.95: joined, kind changed
                    view("w3", [40, 0, 50, 10]),  # gained; v2 lost
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
        ("storeys_meaning", "range"),
        ("subject", "beam"),
        ("layer", "bottom"),
        ("proposed_steps", ["beams"]),
        ("part", "electrical"),
        ("exclusion_reason", "duplicate"),
        ("coverage", "excluded"),
    ],
)
def test_each_view_value_the_plan_names_counts_as_changed(field: str, value: object) -> None:
    old = export(dwg(SHA_A, sheet("s1", layout="L1", views=[view("v1", BOX)])))
    new = export(dwg(SHA_A, sheet("s1", layout="L1", views=[view("v1", BOX, **{field: value})])))

    assert counts(old, new, "views") == (0, 0, 1)


def test_the_views_of_a_lost_sheet_are_lost_with_it() -> None:
    old = export(dwg(SHA_A, sheet("s1", layout="L1", views=[view("v1", BOX), view("v2", BOX)])))
    new = export(dwg(SHA_A))

    assert counts(old, new, "sheets") == (0, 1, 0)
    assert counts(old, new, "views") == (0, 2, 0)


def test_register_entries_join_by_row_box_at_iou_08() -> None:
    old = export(
        dwg(SHA_A, sheet("s1", layout="L1", register=[row([0, 0, 100, 5]), row([0, 5, 100, 10])]))
    )
    new = export(
        dwg(
            SHA_A,
            sheet(
                "s1",
                layout="L1",
                register=[row([0, 0, 100, 5.2], revision_mark="R1"), row([0, 20, 100, 25])],
            ),
        )
    )

    assert counts(old, new, "register") == (1, 1, 1)


def test_entity_counts_join_by_file_and_type() -> None:
    old = export(dwg(SHA_A, entity_counts={"LINE": 10, "ARC": 2, "MTEXT": 4}))
    new = export(dwg(SHA_A, entity_counts={"LINE": 11, "CIRCLE": 1, "MTEXT": 4}))

    assert counts(old, new, "entity_counts") == (1, 1, 1)


def test_font_pdf_and_bangla_counts_join_by_file_and_name() -> None:
    old = export(dwg(SHA_A, font_report={"missing": 0, "shx": 3}, pdf_report={}, bangla_ansi=2))
    new = export(dwg(SHA_A, font_report={"missing": 1}, pdf_report={"pages": 4}, bangla_ansi=2))

    assert counts(old, new, "report_counts") == (1, 1, 1)


def test_decoders_agree_is_a_file_value() -> None:
    old = export(dwg(SHA_A), dwg(SHA_B))
    new = export(dwg(SHA_A, decoders_agree=False), dwg("d" * 64))

    assert counts(old, new, "files") == (1, 1, 1)


def test_plot_matches_join_by_pdf_and_page_and_compare_the_joined_sheet() -> None:
    old = export(
        dwg(SHA_A, sheet("s1", layout="L1"), sheet("s2", layout="L2")),
        pdf(SHA_PDF, {"page": 1, "sheet": "s1"}, {"page": 2, "sheet": "s2"}, {"page": 3, "sheet": None}),
    )
    new = export(
        dwg(SHA_A, sheet("n1", layout="L1"), sheet("n2", layout="L2")),
        pdf(SHA_PDF, {"page": 1, "sheet": "n1"}, {"page": 2, "sheet": "n1"}, {"page": 4, "sheet": "n2"}),
    )

    assert counts(old, new, "plot_matches") == (1, 1, 1)  # page 4 gained, 3 lost, 2 moved


def test_render_f1_moves_past_0005_to_change_and_falls_past_001_to_be_lost() -> None:
    def run(*f1: float | None) -> dict[str, Any]:
        return export(
            dwg(SHA_A, *[sheet(f"s{i}", layout=f"L{i}", render_f1=v) for i, v in enumerate(f1)])
        )

    old = run(0.900, 0.900, 0.900, None, 0.900)
    new = run(0.904, 0.906, 0.880, 0.800, None)  # still, changed, lost, gained, lost

    assert counts(old, new, "render_f1") == (1, 2, 1)
    assert counts(old, new, "sheets") == (0, 0, 0)


def test_checks_join_by_code_and_joined_subject() -> None:
    old = export(
        dwg(SHA_A, sheet("s1", layout="L1"), sheet("s2", layout="L2")),
        checks=[
            {"code": "title_block", "subject": "s1", "outcome": "pass", "finding": None},
            {"code": "title_block", "subject": "s2", "outcome": "pass", "finding": None},
            {"code": "decoders_agree", "subject": SHA_A, "outcome": "pass", "finding": None},
        ],
    )
    new = export(
        dwg(SHA_A, sheet("n1", layout="L1"), sheet("n2", layout="L2")),
        checks=[
            {"code": "title_block", "subject": "n1", "outcome": "pass", "finding": None},  # same
            {
                "code": "title_block",
                "subject": "n2",
                "outcome": "finding",
                "finding": {"code": "title_block.missing_number", "params": {}},
            },
            {"code": "bangla_ansi", "subject": SHA_A, "outcome": "pass", "finding": None},
        ],
    )

    assert counts(old, new, "checks") == (1, 1, 1)


def test_a_check_finding_whose_parameters_move_is_changed() -> None:
    def run(n: int) -> dict[str, Any]:
        finding = {"code": "x.count", "params": {"n": n}}
        return export(
            dwg(SHA_A, sheet("s1", layout="L1")),
            checks=[{"code": "x", "subject": "s1", "outcome": "finding", "finding": finding}],
        )

    assert counts(run(1), run(2), "checks") == (0, 0, 1)


def test_conflicts_join_by_kind_and_joined_candidates() -> None:
    def conflict(kind: str, ids: list[str], evidence: str) -> dict[str, Any]:
        return {"kind": kind, "candidates": ids, "evidence": {"why": evidence}}

    sheets = [sheet(f"s{i}", layout=f"L{i}") for i in range(4)]
    renamed = [sheet(f"n{i}", layout=f"L{i}") for i in range(4)]
    old = export(
        dwg(SHA_A, *sheets),
        conflicts=[
            conflict("same_number", ["s0", "s1"], "a"),
            conflict("same_number", ["s2", "s3"], "a"),
        ],
    )
    new = export(
        dwg(SHA_A, *renamed),
        conflicts=[
            conflict("same_number", ["n1", "n0"], "b"),
            conflict("storey_twice", ["n2", "n3"], "a"),
        ],
    )

    assert counts(old, new, "conflicts") == (1, 1, 1)


def test_continuations_join_by_their_joined_sheets() -> None:
    sheets = [sheet(f"s{i}", layout=f"L{i}") for i in range(3)]
    old = export(dwg(SHA_A, *sheets), continuations=[{"sheets": ["s0", "s1"]}])
    new = export(dwg(SHA_A, *sheets), continuations=[{"sheets": ["s1", "s2"]}])

    assert counts(old, new, "continuations") == (1, 1, 0)


def test_read_time_and_peak_memory_are_shown_never_counted() -> None:
    old = export(dwg(SHA_A, read_seconds=1.0, peak_rss=100))
    new = export(dwg(SHA_A, read_seconds=9.0, peak_rss=900))

    found = compare(old, new)

    assert all(sum(c.values()) == 0 for c in found.counts().values())
    assert found.timings == [(SHA_A, 1.0, 9.0, 100, 900)]


def test_a_stage_not_built_leaves_its_measure_empty_in_both_runs() -> None:
    bare = {"files": [{"sha256": SHA_A, "entity_counts": {"LINE": 1}}]}

    assert compare(bare, bare).counts()["sheets"] == {"gained": 0, "lost": 0, "changed": 0}
    assert sizes(bare)["sheets"] == 0
    assert sizes(bare)["entity_counts"] == 1


def test_a_check_on_a_file_joins_by_the_file_and_is_lost_with_it() -> None:
    check = {"code": "decoders_agree", "outcome": "pass", "finding": None}
    old = export(dwg(SHA_A), dwg(SHA_B), checks=[check | {"subject": SHA_A}, check | {"subject": SHA_B}])
    new = export(dwg(SHA_A), checks=[check | {"subject": SHA_A}])

    assert counts(old, new, "checks") == (0, 1, 0)
