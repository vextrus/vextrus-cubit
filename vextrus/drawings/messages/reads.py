"""Refusals of what a read job asks `drawings` to keep (ticket 14): the contract's guards.

Worded in `web/src/messages/drawings/reads/en.po`. A read job (21a, 21b) keeps its reading through
`drawings.services`; each refusal here means the job handed over something that is not this file's,
so nothing of it is kept and the job's step fails (and is tried again, then shows "Could not be
read"). No person causes one; each is a fault for Vextrus to look at. `file` is the file's name.
"""

from engine.messages import MessageCode

NOT_ITS_READING = MessageCode("drawings.reads.not_its_reading", params=("file",))
"""An artefact, an anchor or a PDF page whose source is another file's (its sha256 differs), or a
Plot page from a PDF of another Drawing Set."""
WRONG_KIND = MessageCode("drawings.reads.wrong_kind", params=("file",))
"""A DWG's reading given for a PDF, or a PDF's for a DWG."""
WRONG_GROUP = MessageCode("drawings.reads.wrong_group", params=("file",))
"""A sheet whose group is not its file's Building."""
UNKNOWN_DISCIPLINE = MessageCode("drawings.reads.unknown_discipline", params=("file",))
"""A sheet or a view naming a Discipline this Market does not have."""
RAW_CODES = MessageCode("drawings.reads.raw_codes", params=("file",))
"""A title or a view's words still holding a drawing's codes (`%%C`, `\\P`): not decoded."""
BAD_RENDER = MessageCode("drawings.reads.bad_render", params=("file",))
"""A sheet's drawing that is not a sheet buffer Vextrus can draw."""
NO_READING = MessageCode("drawings.reads.no_reading", params=("file",))
"""Views asked to be kept before the file's reading was kept."""
DECIDED = MessageCode("drawings.reads.decided", params=("file",))
"""A reading that would change a sheet or view the QS has confirmed or left out."""
