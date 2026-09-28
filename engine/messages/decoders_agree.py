"""The decoder cross-check's codes (ticket 10): what `engine.check.decoders_agree` says about a file.

Worded in web/src/messages/engine/decoders_agree/en.po. Every parameter is a count, never drawing text
(a layer's or a block's name is the drawing's, so none is carried), and never a program's name.

**Held or failed** (the owner's ruling, 28 Sep 2026, "4.5's 'Failed' row"; for 20b and 21a):
- `disagree` is the only finding that **holds** a file: both readers read it and they disagree, so it
  is held with this finding and a Question (m0-screens 4.5's "Held" row). The first reader is
  LibreDWG (the artefact's), the second ACadSharp (engine/read/acadsharp/). `items` is how many items
  (entities, by handle) only one reader found, `only_first` + `only_second`, kept apart as well;
  `kinds` how many kinds of item (entity types) the two count differently; `layers` how many layers
  they count differently. All five stay in the params, for the export and the Question's Trace; the
  words use `items` and `layers`.
- The rest **fail** the file: it was read by one reader only, so it shows 4.5's "Failed" row ("Try
  again", "Mark for Vextrus"), never "Held". `not_installed`, `not_pinned` (the second reader could
  not run), `stopped` (it ran and stopped before it finished: an error, a limit, no readable output)
  and `too_many` (the file is larger than it can check; `limit` is the most items it reads).

A machine without its sandbox fails with engine/messages/read.py's `sandbox_unavailable` or
`sandbox_refused`, as the first reader already has.
"""

from engine.messages import MessageCode

# Held: the two readers disagree.
DISAGREE = MessageCode(
    "engine.decoders_agree.disagree",
    params=("items", "only_first", "only_second", "kinds", "layers"),
)

# Failed: the file was read by one reader only.
NOT_INSTALLED = MessageCode("engine.decoders_agree.not_installed")
NOT_PINNED = MessageCode("engine.decoders_agree.not_pinned")
STOPPED = MessageCode("engine.decoders_agree.stopped")
TOO_MANY = MessageCode("engine.decoders_agree.too_many", params=("limit",))
