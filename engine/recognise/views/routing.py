"""What a view is proposed for (17; S15-E5's part): its Takeoff Steps, its Part or its exclusion, by
its kind, its subject and its sheet's Discipline. Reads words only: never paper nor a drawing.

    views.kind_steps(kind, discipline, conventions=None) -> tuple[str, ...]  (Step 1, #158)
    views.working_view(views) -> int | None                            (16's and 22's fit)

**What it is proposed for** (m0-screens 6.18; the plan's review Q2 and Q7), by its sheet's Discipline:
every view of a sheet whose Discipline is a notes one (`ViewConventions.notes_disciplines`, a Market's
General Discipline, #159) but its title block goes to Step 2, whatever its kind; title blocks, key
plans and 3D/perspective views are excluded `for_information`; a legend goes to Step
2 for Structural and Architectural, else to its Discipline's Part; every view of an MEP sheet (any
Discipline but those of `STEP_DISCIPLINES`) to its Discipline's Part; general notes to Step 2. A
Structural view goes to the Steps of its subject (`STRUCTURAL_STEPS`: 4 to 10, and 14 for site works).
A title is read by what it names, never by the order of its words (`_own`): a bare "site" only says
where, and a setback beside a storey or a building element is a storey's word. On a Structural sheet a
view whose own title names several building elements is proposed for the Step of each, and one that
names a site work (a boundary or compound wall) as well for Step 14 too; one naming site works only
goes to Step 14 alone. The QS confirms; no word list decides between them.
One whose own title names no subject with a Step ("SECTION 1-1") goes to the Steps of every subject
its sheet's title names ("BEAM DETAILS": beams), in the title's order, its own subject kept as its
title says (#158), or to Step 14 alone when its sheet's title names site works (a boundary wall,
say); on a sheet whose title names none either it has no Step (unaccounted until the QS assigns it
or Step 1 tells it from the kind the sheet is confirmed as,
`vextrus/takeoff/services/step1.py`). An
Architectural plan drawing the structure (a column or beam subject, named by a word not a lintel's:
`NOT_STRUCTURE_WORDS`) is excluded as a `duplicate` (the structural set governs); an Architectural
fixture plan or toilet detail goes to Steps 11 and 12 and to the Plumbing and sanitary Part as well;
another Architectural view to Steps 11 and 12. The Step keys are the seed's (`vextrus/seed/drawings.py`)
until 19a's Library names them. **Not built:** a view that draws
only a base plan is not yet told (proposed out as `blank`, Q7); nothing here reads a view's content.

**The working view** (`working_view`) is the first plan in reading order not proposed out: the view 16
and 22 open a sheet fitted to; none when the sheet has no such plan.
"""

from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass

from engine.recognise.types import (
    Exclusion,
    ExclusionReason,
    ViewCandidate,
    ViewConventions,
    ViewKind,
)
from engine.recognise.views.titles import (
    _qualifiers,
    _Reading,
    _reading,
    _subjects_in_order,
    _tokens,
    default_conventions,
)

STEP_DISCIPLINES = frozenset({"structural", "architectural"})
"""The Disciplines M0 measures: every other one's views go to its Part (MEP, M3 onwards)."""
GENERAL_NOTES = "general_notes"
"""Step 2: General notes and specification."""
STRUCTURAL_STEPS: Mapping[str, tuple[str, ...]] = {
    "pile": ("foundations",),
    "pile_cap": ("foundations",),
    "foundation": ("foundations",),
    "retaining_wall": ("foundations",),
    "column": ("columns",),
    "shear_wall": ("columns",),
    "beam": ("beams",),
    "slab": ("slabs",),
    "stair": ("stairs",),
    "tank": ("tanks",),
    "septic_tank": ("tanks",),
    "grid": ("grid",),
    "site_works": ("site_mep",),
}
"""Steps 4 to 10 (the grid, then foundations to tanks) and Step 14 (site works) by a Structural view's
subject (the subject words make a lintel a beam over an opening and a sunshade, or chajja, a
cantilever slab; a boundary wall, a compound wall, a setback or the site, site works)."""
SITE_WORKS = "site_works"
"""The subject of a Structural sheet's site works: the owner's ruling (11 Oct 2026, session 22) sends
them to Step 14 (`site_mep`) alone, never to the building's Steps (a boundary wall's footing is
measured with the external works, not the building's foundations); a view whose own title names a
building element as well is proposed for both (`_own`)."""
ARCHITECTURAL_STEPS = ("walls", "rooms")
"""Steps 11 and 12: walls and openings, rooms and finishes."""
STRUCTURE_SUBJECTS = frozenset({"column", "beam", "shear_wall"})
NOT_STRUCTURE_WORDS = frozenset({"lintel", "lintels"})
"""Beam words an Architectural plan names without drawing the structure: a lintel layout is the
architect's (`lintel_layout`), so it is never proposed out as the structural set's duplicate."""
"""What an architectural plan draws that the structural set governs."""
PLUMBING_SUBJECTS = frozenset({"fixture", "toilet"})
PLUMBING_PART = "plumbing"
"""The Plumbing and sanitary Part, by its Discipline's key."""

_EXCLUDED_KINDS = frozenset({ViewKind.TITLE_BLOCK, ViewKind.KEY_PLAN, ViewKind.PERSPECTIVE})


@dataclass(frozen=True)
class _Own:
    """A view's own title read by the presence of its subjects, never their order: its subject (the
    first building element it names, else site works), every building element it names, and whether
    site works are named as well (Step 14 beside the elements' Steps)."""

    subject: str | None = None
    words: str = ""
    site: bool = False
    elements: tuple[str, ...] = ()


def _own(text: str, reading: _Reading, *, structural: bool = True) -> _Own:
    """The subject of a view's title (the module's docstring). Qualifiers name nothing (`_qualifiers`:
    a bare "site" says where, a setback beside a storey or an element is a storey's). On a Structural
    sheet the title is proposed for the Step of every building element it names, and for Step 14 as
    well when it names site works; the QS confirms, and no word list decides between them. Its subject
    is the first building element, else site works. Any other sheet's subject is its first one that is
    not site works: the structural set's duplicate rule is unchanged there."""
    tokens = _tokens(text)
    matches = reading.subjects.matches(tokens)
    drop = _qualifiers(tokens, matches, reading)
    found = [(" ".join(tokens[s:e]), k) for n, (s, e, k) in enumerate(matches) if n not in drop]
    building = [(w, k) for w, k in found if k != SITE_WORKS]
    if not structural:
        return _Own(building[0][1], building[0][0]) if building else _Own()
    if building:
        elements = tuple(dict.fromkeys(k for _, k in building))
        return _Own(building[0][1], building[0][0], len(building) < len(found), elements)
    if found:
        return _Own(SITE_WORKS, found[0][0], True)
    return _Own()


def _draws_structure(text: str, reading: _Reading, *, structural: bool = False) -> bool:
    """Whether the text's subject (`_own`) is one the structural set governs, named by a word other
    than a lintel's (`NOT_STRUCTURE_WORDS`): "BEAM LAYOUT PLAN" is, "LINTEL LAYOUT PLAN" is not, nor
    "STAIR AND BEAM PLAN" (its subject is the stair)."""
    own = _own(text, reading, structural=structural)
    return own.subject in STRUCTURE_SUBJECTS and own.words not in NOT_STRUCTURE_WORDS


def _proposal(
    kind: ViewKind,
    subject: str | None,
    discipline: str | None,
    on_sheet: Sequence[str] = (),
    *,
    notes: Collection[str] = (),
    structure: bool | None = None,
    site: bool = False,
    elements: Sequence[str] = (),
) -> tuple[tuple[str, ...], str | None, Exclusion | None]:
    """A view's proposed Takeoff Steps, Part or exclusion (the module's docstring); `on_sheet`: the
    subjects its sheet's title names, in order; `notes`: the Disciplines whose sheets are general notes
    (`ViewConventions.notes_disciplines`): every view of theirs is Step 2's, whatever its kind, but its
    title block (never a note: #159's acceptance); `structure`: whether its title names the structure
    by a word not a lintel's (`_draws_structure`; by default, whether its subject is one); `site`:
    whether its title names site works beside its own subject (`_Own.site`): Step 14 as well;
    `elements`: every building element it names (`_Own.elements`): each one's Step."""
    if discipline is not None and discipline in notes and kind is not ViewKind.TITLE_BLOCK:
        return (GENERAL_NOTES,), None, None
    if structure is None:
        structure = subject in STRUCTURE_SUBJECTS
    if kind in _EXCLUDED_KINDS:
        return (), None, Exclusion(ExclusionReason.FOR_INFORMATION)
    if discipline is None:
        return (), None, None
    if discipline not in STEP_DISCIPLINES:
        return (), discipline, None
    if kind in (ViewKind.LEGEND, ViewKind.NOTES):
        return (GENERAL_NOTES,), None, None
    if discipline == "structural":
        own = tuple(
            dict.fromkeys(
                step for key in (subject, *elements) for step in STRUCTURAL_STEPS.get(key or "", ())
            )
        )
        if own:
            return (
                (*own, *(s for s in STRUCTURAL_STEPS[SITE_WORKS] if site and s not in own)),
                None,
                None,
            )
        return _structural_steps(on_sheet), None, None
    if kind is ViewKind.PLAN and structure:
        return (), None, Exclusion(ExclusionReason.DUPLICATE)
    if subject in PLUMBING_SUBJECTS:
        return ARCHITECTURAL_STEPS, PLUMBING_PART, None
    return ARCHITECTURAL_STEPS, None, None


def kind_steps(
    kind: str, discipline: str | None, conventions: ViewConventions | None = None
) -> tuple[str, ...]:
    """The Takeoff Steps a Structural sheet's kind names by its subject words, in order
    (`beam_details`: beams; `column_schedule` and `shear_wall_details`: columns; `pile_cap_details`:
    foundations; `general_notes`: Step 2; `site_plan`: Step 14, site works; `details`: none): what
    Step 1 gives a view of that sheet whose own title and sheet's title name no subject, once the QS
    confirms the sheet as that kind (#158). No other Discipline's kind names a Step here."""
    if discipline != "structural":
        return ()
    if kind == GENERAL_NOTES:
        return (GENERAL_NOTES,)
    reading = _reading(conventions if conventions is not None else default_conventions())
    return _structural_steps(_subjects_in_order(kind.replace("_", " "), reading))


def _structural_steps(named: Sequence[str]) -> tuple[str, ...]:
    """The Steps of every subject named, in order, each once; Step 14 alone when site works are among
    them (`SITE_WORKS`)."""
    if SITE_WORKS in named:
        return STRUCTURAL_STEPS[SITE_WORKS]
    return tuple(dict.fromkeys(step for key in named for step in STRUCTURAL_STEPS.get(key, ())))


def working_view(views: Sequence[ViewCandidate]) -> int | None:
    """The index of the sheet's working view: its first plan not proposed out, or none."""
    return next(
        (i for i, v in enumerate(views) if v.kind == ViewKind.PLAN and v.exclusion is None), None
    )
