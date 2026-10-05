"""The group each Step 1 Proposal belongs to, as 19b reads the set (T-W334; the owner's rulings of
5 Oct 2026): the data T-W322's sheet list groups its rows by, carried on `step1.ProposalView`.

    groups.among(listed, viewed, file_groups, conventions)    # {sheet id: Group}, alone: absent

- **A continuation** (`engine.recognise.types.Continuation`): one title on consecutive numbers, or
  titles equal but for a member-mark range ("BEAM B1-B6 DETAILS", "BEAM B7-B12 DETAILS"). Every sheet
  of one run carries the run's id, its first sheet's id as text, and its title, the ranges joined
  ("BEAM B1-B12 DETAILS").
- **A series** (`engine.recognise.types.Series`): one title on several runs that draw different
  storeys, marks or members ("N sheets share this title"), no Question. Every sheet of one series
  carries its first sheet's id as text.

The sheets are compared exactly as the set's conflicts are (`proposals.as_compared`, then 19b's
`compare`), from the sheets and views `step1.proposals` has read already (one read of each). Decisions
are ignored: a group is what the drawings say, so a confirmed sheet stays in its run.
"""

import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace

from engine.recognise import conflicts as finder
from engine.recognise.types import Continuation, Series, SheetConventions
from vextrus.drawings import services as drawings


@dataclass(frozen=True)
class Group:
    """A sheet's groups: its continuation run's id and title, and its series' id (none: alone)."""

    continuation: str | None = None
    continuation_title: str | None = None
    series: str | None = None


ALONE = Group()


def among(
    listed: Sequence[drawings.SheetView],
    viewed: Sequence[Sequence[drawings.ViewView]],
    file_groups: Mapping[uuid.UUID, str],
    conventions: SheetConventions,
) -> dict[uuid.UUID, Group]:
    """Each listed sheet's groups (`viewed[i]` are `listed[i]`'s views; `file_groups` each file's
    group), by the printed sheet's id; a sheet in no group is absent."""
    from vextrus.takeoff.services.read_propose import proposals  # the read job's, where it is used

    if not listed:
        return {}
    sheets, views = proposals.as_compared(listed, viewed, file_groups)
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
