"""The scope check is a bare existence lookup: `in_scope` (and `projects.get` under it) never reads the
event log, which only grows. A Project's `updated_at` is worked out where it is sent (`detail`)."""

import uuid
from collections.abc import Callable

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from vextrus.drawings.services import _access
from vextrus.platform.services import tenancy
from vextrus.projects import services


def event_queries(ran: CaptureQueriesContext) -> list[str]:
    return [query["sql"] for query in ran if "platform_domainevent" in query["sql"]]


@pytest.mark.django_db
def test_the_scope_check_issues_no_event_query(make_developer: Callable[..., uuid.UUID]) -> None:
    developer = make_developer()
    with tenancy.acting_in(developer):
        project_id = services.create(code="KR-01", name="Kadam Residence").id
        with CaptureQueriesContext(connection) as ran:
            _access.in_scope(project_id)
            services.get(project_id)
        assert event_queries(ran) == []
        with CaptureQueriesContext(connection) as ran:
            detailed = services.detail(project_id)
        assert len(event_queries(ran)) == 1
        assert detailed.updated_at is not None
