"""The demo seed's `takeoff` rows (ticket 19a; docs/design/m0-screens.md §7): BP-02's "Held,
answered". KR-01's Step 1 (its Proposals, Questions, Checks, Coverage and progress) is not written
here: from #182 it is the read job's own, `read_propose.files.read` run by `drawings`' seed over the
recorded DWGs (`vextrus.seed.kr01.replayed()`); this module adds nothing to it.

**BP-02, "Held, answered":** BP-ARC-old.dwg, held by `drawings`' seed (its two readers disagree,
its four sheets found), its `file_misread` Question raised with the job's options and answered by
Nusrat Jahan: read anyway (m0-screens 4.5, "Held, read anyway: its sheets are marked"). `demo` holds
its Question's id as `question:BP-02:held`.
"""

from vextrus.drawings import services as drawings
from vextrus.platform.services import tenancy
from vextrus.seed.demo import Demo
from vextrus.takeoff.services import step1
from vextrus.takeoff.services.read_propose import proposals


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
