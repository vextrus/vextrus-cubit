"""A Jev node's spot check (ticket 23; ADR 0011 item 3): its answers on labelled real items, counted.

    result = jev_spot_check.run("sheet_type", items, question, options, client=client)
    result.right, result.checked, result.queue      # right / checked; the QS's queue at the threshold
    result.by_kind                                  # {labelled kind: Tally(right, checked)}
    print(result.report())                          # counts and kinds only: this is what enters git

`items` is a sequence of `(facts, labelled kind)` pairs, read from `.private/` by the caller
(`manage.py jev_spot_check`); each is asked once through the `client` given (`jev.Client`: TypeSafe
itself, below the cache, with no database and no tenant). The options are sent exactly as given,
with or without descriptions. A label that is not an option raises `ValueError` before any question
is sent.

- **Right**: Jev's choice is the label, whatever its confidence. An `Unavailable` answer is never right.
- **Queue**: the answers the node would not propose (below its `propose_at` setting) and the
  `Unavailable` ones: the items the QS would be asked about.

Nothing here holds or shows an item's facts: they are drawing text, and only counts leave `.private/`.
"""

import re
from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, NamedTuple

from django.conf import settings

from vextrus.platform.models import JEV_KEY
from vextrus.platform.services import jev

__all__ = ["SpotCheck", "Tally", "run", "total"]

_KEY = re.compile(JEV_KEY)


class Tally(NamedTuple):
    right: int
    checked: int


@dataclass(frozen=True)
class SpotCheck:
    """One node's measure: counts by kind, never an item's facts."""

    node: str
    model: str
    threshold: Decimal
    """The confidence at which the node proposes: the queue was measured at it."""
    by_kind: Mapping[str, Tally]
    queue: int
    unavailable: Mapping[str, int] = field(default_factory=dict)
    """Why Jev did not answer, by reason."""
    confused: Mapping[tuple[str, str], int] = field(default_factory=dict)
    """Wrong answers, by (labelled kind, Jev's choice)."""

    @property
    def right(self) -> int:
        return sum(t.right for t in self.by_kind.values())

    @property
    def checked(self) -> int:
        return sum(t.checked for t in self.by_kind.values())

    def report(self) -> str:
        lines = [
            f"node {self.node} · model {self.model} · threshold {self.threshold}",
            f"right / checked: {self.right} / {self.checked} · queue: {self.queue}",
            "by kind (right / checked):",
            *(f"  {kind}: {t.right} / {t.checked}" for kind, t in sorted(self.by_kind.items())),
        ]
        if self.confused:
            lines.append("wrong (labelled -> Jev's choice):")
            lines.extend(
                f"  {label} -> {choice}: {count}"
                for (label, choice), count in sorted(self.confused.items())
            )
        if self.unavailable:
            lines.append(
                "unavailable: " + ", ".join(f"{why} {n}" for why, n in sorted(self.unavailable.items()))
            )
        return "\n".join(lines)

    def __str__(self) -> str:
        return self.report()


def run(
    node: str | jev.Node,
    items: Sequence[tuple[Mapping[str, Any], str]],
    question: str,
    options: jev.Options,
    *,
    client: jev.Client,
) -> SpotCheck:
    """Ask `client` about each labelled item once and count Jev's answers against the labels."""
    declared = jev.NODES.get(node.key if isinstance(node, jev.Node) else node)
    if declared is None:
        raise ValueError(f"{node!r} is not a declared Jev node")
    offered = list(options.keys()) if isinstance(options, Mapping) else list(options)
    if not all(isinstance(o, str) and _KEY.fullmatch(o) for o in offered):
        raise ValueError("the options are kinds' keys")  # never echoed: it may be drawing text
    for _facts, label in items:
        if label not in offered:
            named = repr(label) if isinstance(label, str) and _KEY.fullmatch(label) else "that is no key"
            raise ValueError(f"a label {named} is not among the options offered")
    threshold: Decimal = getattr(settings, declared.propose_at)
    right: Counter[str] = Counter()
    checked: Counter[str] = Counter()
    unavailable: Counter[str] = Counter()
    confused: Counter[tuple[str, str]] = Counter()
    queue = 0
    for facts, label in items:
        checked[label] += 1
        answer = client.judge(declared, facts, question, options)
        if isinstance(answer, jev.Unavailable):
            unavailable[answer.why.value] += 1
            queue += 1
            continue
        if answer.choice == label:
            right[label] += 1
        else:
            confused[(label, answer.choice)] += 1
        if not declared.proposes(answer):
            queue += 1
    return SpotCheck(
        node=declared.key,
        model=declared.model,
        threshold=threshold,
        by_kind={kind: Tally(right[kind], n) for kind, n in checked.items()},
        queue=queue,
        unavailable=dict(unavailable),
        confused=dict(confused),
    )


def total(results: Iterable[SpotCheck]) -> SpotCheck:
    """Several runs of one node (each Discipline offers its own kinds) as one measure."""
    results = list(results)
    if not results:
        raise ValueError("no spot check to add up")
    first = results[0]
    if any(
        (r.node, r.model, r.threshold) != (first.node, first.model, first.threshold) for r in results
    ):
        raise ValueError("spot checks of different nodes, models or thresholds do not add up")
    right: Counter[str] = Counter()
    checked: Counter[str] = Counter()
    unavailable: Counter[str] = Counter()
    confused: Counter[tuple[str, str]] = Counter()
    for r in results:
        for kind, t in r.by_kind.items():
            right[kind] += t.right
            checked[kind] += t.checked
        unavailable.update(r.unavailable)
        confused.update(r.confused)
    return SpotCheck(
        node=first.node,
        model=first.model,
        threshold=first.threshold,
        by_kind={kind: Tally(right[kind], n) for kind, n in checked.items()},
        queue=sum(r.queue for r in results),
        unavailable=dict(unavailable),
        confused=dict(confused),
    )
