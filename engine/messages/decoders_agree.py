"""The decoder cross-check's codes (ticket 10): what `engine.check.decoders_agree` says about a file.

Worded in web/src/messages/engine/decoders_agree/en.po. Every parameter is a count, never drawing text
(a layer's or a block's name is the drawing's, so none is carried).

A disagreement is the file's finding: the file is held with it (ADR 0029). The first reader is
LibreDWG (the artefact's), the second ACadSharp (engine/read/acadsharp/):
- `only_first`, `only_second`: how many items (entities, by handle) one reader found and the other
  did not;
- `kinds`: how many kinds of item (entity types) the two count differently;
- `layers`: how many layers the two count differently.

When the second reader cannot run, the stage fails with one of the rest (or with a code of
engine/messages/read.py, for the sandbox and a reader that stopped or wrote what cannot be read); the
file is then checked by one reader only, which is never agreement.
"""

from engine.messages import MessageCode

DISAGREE = MessageCode(
    "engine.decoders_agree.disagree", params=("only_first", "only_second", "kinds", "layers")
)

# The second reader could not run on this machine.
NOT_INSTALLED = MessageCode("engine.decoders_agree.not_installed")
NOT_PINNED = MessageCode("engine.decoders_agree.not_pinned")
# The second reader listed more than the check reads (`limit`: the most items it reads).
TOO_MANY = MessageCode("engine.decoders_agree.too_many", params=("limit",))
