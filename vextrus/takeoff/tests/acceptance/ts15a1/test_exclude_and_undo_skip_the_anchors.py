"""Exclude and undo read printed Sheets without their anchors, as confirm does (#424: "exclude and
undo still read them"; T-W319 pinned confirm and the lists). The anchors are heavy JSON no Step 1
act uses. On T-W319's invented Project (`tw319.cost`), over HTTP as the screen acts."""

import pytest

from vextrus.testing.drawings import QsProject

from ..tw319.cost import ACTED_ON, SMALL, project_of
from .acts import OverHttp, captured, selecting_anchors

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


def test_excluding_a_printed_sheet_never_selects_the_anchors(qs_project: QsProject) -> None:
    project = project_of(qs_project, SMALL)
    way = OverHttp(project)

    with captured() as seen:
        way.exclude([project.proposal_of[ACTED_ON]])

    loading = selecting_anchors(seen)
    assert seen
    assert loading == [], f"{len(loading)} statements select the anchors: {loading[0][:160]}"


def test_undoing_a_confirm_never_selects_the_anchors(qs_project: QsProject) -> None:
    project = project_of(qs_project, SMALL)
    way = OverHttp(project)
    way.confirm([project.proposal_of[ACTED_ON]])

    with captured() as seen:
        way.undo()

    loading = selecting_anchors(seen)
    assert seen
    assert loading == [], f"{len(loading)} statements select the anchors: {loading[0][:160]}"


def test_undoing_an_exclude_never_selects_the_anchors(qs_project: QsProject) -> None:
    project = project_of(qs_project, SMALL)
    way = OverHttp(project)
    way.exclude([project.proposal_of[ACTED_ON]])

    with captured() as seen:
        way.undo()

    loading = selecting_anchors(seen)
    assert seen
    assert loading == [], f"{len(loading)} statements select the anchors: {loading[0][:160]}"
