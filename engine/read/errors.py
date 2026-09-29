"""The one error a reader raises: a file it could not read, with the finding the file is held with."""

from engine.messages import Message


class ReadError(Exception):
    """A file that could not be read. `message` is its finding, as a code and parameters (what a QS
    reads); `program` and `exit_code`, when a converter failed, are for the run's log alone (the
    harness's stage error), never the finding's words."""

    def __init__(
        self, message: Message, *, program: str | None = None, exit_code: int | None = None
    ) -> None:
        super().__init__(message["code"], message["params"])
        self.message = message
        self.program = program
        self.exit_code = exit_code

    def __reduce__(self) -> tuple[type, tuple[object, ...]] | tuple[type, tuple[object, ...], object]:
        # Pickled as it was made (a worker pool sends it back to its caller); a subclass whose
        # constructor differs defines its own.
        return (type(self), (self.message,), {"program": self.program, "exit_code": self.exit_code})
