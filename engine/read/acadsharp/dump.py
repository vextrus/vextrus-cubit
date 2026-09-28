"""What the ACadSharp dumper wrote, read strictly: its format is tools/acadsharp-dump/Program.cs's.

The dump is data from a hostile file, decoded by a program that may have been subverted by it, so it
is read as untrusted input, from the stream `sandbox.open_output` opened:

- **bounded:** at most `MAX_BYTES` in all, each line at most `MAX_LINE` bytes (read with a bounded
  `readline`, so one long line cannot fill memory), and at most `MAX_ENTITIES` entities. A dump over
  a bound raises `DumpTooLarge`: the file is not checked, which is never agreement. The bounds are
  safety limits, not tuned to any file: the largest real file measured holds 95,977 entities
  (docs/research/dwg-reader-evidence.md), and `MAX_ENTITIES` is 20 times that, rounded; an entity's
  line is about 40 bytes, and `MAX_BYTES` allows about 67 a line on average;
- **exact** (format 2): a header line with exactly its four fields; then, before any entity, one line
  per entity ACadSharp could not read, `{"unread": <handle>, "type": <type>, "error": <exception type
  name>}` and nothing else; one line per entity it read, a JSON array of exactly three strings; and an
  end line, `{"end": <entity lines>, "unread": <unread lines>}`, whose counts are the lines', then
  nothing. A handle is 1 to 16 upper-case hexadecimal digits with no leading zero (a DWG handle is at
  most 8 bytes, and never 0), so one handle has one spelling, and no handle is named twice, read or
  unread; lines end with a bare line feed; a type is 1 to 256 characters, a layer at most 1,024, an
  error an identifier (never a message, which may quote the drawing). Unread lines count toward
  `MAX_ENTITIES`. Anything else raises `ValueError`, which the reader reports as the second reader
  having stopped;
- **inert:** each line is parsed with `json.loads`, which builds only strings, numbers, lists and
  dicts; NaN, infinities and a field named twice are refused; nothing in the dump is ever used as a
  path, a command or code.

What is kept is only what the comparison needs: the unread entities, by handle and type; the set of
handles read, as integers (whose hashes are
their values, so no crafted set of handles can make the set's lookups collide beyond a constant: two
handles below 2**64 share a hash only when they differ by a multiple of 2**61 - 1), and the counts per
type and per layer, which are computed here from the entity lines, never taken from the dumper.
"""

import json
import re
from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import IO, Any

from engine.messages import decoders_agree as codes
from engine.read.errors import ReadError

FORMAT = 2
DUMPER = "acadsharp-dump"
MAX_ENTITIES = 2_000_000
MAX_BYTES = 128 * 2**20
MAX_LINE = 8 * 1024
MAX_TYPE = 256
MAX_LAYER = 1024

_HANDLE = re.compile(r"[1-9A-F][0-9A-F]{0,15}")  # no leading zero, so one handle has one form
_VERSION = re.compile(r"[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,6}")
_DWG_VERSION = re.compile(r"[A-Za-z0-9_]{1,16}")
_ERROR = re.compile(r"[A-Za-z_][A-Za-z0-9_`]{0,127}")  # an exception's type name, never its message


@dataclass(frozen=True)
class Dump:
    """The second decoder's reading of one DWG: its handles and its counts."""

    acadsharp: str  # ACadSharp's version, as the dumper states it
    dwg_version: str  # the file's version, as ACadSharp names it (AC1032)
    handles: frozenset[int]
    types: Mapping[str, int]  # entities per type
    layers: Mapping[str, int]  # entities per layer
    unread: Mapping[int, str] = field(default_factory=dict)
    """The entities it could not read (Failsafe's Error notifications, the dumper's `unread` lines):
    each one's handle and type as ACadSharp names it. None of them is in `handles` or the counts."""


class DumpTooLarge(ReadError):
    """The dump holds more than the check reads; the file is not checked."""

    def __init__(self, limit: int) -> None:
        super().__init__(codes.TOO_MANY(limit=limit))
        self.limit = limit

    def __reduce__(self) -> tuple[type, tuple[object, ...]]:
        return (DumpTooLarge, (self.limit,))


def parse(
    stream: IO[bytes],
    *,
    max_bytes: int = MAX_BYTES,
    max_entities: int = MAX_ENTITIES,
    max_line: int = MAX_LINE,
) -> Dump:
    """Read a dump from its open stream. Raises `DumpTooLarge` over a bound, `ValueError` for
    anything that is not exactly the dumper's format."""
    total = 0

    def line() -> bytes:
        nonlocal total
        read = stream.readline(max_line + 1)
        total += len(read)
        if total > max_bytes:
            raise DumpTooLarge(max_entities)
        if len(read) > max_line:
            raise ValueError(f"a line of the dump is longer than {max_line} bytes")
        if read and not read.endswith(b"\n"):
            raise ValueError("the dump does not end with a line break")
        if read.endswith(b"\r\n"):
            raise ValueError("the dump's lines end with a carriage return")
        return read

    header = _object(line(), "the header")
    if set(header) != {"dumper", "format", "acadsharp", "dwg_version"}:
        raise ValueError(f"the header's fields are {sorted(header)}")
    if header["dumper"] != DUMPER or type(header["format"]) is not int or header["format"] != FORMAT:
        raise ValueError("the dump is not this dumper's format")
    acadsharp, dwg_version = header["acadsharp"], header["dwg_version"]
    if not isinstance(acadsharp, str) or not _VERSION.fullmatch(acadsharp):
        raise ValueError("the header's ACadSharp version is not a version")
    if not isinstance(dwg_version, str) or not _DWG_VERSION.fullmatch(dwg_version):
        raise ValueError("the header's DWG version is not a version name")

    handles: set[int] = set()
    unread: dict[int, str] = {}
    types: Counter[str] = Counter()
    layers: Counter[str] = Counter()
    count = 0
    while True:
        read = line()
        if not read:
            raise ValueError("the dump ends before its end line")
        if read.startswith(b"{"):
            value = _object(read, "an unread line or the end line")
            if "unread" in value and "end" not in value:
                if count:
                    raise ValueError("an unread line comes after the entity lines")
                handle, kind = _unread(value)
                if handle in unread:
                    raise ValueError("two unread lines name one handle")
                unread[handle] = kind
                if len(unread) > max_entities:
                    raise DumpTooLarge(max_entities)
                continue
            if set(value) != {"end", "unread"} or not all(_count(value[k]) for k in value):
                raise ValueError("the end line is not two counts")
            if value["end"] != count or value["unread"] != len(unread):
                raise ValueError("the end line does not count the lines")
            break
        handle, kind, layer = _entity(read)
        if handle in handles or handle in unread:
            raise ValueError("two lines of the dump name one handle")
        handles.add(handle)
        types[kind] += 1
        layers[layer] += 1
        count += 1
        if count + len(unread) > max_entities:
            raise DumpTooLarge(max_entities)
    if line():
        raise ValueError("the dump goes on after its end line")
    return Dump(acadsharp, dwg_version, frozenset(handles), dict(types), dict(layers), unread)


def _load(read: bytes, what: str) -> Any:
    try:
        return json.loads(read.decode("utf-8"), parse_constant=_refuse, object_pairs_hook=_unique)
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError) as error:
        raise ValueError(f"{what} is not a JSON value") from error


def _object(read: bytes, what: str) -> Mapping[str, Any]:
    value = _load(read, what)
    if not isinstance(value, dict):
        raise ValueError(f"{what} is not an object")
    return value


def _entity(read: bytes) -> tuple[int, str, str]:
    value = _load(read, "an entity line")
    if not (isinstance(value, list) and len(value) == 3 and all(isinstance(v, str) for v in value)):
        raise ValueError("an entity line is not three strings")
    handle, kind, layer = value
    if not _HANDLE.fullmatch(handle):
        raise ValueError("an entity's handle is not a handle")
    if not 0 < len(kind) <= MAX_TYPE or len(layer) > MAX_LAYER:
        raise ValueError("an entity's type or layer is out of bounds")
    return int(handle, 16), kind, layer


def _unread(value: Mapping[str, Any]) -> tuple[int, str]:
    if set(value) != {"unread", "type", "error"} or not all(isinstance(v, str) for v in value.values()):
        raise ValueError("an unread line is not its three strings")
    if not _HANDLE.fullmatch(value["unread"]):
        raise ValueError("an unread line's handle is not a handle")
    if not 0 < len(value["type"]) <= MAX_TYPE or not _ERROR.fullmatch(value["error"]):
        raise ValueError("an unread line's type or error is out of bounds")
    return int(value["unread"], 16), value["type"]


def _count(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    if len({key for key, _ in pairs}) != len(pairs):
        raise ValueError("an object of the dump names one field twice")
    return dict(pairs)


def _refuse(constant: str) -> float:
    raise ValueError(f"the dump holds {constant}")
