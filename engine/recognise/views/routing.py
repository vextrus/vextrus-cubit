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
Structural view goes to the Steps of its subject (`STRUCTURAL_STEPS`: 4 to 10 only here); one whose
own title names no subject with a Step ("SECTION 1-1") goes to the Steps of every subject its sheet's
title names ("BEAM DETAILS": beams), in the title's order, its own subject kept as its title says
(#158); on a sheet whose title names none either it has no Step (unaccounted until the QS assigns it or
Step 1 tells it from the kind the sheet is confirmed as, `vextrus/takeoff/services/step1.py`). An
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

from engine.recognise.types import (
    Exclusion,
    ExclusionReason,
    ViewCandidate,
    ViewConventions,
    ViewKind,
)
from engine.recognise.views.titles import (
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
    "grid": ("grid",),
}
"""Steps 4 to 10 (the grid, then foundations to tanks) by a Structural view's subject (the subject
words make a lintel a beam over an opening and a sunshade, or chajja, a cantilever slab)."""
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


def _draws_structure(text: str, reading: _Reading) -> bool:
    """Whether the text's subject (its first subject words, as `_subject`) is one the structural set
    governs, named by a word other than a lintel's (`NOT_STRUCTURE_WORDS`): "BEAM LAYOUT PLAN" is,
    "LINTEL LAYOUT PLAN" is not, nor "STAIR AND BEAM PLAN" (its subject is the stair)."""
    tokens = _tokens(text)
    found = reading.subjects.matches(tokens)
    if not found:
        return False
    start, end, key = found[0]
    return key in STRUCTURE_SUBJECTS and " ".join(tokens[start:end]) not in NOT_STRUCTURE_WORDS


def _proposal(
    kind: ViewKind,
    subject: str | None,
    discipline: str | None,
    on_sheet: Sequence[str] = (),
    *,
    notes: Collection[str] = (),
    structure: bool | None = None,
) -> tuple[tuple[str, ...], str | None, Exclusion | None]:
    """A view's proposed Takeoff Steps, Part or exclusion (the module's docstring); `on_sheet`: the
    subjects its sheet's title names, in order; `notes`: the Disciplines whose sheets are general notes
    (`ViewConventions.notes_disciplines`): every view of theirs is Step 2's, whatever its kind, but its
    title block (never a note: #159's acceptance); `structure`: whether its title names the structure
    by a word not a lintel's (`_draws_structure`; by default, whether its subject is one)."""
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
        own = STRUCTURAL_STEPS.get(subject or "", ())
        if own:
            return own, None, None
        steps = (step for key in on_sheet for step in STRUCTURAL_STEPS.get(key, ()))
        return tuple(dict.fromkeys(steps)), None, None
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
    foundations; `general_notes`: Step 2; `details` or `site_plan`: none): what Step 1 gives a view
    of that sheet whose own title and sheet's title name no subject, once the QS confirms the sheet
    as that kind (#158). No other Discipline's kind names a Step here."""
    if discipline != "structural":
        return ()
    if kind == GENERAL_NOTES:
        return (GENERAL_NOTES,)
    reading = _reading(conventions if conventions is not None else default_conventions())
    named = _subjects_in_order(kind.replace("_", " "), reading)
    return tuple(dict.fromkeys(step for key in named for step in STRUCTURAL_STEPS.get(key, ())))


def working_view(views: Sequence[ViewCandidate]) -> int | None:
    """The index of the sheet's working view: its first plan not proposed out, or none."""
    return next(
        (i for i, v in enumerate(views) if v.kind == ViewKind.PLAN and v.exclusion is None), None
    )
