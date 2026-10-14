"""The answer of a route declared before it is built (M1-00, the contract freeze): 501
`platform.stubs.not_built`, after 07's guard has answered as it does for every route. The ticket that
builds the route replaces its stub whole; nothing here holds state."""

from django.http import HttpResponse

from vextrus.platform.http.acts import refusal
from vextrus.platform.messages import stubs as codes

NOT_BUILT_STATUS = 501


def not_built() -> HttpResponse:
    """501 `{"code": "platform.stubs.not_built", "params": {}}`: nothing was read or changed."""
    return refusal(NOT_BUILT_STATUS, codes.NOT_BUILT())
