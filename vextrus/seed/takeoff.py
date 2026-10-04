"""The demo seed's `takeoff` rows (ticket 19a; docs/design/m0-screens.md §7): KR-01's Step 1 before
the QS's walk, and BP-02's "Held, answered". All invented; everything goes through
`takeoff.services.step1`, as 21c's read job will write it.

**KR-01:** each of its 24 printed sheets a Proposal; its Structural drawing list as read on S-01 (S-01
to S-13, `step1.record_read_list` with S-01 as its sheet, as 21c's job will write it). Where a
sheet's kind was read, Jev's answer about it is kept on its Proposal: the kind, among the kinds its
Discipline's sheets carry, answered by a stand-in for TypeSafe (no call leaves the machine; the
answer goes through `jev.ask` into the tenant's cache, as a job's would). The five Questions are
asked in §7's queue order: Q1 KR-STR-old.dwg may be misread; Q2 two sheets numbered S-07 (rev B
pre-picked); Q3 the unnumbered door and window schedule; Q4 the kind of A-05; Q5 S-13 on the drawing
list in no file. Every view's Coverage row: 70 views, 68 proposed, 2 unaccounted (S-10's loose
boxes). Step 1's progress rows, one per Discipline.

**BP-02, "Held, answered":** BP-ARC-old.dwg, held by `drawings`' seed (its two readers disagree,
its four sheets found), its `file_misread` Question answered by Nusrat Jahan: read anyway (m0-screens
4.5, "Held, read anyway: its sheets are marked").

The states a read job carries (reading with its time left, interrupted and retrying) are
`drawings`' seed's, on MG-01 (#125). `demo` holds each file's id as `file:<code>:<name>` and each
Question's as `question:<code>:<n>`.
"""

from vextrus.drawings import services as drawings
from vextrus.platform.services import tenancy
from vextrus.seed.demo import Demo
from vextrus.takeoff.services import step1
from vextrus.takeoff.services.read_propose import proposals

KIND_QUESTION = "What kind of sheet is this?"
"""The question the seed's stand-in answers (21c asks 13's own)."""


def run(demo: Demo) -> None:
    with tenancy.acting_in(demo["developer:shapla"], user_id=demo["user:nusrat"]):
        bokul_held(demo)


# BP-02: Held, answered -------------------------------------------------------------------------------


def bokul_held(demo: Demo) -> None:
    """A held file on BP-02 whose `file_misread` Question Nusrat Jahan answered: read anyway."""
    code = "BP-02"
    project_id = demo[f"project:{code}"]
    held = drawings.file(demo[f"file:{code}:BP-ARC-old.dwg"])
    disagree = demo[f"finding:{code}:BP-ARC-old.dwg"]
    question_id = step1.raise_question(
        project_id,
        "file_misread",
        disagree,
        subject_id=held.id,
        discipline=held.discipline,
        options=proposals.options(proposals.HELD_OPTIONS),
    )
    drawings.answer_held(held.id, drawings.HeldAnswer.READ_ANYWAY)
    drawings.mark_read(held.id)  # its re-read ended: its sheets listed from here (#165)
    step1.answer_question(project_id, question_id, {"key": "read_anyway"})
    demo[f"question:{code}:held"] = question_id
