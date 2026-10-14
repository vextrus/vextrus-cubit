"""A route declared before it is built (M1-00, the contract freeze: docs/plans/M1.md). Worded in
`web/src/messages/platform/stubs/en.po`.

- `not_built`: the route is in the API, with its contract's request and reply, but the ticket that
  builds it has not landed; nothing was read or changed (501).
"""

from engine.messages import MessageCode

NOT_BUILT = MessageCode("platform.stubs.not_built")
