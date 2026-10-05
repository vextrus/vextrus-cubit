"""The group each Step 1 Proposal belongs to, as 19b reads the set (T-W334; the owner's rulings of
5 Oct 2026): the data T-W322's sheet list groups its rows by.

    groups.of(project_id)    # {sheet id: Group}, a sheet in no group absent

- **A continuation** (`engine.recognise.types.Continuation`): one title on consecutive numbers, or
  titles equal but for a member-mark range ("BEAM B1-B6 DETAILS", "BEAM B7-B12 DETAILS"). Every sheet
  of one run carries the run's id, its first sheet's id as text, and its title, the ranges joined
  ("BEAM B1-B12 DETAILS").
- **A series** (`engine.recognise.types.Series`): one title on several runs that draw different
  storeys, marks or members ("N sheets share this title"), no Question. Every sheet of one series
  carries its first sheet's id as text.

The sheets are compared exactly as the set's conflicts are (`proposals.compared_set`, then 19b's
`compare`). Decisions are ignored: a group is what the drawings say, so a confirmed sheet stays in its
run.
"""

import uuid
from dataclasses import dataclass, replace

from engine.recognise import conflicts as finder
from engine.recognise.types import Continuation, Series


@dataclass(frozen=True)
class Group:
    """A sheet's groups: its continuation run's id and title, and its series' id (none: alone)."""

    continuation: str | None = None
    continuation_title: str | None = None
    series: str | None = None


ALONE = Group()


def of(project_id: uuid.UUID) -> dict[uuid.UUID, Group]:
    """Each listed sheet's groups, by the printed sheet's id; a sheet in no group is absent."""
    from vextrus.takeoff.services.read_propose import proposals  # the read job's, where it is used

    listed, sheets, views, conventions = proposals.compared_set(project_id)
    if not listed:
        return {}
    found = finder.compare(
        sheets, views, conventions=conventions, recognisers=finder.recognisers(conventions)
    )
    at = {id(sheet): i for i, sheet in enumerate(sheets)}
    grouped: dict[uuid.UUID, Group] = {}
    for group in found:
        if not isinstance(group, Continuation | Series):
            continue
        ids = [listed[at[id(sheet)]].id for sheet in group.sheets]
        for sheet_id in ids:
            was = grouped.get(sheet_id, ALONE)
            if isinstance(group, Continuation):
                grouped[sheet_id] = replace(
                    was, continuation=str(ids[0]), continuation_title=group.title
                )
            else:
                grouped[sheet_id] = replace(was, series=str(ids[0]))
    return grouped
