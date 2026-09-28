"""The one error a reader raises: a file it could not read, with the finding the file is held with."""

from engine.messages import Message


class ReadError(Exception):
    """A file that could not be read. `message` is its finding, as a code and parameters."""

    def __init__(self, message: Message) -> None:
        super().__init__(message["code"], message["params"])
        self.message = message

    def __reduce__(self) -> tuple[type, tuple[object, ...]]:
        # Pickled as it was made (a worker pool sends it back to its caller); a subclass whose
        # constructor differs defines its own.
        return (type(self), (self.message,))
