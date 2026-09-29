"""Fixtures for a Takeoff at Step 1 (ticket 19a): a QS's Project with one structural file read, its
printed sheets proposed and their Coverage written, as 21c's read job will leave them."""

import uuid
from dataclasses import dataclass

import pytest

from vextrus.drawings import services as drawings
from vextrus.takeoff.services import step1
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.tenancy import Member


@dataclass(frozen=True)
class Step1Project:
    member: Member
    project_id: uuid.UUID
    sheets: tuple[uuid.UUID, ...]
    """The printed sheets' ids, in the sheet list's order (S-01, S-02, S-03)."""
    proposals: tuple[uuid.UUID, ...]
    """Their Proposals' ids, in the same order."""


@pytest.fixture
def step1_project(qs_project: QsProject) -> Step1Project:
    member = qs_project.member
    structural = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, structural.id, ["S-01", "S-02", "S-03"])
    with member.acting():
        drawing_set = drawings.set_of(qs_project.project_id)
        assert drawing_set is not None
        sheets = [s.id for s in drawings.sheets(drawing_set.id)]
        proposals = [step1.propose_sheet(sheet_id) for sheet_id in sheets]
        for sheet_id in sheets:
            step1.record_coverage(sheet_id)
    return Step1Project(member, qs_project.project_id, tuple(sheets), tuple(proposals))
