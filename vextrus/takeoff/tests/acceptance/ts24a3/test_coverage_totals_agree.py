"""Ticket S24-A3's acceptance tests, the API half (G1 item M0-FL7; issues #664, #690): Coverage's two
"excluded" figures agree.

docs/design/m0-screens.md §6.11: a view is "**excluded** once its sheet or itself is excluded and
confirmed so, with the reason"; "proposed" while its sheet is a Proposal and it has a proposed step, Part
or exclusion. The Coverage panel shows the Coverage line ("Coverage 70 views: 0 assigned, 0 excluded, 68
proposed, 2 unaccounted") and, below it, "Excluded, by reason". #690: "'Excluded, by reason' … counts
proposed exclusions too, so its total disagrees with the Coverage line just above it … A QS sees two
'excluded' totals in one panel." The panel's words stay §6.11's, so `GET …/coverage`'s `by_reason`
(the counts under "Excluded, by reason") adds up to its `excluded`: a view proposed to be left out is
counted under "proposed" only.

Run on the demo seed's KR-01 (m0-screens §7: "Proposed excluded 26 … Status bar: Coverage 70 views: 0
assigned, 0 excluded, 68 proposed, 2 unaccounted") through t19a's fixtures.
"""

import uuid

import pytest

from vextrus.testing.auth import Api

from ..t19a.step1 import *  # noqa: F403 (its fixtures, which pytest finds by name)
from ..t19a.step1 import by_number, proposals, step1

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


def coverage(api: Api, project_id: uuid.UUID) -> dict[str, object]:
    response = api.get(f"{step1(project_id)}/coverage")
    assert response.status_code == 200, response.content
    body: dict[str, object] = response.json()
    return body


def by_reason_total(body: dict[str, object]) -> int:
    reasons = body["by_reason"]
    assert isinstance(reasons, dict)
    return sum(int(n) for n in reasons.values())


def test_on_the_seed_excluded_by_reason_adds_up_to_the_coverage_lines_0_excluded(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    body = coverage(nusrat, kr01)

    assert body["excluded"] == 0
    total = by_reason_total(body)
    assert total == body["excluded"], (
        f"Excluded, by reason adds up to {total} but the Coverage line says {body['excluded']} excluded"
    )


def test_once_a_sheet_is_confirmed_excluded_by_reason_adds_up_to_the_coverage_lines_excluded(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    # S-02's title block is proposed out (§7: "24 title blocks"); confirming S-02 confirms it out.
    [s02] = by_number(proposals(nusrat, kr01), "S-02")
    confirmed = nusrat.post(f"{step1(kr01)}/confirm", {"proposals": [s02["id"]]})
    assert confirmed.status_code == 200, confirmed.content

    body = coverage(nusrat, kr01)

    excluded = body["excluded"]
    assert isinstance(excluded, int)
    assert excluded > 0
    total = by_reason_total(body)
    assert total == excluded, (
        f"Excluded, by reason adds up to {total} but the Coverage line says {excluded} excluded"
    )


def test_the_proposed_figure_still_counts_the_views_proposed_to_be_left_out(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    # §7: 70 views, 68 proposed (26 of them proposed excluded), 2 unaccounted: nothing is lost.
    body = coverage(nusrat, kr01)

    counted = ("assigned", "excluded", "proposed", "unaccounted")
    assert sum(int(str(body[k])) for k in counted) == body["views"] == 70
    assert body["proposed"] == 68
