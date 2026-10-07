"""The HTTP route's conflict check reads nothing of the set the act did not (S15-A1: "Each act reads
the set once"; discovery: the route's `set_conflicts` re-read every Sheet and every Sheet's Views
after the act had read them). So an act over HTTP reads the set's Sheets and Views as often as the
same act through the step1 service alone, on two invented Projects alike (`tw319.cost`)."""

import pytest

from vextrus.testing.drawings import QsProject

from ..tw319.cost import SMALL, project_of
from .acts import ACT_NAMES, ACTS, Act, OverHttp, ThroughTheService, measured, set_reads

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


@pytest.mark.parametrize("act", ACTS, ids=ACT_NAMES)
def test_an_act_over_http_reads_the_set_no_more_than_the_act_alone(
    qs_project: QsProject, act: Act
) -> None:
    over_http = project_of(qs_project, SMALL)
    alone = project_of(qs_project, SMALL)
    sheets = len(over_http.sheet_of)

    route = set_reads(measured(over_http, OverHttp(over_http), act), sheets)
    service = set_reads(measured(alone, ThroughTheService(alone), act), sheets)

    assert route == service, f"the route reads the set again: {route} over HTTP, {service} in the act"
