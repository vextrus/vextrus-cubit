"""The glue every module's `http` package uses: one router holding its submodules' routers."""

from ninja import Router

from engine.collect import submodules


def collect_router(package: str) -> Router:
    """A router tagged with the module's name, holding each submodule's `router`, found by listing.

    `package` is a module's `http` package (`vextrus.platform.http`). A submodule without a `router`
    (the tenant middleware) is skipped.
    """
    router = Router(tags=[package.split(".")[-2]])
    for submodule in submodules(package):
        child = getattr(submodule, "router", None)
        if isinstance(child, Router):
            router.add_router("", child)
    return router
