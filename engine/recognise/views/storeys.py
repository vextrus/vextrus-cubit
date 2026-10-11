"""A view's storeys (17; S15-E3's part): one owner of what a plan's title, the lines under it and its
sheet's title state, by 13's storey words. Reads words only: never paper nor a drawing.

**The storey words are the sheet conventions'** given to `views.find` (`sheet_conventions`: the
Market's, as data), else the default sheet conventions; every reading below uses the same words.

**Its own title.** A plan's storeys are 13's `storeys.read(title, plan_title=True)`: an explicit list
(and the symbolic end a range runs to), so "typical" is a storey only beside a floor or plan word.
They mean the floors' levels (`at_floor_level`) unless its subject is one drawn floor to floor
(`FLOOR_TO_FLOOR`), its sheet is Architectural and its subject is not a slab's or a beam's (`AT_FLOOR`;
m0-screens 6.8: architectural plans are "floor to floor", S22-FL5), or its title puts them at ceiling
level (below). A view of another kind, or with
no title, has none.

**A line under its title** (#413; S19-B5): a plan whose own title states no storey takes the storeys
of the first line under that title which holds storey words only, read whole: bracketed whole ("(2ND
TO 6TH FLOOR)"), or bare under the scale note ("7TH TO 11TH FLOOR"); not "(SEE 3RD FLOOR PLAN)" nor
"REFER 6TH FLOOR PLAN", a reference, not "7TH TO 11TH FLOORS ONLY" nor a misspelt word, which 13's
reader reads only in part, and not a line holding a bracket it does not close whole ("(1ST FLOOR) AND
(TYP.)", "(2ND TO 6TH FLOOR"). The storeys are stated as the line states them and recorded as read
from that line (`StoreysSource.TITLE_LINE`). Such a plan names only a room or a part ("TOILET LAYOUT
PLAN") and gives its floors in the line, or carries a copied title block whose storeys the line
corrects: `conflicts`' `same_storey` leaves it out (each bath is a different room). A line naming no
storey ("SCALE 1:50") gives none, and a title's own storeys (a "typical" too) are never replaced.

**At ceiling level** (S19-B5): a plan whose own title names a `ceiling_level_words` phrase ("PIPE
LAYOUT AT 2ND FLOOR CEILING LEVEL") draws what hangs under its storeys' ceilings, whichever way its
storeys are read (`StoreysMeaning.AT_CEILING_LEVEL`): a drawing apart from the plan of those storeys
at floor level.

**Its sheet's title** (T-W318; the owner's ruling of 5 Oct 2026 on #318): a sheet's only plan that
still states no storey takes the storeys its sheet's title states (13's `storeys_as_stated`, read the
same way), recorded as read from the sheet's title (`StoreysSource.SHEET_TITLE`); their meaning is
decided by its own subject, else by the sheet title's when it names exactly one, and its own subject is
left as read. A sheet of two or more plans gives none of them its title's storeys (a plan that states
none stays `not_stated`), and no view of another kind takes any.
"""

from collections.abc import Sequence
from dataclasses import dataclass, replace

from engine.recognise import sheets as sheet_finder
from engine.recognise import storeys as storey_reader  # 13's; this part has its name
from engine.recognise.types import (
    SheetCandidate,
    SheetConventions,
    StoreysMeaning,
    StoreysSource,
    ViewCandidate,
    ViewKind,
)
from engine.recognise.views.titles import _tokens as title_words

FLOOR_TO_FLOOR = frozenset({"column", "shear_wall"})
"""Subjects whose storeys run floor to floor (a column from the 1st to the 10th floor)."""
ARCHITECTURAL = "architectural"
"""The Discipline whose plans are drawn floor to floor (m0-screens 6.8), but those of `AT_FLOOR`."""
AT_FLOOR = frozenset({"slab", "beam"})
"""Subjects an Architectural plan draws at its floor's level (a slab outline, a beam or lintel layout)."""

STATES_NONE = ((), ("not_stated",))
"""A plan's storeys when its own title states none: no title, or one naming no storey."""

_BRACKETS = {"(": ")", "[": "]"}


@dataclass(frozen=True)
class ViewStoreys:
    """A view's storeys: their keys in order, as stated, what they mean and where they were read
    (none: its own title)."""

    keys: tuple[str, ...] = ()
    as_stated: str | None = None
    meaning: StoreysMeaning | None = None
    source: StoreysSource | None = None


def words(conventions: SheetConventions | None) -> SheetConventions:
    """The sheet conventions whose storey words are read: those given, else the default."""
    return conventions if conventions is not None else sheet_finder.default_conventions()


def at_ceiling_level(title: str | None, conventions: SheetConventions | None = None) -> bool:
    """Whether a plan's title names a ceiling level phrase (the sheet conventions'
    `ceiling_level_words`), its words whole and in order."""
    if not title:
        return False
    said = title_words(title)
    for phrase in words(conventions).ceiling_level_words:
        wanted = title_words(phrase)
        n = len(wanted)
        if n and any(said[i : i + n] == wanted for i in range(len(said) - n + 1)):
            return True
    return False


def _meaning(
    subject: str | None,
    title: str | None = None,
    conventions: SheetConventions | None = None,
    discipline: str | None = None,
) -> StoreysMeaning:
    """What a plan's storeys mean: at ceiling level when its title names a ceiling level; floor to
    floor for a column or shear-wall subject, and for an Architectural plan of any subject but a
    slab's or a beam's (m0-screens 6.8); else at floor level."""
    if at_ceiling_level(title, conventions):
        return StoreysMeaning.AT_CEILING_LEVEL
    if subject in FLOOR_TO_FLOOR or (discipline == ARCHITECTURAL and subject not in AT_FLOOR):
        return StoreysMeaning.FLOOR_TO_FLOOR
    return StoreysMeaning.AT_FLOOR_LEVEL


def _keys(found: storey_reader.Storeys) -> tuple[str, ...]:
    return tuple(dict.fromkeys((*found.keys, *([found.runs_to] if found.runs_to else []))))


def _inside(line: str) -> str | None:
    """The words a line under a title gives to be read whole: those inside a line bracketed whole, its
    brackets once ("(2ND TO 6TH FLOOR)"), or a bare line as it stands ("7TH TO 11TH FLOOR"); none for
    a line holding any other bracket ("(1ST FLOOR) AND (TYP.)", "(2ND TO 6TH FLOOR")."""
    text = " ".join(line.split())
    if len(text) > 2 and _BRACKETS.get(text[0]) == text[-1]:
        text = text[1:-1].strip()
    return None if not text or any(c in text for c in "()[]") else text


def read(
    title: str | None,
    kind: ViewKind,
    subject: str | None,
    lines: Sequence[str] = (),
    conventions: SheetConventions | None = None,
    discipline: str | None = None,
) -> ViewStoreys:
    """The storeys a view's title, else a line under it read whole, states (the module's docstring);
    none for a view with no title or another kind than a plan. `lines` are the lines under its
    title, top down; `discipline`: its sheet's, which decides what they mean (`_meaning`)."""
    if title is None or kind is not ViewKind.PLAN:
        return ViewStoreys()
    held = words(conventions)
    found = storey_reader.read(title, held, plan_title=True)
    keys = _keys(found)
    if keys in STATES_NONE:
        for line in lines:
            inner = _inside(line)
            if inner is None:
                continue
            under = storey_reader.read(inner, held, plan_title=True)
            given = _keys(under)
            if given not in STATES_NONE and under.as_stated == inner:
                meaning = _meaning(subject, title, conventions, discipline)
                return ViewStoreys(given, under.as_stated, meaning, StoreysSource.TITLE_LINE)
    return ViewStoreys(
        keys, found.as_stated, _meaning(subject, title, conventions, discipline) if keys else None
    )


def titled(stated: str | None, conventions: SheetConventions | None = None) -> tuple[str, ...]:
    """The storey keys a sheet title's stated storey words read to (13's `storeys_as_stated`), with
    where a range runs to; none when it states none or they read to no key. Step 1 words a sheet
    with no plan by them (`storeys_titled`); its only plan takes them (`inherit`)."""
    if not stated:
        return ()
    keys = _keys(storey_reader.read(stated, words(conventions), plan_title=True))
    return () if keys in STATES_NONE else keys


def inherit(
    made: Sequence[ViewCandidate],
    sheet: SheetCandidate,
    on_sheet: Sequence[str],
    conventions: SheetConventions | None = None,
) -> list[ViewCandidate]:
    """The sheet's only plan, when it states no storey, given the storeys its sheet's title states
    (the module's docstring); every other view as made."""
    plans = [i for i, v in enumerate(made) if v.kind is ViewKind.PLAN]
    stated = sheet.storeys_as_stated.value if sheet.storeys_as_stated is not None else ""
    if len(plans) != 1 or not stated or made[plans[0]].storeys not in STATES_NONE:
        return list(made)
    keys = titled(stated, conventions)
    if not keys:
        return list(made)
    plan = made[plans[0]]
    discipline = sheet.discipline.value if sheet.discipline is not None else None
    subject = plan.subject or (on_sheet[0] if len(on_sheet) == 1 else None)
    given = replace(
        plan,
        storeys=keys,
        storeys_as_stated=" ".join(stated.split()),
        storeys_meaning=_meaning(subject, plan.title, conventions, discipline),
        storeys_source=StoreysSource.SHEET_TITLE,
    )
    return [given if i == plans[0] else v for i, v in enumerate(made)]
