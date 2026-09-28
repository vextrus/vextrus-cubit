"""What the machine says: a message code and named parameters, never prose (ADR 0038 item 2).

Every sentence the machine writes (a Question, a Check finding, a file report, an exclusion reason, a
status word, a DomainEvent) is stored and sent as `{code, params}`; the words live in the web's
catalogues, `web/src/messages/<module>/<submodule>/en.po`, written by the ticket that adds the code
(docs/architecture.md, Messages; the M0 plan's reviews A5, R7).

A package of codes holds one submodule per ticket (`engine/messages/decoders_agree.py`,
`vextrus/platform/messages/jobs.py`), each declaring its codes at module level:

    DISAGREE = MessageCode("engine.decoders_agree.disagree", params=("handles",))
    DISAGREE(handles=12)  # {"code": "engine.decoders_agree.disagree", "params": {"handles": 12}}

A code is named for its module and submodule (`<module>.<submodule>.<name>`), so two tickets can
never declare one code, and a code finds its catalogue by its name. `collect_codes` gathers a
package's codes by listing its directory, so no ticket edits a shared list; `vextrus/api.py` puts every
package's codes into the OpenAPI schema's enums. `event=True` marks a DomainEvent's kind.

This type lives in the engine, which imports nothing of Vextrus's, so the engine and every Django
module share one definition.
"""

import re
from dataclasses import dataclass
from typing import TypedDict

from engine.collect import submodules

_CODE = re.compile(r"[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+")

type Param = str | int
"""A parameter's value. Decimals travel as strings (docs/data-model.md §2, Types); never a float."""


class Message(TypedDict):
    code: str
    params: dict[str, Param]


@dataclass(frozen=True)
class MessageCode:
    code: str
    params: tuple[str, ...] = ()
    event: bool = False

    def __post_init__(self) -> None:
        if not _CODE.fullmatch(self.code):
            raise ValueError(f"message code {self.code!r} is not dotted lower-case words")

    def __call__(self, **params: Param) -> Message:
        if set(params) != set(self.params):
            raise TypeError(f"{self.code} takes {sorted(self.params)}, was given {sorted(params)}")
        return {"code": self.code, "params": dict(params)}


def collect_codes(package: str) -> tuple[MessageCode, ...]:
    """Every code declared in the package's submodules, in code order.

    `package` is a module's `messages` package (`vextrus.platform.messages`, `engine.messages`); each
    code must begin with the module's name and its submodule's (`platform.jobs.`).
    """
    module = package.split(".")[-2]
    found: dict[str, MessageCode] = {}
    for submodule in submodules(package):
        prefix = f"{module}.{submodule.__name__.rsplit('.', 1)[-1]}."
        for value in vars(submodule).values():
            if not isinstance(value, MessageCode):
                continue
            if not value.code.startswith(prefix):
                raise ValueError(f"{value.code} is declared in {submodule.__name__}: name it {prefix}…")
            if found.get(value.code, value) is not value:
                raise ValueError(f"{value.code} is declared twice in {submodule.__name__}")
            found[value.code] = value
    return tuple(found[code] for code in sorted(found))


def codes() -> tuple[MessageCode, ...]:
    """The engine's own codes: one file here per Check or reader (`engine/messages/read.py`)."""
    return collect_codes(__name__)
