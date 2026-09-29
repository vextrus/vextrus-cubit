"""Every error `engine.read` raises survives pickling, so a worker pool reports the file's finding
instead of breaking on the way back."""

import pickle

import pytest

from engine.messages import read as codes
from engine.read.errors import ReadError
from engine.read.sandbox import LimitReached, SandboxRefused, SandboxUnavailable

ERRORS = [
    ReadError(codes.READER_FAILED()),
    SandboxUnavailable("bwrap: No permissions to create new namespace"),
    SandboxRefused(),
    LimitReached("dwg2dxf", "wall"),
]


@pytest.mark.parametrize("error", ERRORS, ids=lambda error: type(error).__name__)
def test_an_error_survives_pickling_whole(error: ReadError) -> None:
    copy = pickle.loads(pickle.dumps(error))

    assert type(copy) is type(error)
    assert copy.message == error.message
    assert copy.args == error.args
    assert vars(copy) == vars(error)


def test_every_error_the_package_defines_is_covered() -> None:
    import engine.read.errors
    import engine.read.sandbox

    defined = {
        value
        for module in (engine.read.errors, engine.read.sandbox)
        for value in vars(module).values()
        if isinstance(value, type) and issubclass(value, ReadError)
    }

    assert defined - {type(error) for error in ERRORS} <= {engine.read.sandbox.SandboxError}
