"""The twelve Django modules, lowest layer first (docs/architecture.md, the module map).

The one list INSTALLED_APPS, the API's routers and the message-code enums are built from. A module is
added here once, when it is created, never per feature. Always import the platform module as
`vextrus.platform`: a bare `platform` is Python's standard library.
"""

MODULES: tuple[str, ...] = (
    "platform",  # layer 0
    "projects",  # layer 1
    "drawings",  # layer 2
    "live_model",  # layer 3
    "takeoff",  # layer 4
    "measurement",  # layer 4
    "rates",  # layer 4
    "boq",  # layer 5
    "revisions",  # layer 6
    "summary",  # layer 6
    "exports",  # layer 6
    "assistant",  # layer 6
)
