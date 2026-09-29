"""Hand-made stand-ins for 13's readers, for 19b's tests: never the product's number or storey parser.

13 (sheet segmentation) builds `sheets.sequence(number, conventions) -> NumberParts | None` and
`storeys.read(text, conventions, *, plan_title) -> Storeys`; 19b merges after it and takes them as
parameters (`engine.recognise.conflicts.Recognisers`) until then. These doubles do only what the tests
need: `stand_in_sequence` splits a number at its last run of digits (bounded, as 13's is, before
`int()`, which refuses more than 4,300 digits); `stand_in_storeys` looks a title up in a table the test
gives; `stand_in_symbolic` says whether a key is in a set the test gives.
"""

import re
from collections.abc import Callable, Collection, Iterable, Mapping
from dataclasses import dataclass

from engine.recognise.conflicts import Recognisers

STAND_IN_DIGITS = 18
"""The longest running number the stand-in reads (13 bounds its own)."""


@dataclass(frozen=True)
class StandInParts:
    """The shape of 13's `NumberParts(prefix, running, suffix)`."""

    prefix: str
    running: int
    suffix: str


def stand_in_sequence(number: str) -> StandInParts | None:
    """A number's prefix, running number and suffix, by the orchestrator's ruling of 29 Sep 2026 (13
    builds the same rule): with no conventions pattern, the running number is the last run of digits,
    unless that run comes right after a "/", which makes it a part suffix and the run before it the
    running number ("S1-01": "S1-", 1; "S-1.01": "S-1.", 1; "S-01/1": "S-", 1, "/1"; "S-101A": "S-",
    101, "A"). None without a digit, or past the bound."""
    runs = list(re.finditer(r"\d+", number))
    if not runs:
        return None
    chosen = runs[-1]
    if len(runs) > 1 and chosen.start() > 0 and number[chosen.start() - 1] == "/":
        chosen = runs[-2]
    if len(chosen[0]) > STAND_IN_DIGITS:
        return None
    return StandInParts(number[: chosen.start()], int(chosen[0]), number[chosen.end() :])


def stand_in_storeys(table: Mapping[str, Collection[str]]) -> Callable[[str], Collection[str]]:
    """A title's storeys, looked up in `table` (no storeys for a title it does not hold)."""
    return lambda text: table.get(text, ())


def stand_in_symbolic(keys: Iterable[str]) -> Callable[[str], bool]:
    held = frozenset(keys)
    return lambda key: key in held


def stand_ins(
    storeys: Mapping[str, Collection[str]] | None = None,
    symbolic: Iterable[str] = ("typical", "top", "not_stated"),
    sequence: Callable[[str], object] = stand_in_sequence,
) -> Recognisers:
    """The stand-in readers, with a storey table and symbolic keys of the test's choosing."""
    return Recognisers(
        sequence=sequence,  # type: ignore[arg-type]
        storeys=stand_in_storeys(storeys or {}),
        symbolic=stand_in_symbolic(symbolic),
    )


class Counted:
    """A reader that counts its calls, to prove work is linear by counting it."""

    def __init__(self, reader: Callable[[str], object]) -> None:
        self.reader = reader
        self.calls = 0

    def __call__(self, text: str) -> object:
        self.calls += 1
        return self.reader(text)
