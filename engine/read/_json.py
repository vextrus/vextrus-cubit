"""Strict reading of the JSON the reader writes: every field present, of its type, and nothing else.

Shared by the anchors and the ReadArtefact, so a stored value that has drifted from its type is
refused where it is read, never carried on half-understood.
"""

from collections.abc import Mapping, Sequence
from typing import Any

type Json = bool | int | float | str | Sequence[Json] | Mapping[str, Json] | None


class Fields:
    """A JSON object read field by field; `done()` refuses any field left unread."""

    def __init__(self, data: object, what: str) -> None:
        if not isinstance(data, Mapping):
            raise ValueError(f"{what}: expected an object, got {type(data).__name__}")
        self._data: Mapping[str, Any] = data
        self._read: set[str] = set()
        self.what = what

    def _get(self, key: str) -> Any:
        if key not in self._data:
            raise ValueError(f"{self.what}: missing {key}")
        self._read.add(key)
        return self._data[key]

    def fail(self, key: str, expected: str) -> ValueError:
        return ValueError(f"{self.what}: {key} must be {expected}, got {self._data.get(key)!r}")

    def string(self, key: str) -> str:
        value = self._get(key)
        if not isinstance(value, str):
            raise self.fail(key, "a string")
        return value

    def integer(self, key: str) -> int:
        value = self._get(key)
        if not isinstance(value, int) or isinstance(value, bool):
            raise self.fail(key, "an integer")
        return value

    def optional_string(self, key: str) -> str | None:
        value = self._get(key)
        if value is not None and not isinstance(value, str):
            raise self.fail(key, "a string or null")
        return value

    def array(self, key: str) -> list[Any]:
        value = self._get(key)
        if not isinstance(value, list):
            raise self.fail(key, "a list")
        return value

    def mapping(self, key: str) -> Mapping[str, Any]:
        value = self._get(key)
        if not isinstance(value, Mapping):
            raise self.fail(key, "an object")
        return value

    def raw(self, key: str) -> Any:
        return self._get(key)

    def done(self) -> None:
        extra = sorted(set(self._data) - self._read)
        if extra:
            raise ValueError(f"{self.what}: unknown fields {extra}")


def decimal_string(value: float) -> str:
    """A float as the shortest decimal string that reads back to the same float."""
    return repr(float(value))


def from_decimal_string(value: object, what: str) -> float:
    if not isinstance(value, str):
        raise ValueError(f"{what}: expected a decimal string, got {value!r}")
    try:
        return float(value)
    except ValueError:
        raise ValueError(f"{what}: {value!r} is not a decimal string") from None
