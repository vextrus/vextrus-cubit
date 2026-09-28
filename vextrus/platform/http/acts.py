"""Every Ninja operation declares its act here: the act and its Project parameter, or `public`
(ticket 07; the M0 plan, "Project scope"; its review A8).

A module declares its own acts in its own package (`services.auth.Act`, with the grant it needs) and
decorates its own operations; it never edits a list in `platform`:

    # vextrus/projects/acts.py
    from vextrus.platform.services.auth import Act, Grant

    OPEN = Act("projects.open", Grant.LOOK)        # every role, a Guest and the MD included
    CREATE = Act("projects.create", Grant.CHANGE)  # the QS and the Vextrus Engineer only

    # vextrus/projects/http/projects.py
    from ninja import Router
    from vextrus.platform.http.acts import Refusal, declare
    from vextrus.projects import acts

    router = Router()

    @router.get("/projects/{project_id}", response={200: ProjectOut})
    @declare(acts.OPEN, project="project_id")
    def get_project(request, project_id: uuid.UUID) -> ...: ...

    @router.post("/projects", response={201: ProjectOut, 409: Refusal})
    @declare(acts.CREATE)
    def create_project(request, payload: NewProject) -> ...: ...

`declare` goes **below** the route decorator, so the router registers the guarded view itself; no
other decorator may sit between them, or around the operation (Ninja's `decorate_view`, a router's
decorators), since it would run before the guard: the walk refuses both. Before the view runs, the
guard:
1. checks the CSRF token on every unsafe method (POST, PUT, PATCH, DELETE), whatever the route's
   `auth`, so no operation, a public one included, answers an unsafe request without it;
2. calls `services.auth.require(act, project_id)`, the Project read from the named parameter (a
   dotted path reads into a body: `project="payload.project_id"`): signed out is 401; no current
   Membership, 403; a Project outside the Membership's scope, 404, before the role is looked at; a
   role lacking the act's grant (a Guest or the MD changing anything), 403;
3. runs the view, and turns any `services.auth.Refused` it raises into its response.

A refusal's body is the machine's sentence, `Refusal` (`{code, params}`), documented on the operation
for 401, 403 and 404; an operation declares any other status its service refuses with (409, 400).
A Project named another way (by its code) is declared without `project`; the service resolves it
and calls `require(act, project_id)` itself.

`public` is for operations anyone may call signed out (sign-in, an invitation link's page); they
set `auth=None` on the route. `vextrus/testing/auth.py` walks every operation the URLs serve and
fails on any without a declaration, so a module added later is covered with no edit to the test.
"""

import functools
import inspect
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, cast

from django.http import HttpRequest, HttpResponse, JsonResponse
from ninja import Schema
from ninja.operation import Operation
from ninja.utils import check_csrf, contribute_operation_callback

from engine.messages import Message
from vextrus.platform.messages import auth as codes
from vextrus.platform.services import auth
from vextrus.platform.services.auth import Act, Grant

__all__ = ["Act", "Declaration", "Grant", "Refusal", "declaration_of", "declare", "public"]

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})
_ATTRIBUTE = "vextrus_declaration"
_GUARD = "vextrus_guard"


class Refusal(Schema):
    """Why an act was refused: a message code and its parameters, worded by the web."""

    code: str
    params: dict[str, str | int]


@dataclass(frozen=True)
class Declaration:
    """What an operation declared: its act and where its Project comes from, or public (no act)."""

    act: Act | None
    project: str | None = None

    @property
    def public(self) -> bool:
        return self.act is None

    def project_of(self, arguments: dict[str, Any]) -> uuid.UUID | None:
        if self.project is None:
            return None
        name, *path = self.project.split(".")
        value = arguments.get(name)
        for attribute in path:
            if value is None:
                break
            value = value.get(attribute) if isinstance(value, dict) else getattr(value, attribute, None)
        if value is None or isinstance(value, uuid.UUID):
            return value
        try:
            return uuid.UUID(str(value))
        except ValueError:
            raise auth.NotFound from None


def declare[F: Callable[..., Any]](act: Act, *, project: str | None = None) -> Callable[[F], F]:
    """Declare the operation's act, and the parameter naming its Project if it acts in one."""
    if not isinstance(act, Act):
        raise TypeError(f"declare() takes an Act, not {act!r}")
    if act.grant is Grant.ACCOUNT and project is not None:
        raise TypeError(f"{act.code} is the user's own account's: it acts in no Project")

    def decorate(view: F) -> F:
        return _guard(view, Declaration(act, project))

    return decorate


def public[F: Callable[..., Any]](view: F) -> F:
    """Declare an operation anyone may call, signed out included (its route sets `auth=None`)."""
    return _guard(view, Declaration(None))


def declaration_of(view: Callable[..., Any]) -> Declaration | None:
    """The declaration of an operation whose view is the guard itself, else None.

    A decorator over the guard (a router's, say) could answer without calling it, and
    `functools.wraps` would copy the declaration onto it: so only the guard's own counts.
    """
    found = getattr(view, _ATTRIBUTE, None)
    if isinstance(found, Declaration) and getattr(view, _GUARD, None) is view:
        return found
    return None


def _guard[F: Callable[..., Any]](view: F, declaration: Declaration) -> F:
    if inspect.iscoroutinefunction(view):
        raise TypeError(f"{view.__qualname__}: the act guard runs synchronous operations only")
    if declaration_of(view) is not None:
        raise TypeError(f"{view.__qualname__} declares its act twice")
    if declaration.project is not None:
        parameter = declaration.project.split(".")[0]
        if parameter not in inspect.signature(view).parameters:
            raise TypeError(f"{view.__qualname__} has no parameter {parameter!r} naming its Project")

    @functools.wraps(view)
    def guarded(request: HttpRequest, *args: Any, **kwargs: Any) -> Any:
        if request.method not in SAFE_METHODS and check_csrf(request) is not None:
            return refusal(403, codes.CSRF_FAILED())
        try:
            if declaration.act is not None:
                auth.require(declaration.act, declaration.project_of(kwargs))
            return view(request, *args, **kwargs)
        except auth.Refused as refused:
            return refusal(refused.status, refused.message)

    setattr(guarded, _ATTRIBUTE, declaration)
    setattr(guarded, _GUARD, guarded)
    contribute_operation_callback(guarded, functools.partial(_document, declaration))
    return cast(F, guarded)


def refusal(status: int, message: Message) -> HttpResponse:
    """The response refusing an act: its status, and why as `{code, params}`."""
    return JsonResponse(message, status=status)


def _document(declaration: Declaration, operation: Operation) -> None:
    """Document the refusals the guard answers with (as Ninja's own pagination edits its models)."""
    statuses = [403] if declaration.public else [401, 403, 404]
    for status in statuses:
        if status not in operation.response_models:
            operation.response_models[status] = operation._create_response_model(Refusal)
