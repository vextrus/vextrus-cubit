"""Shared helpers for ticket S14-C14's acceptance tests (not a test file).

The repository locks no YAML parser (uv.lock), so the workflow files are read by `load`, a reader of
the block-YAML subset GitHub workflows use here: block mappings and sequences, `|`/`>` block scalars,
one-line flow sequences and mappings, plain and quoted scalars, comments. Anything else (an anchor, an
alias, a
tag, a multi-line flow collection) raises `Unsupported`, never a silent misreading. Keys stay strings, as
GitHub reads them (`on` is not `True`).

`evaluate` is a reader of GitHub's expression language for the parts these files use: contexts
(`github.head_ref`, `needs.changes.outputs.python`), literals, `!`, `==`, `!=`, `&&`, `||`, parentheses
and the functions `always`, `success`, `failure`, `cancelled`, `contains`, `startsWith`, `endsWith`,
`format`. String comparison ignores case, as GitHub's does. A missing context property is `''`.
`interpolate` expands `${{ }}` inside a value as GitHub does.

Nothing here reads the network or runs a workflow.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[5]
WORKFLOWS = REPO / ".github" / "workflows"


class Unsupported(ValueError):
    """A YAML or expression feature this reader does not take."""


# ---------------------------------------------------------------------------------------------- YAML

KEY = re.compile(
    r"""^(?P<key>"[^"]*"|'[^']*'|[^\s"'#\[\]{},:-][^:#]*?|-[^\s:#][^:#]*?)[ \t]*:(?:[ \t]+|$)"""
)


def _strip_comment(text: str) -> str:
    """The text before a ` #` comment outside quotes."""
    quote = ""
    for at, char in enumerate(text):
        if quote:
            if char == quote:
                quote = ""
            continue
        if char in "'\"" and (at == 0 or text[at - 1] in " \t[{,:"):
            quote = char
        elif char == "#" and (at == 0 or text[at - 1] in " \t"):
            return text[:at].rstrip()
    return text.rstrip()


def _split_flow(body: str) -> list[str]:
    parts, depth, quote, start = [], 0, "", 0
    for at, char in enumerate(body):
        if quote:
            if char == quote:
                quote = ""
        elif char in "'\"":
            quote = char
        elif char in "[{":
            depth += 1
        elif char in "]}":
            depth -= 1
        elif char == "," and depth == 0:
            parts.append(body[start:at])
            start = at + 1
    parts.append(body[start:])
    return [part.strip() for part in parts if part.strip()]


def scalar(raw: str) -> Any:
    text = _strip_comment(raw).strip()
    if not text:
        return None
    if text[0] in "&*!":
        raise Unsupported(f"anchor, alias or tag: {text!r}")
    if text.startswith("["):
        if not text.endswith("]"):
            raise Unsupported(f"a multi-line flow sequence: {text!r}")
        return [scalar(part) for part in _split_flow(text[1:-1])]
    if text.startswith("{"):
        if not text.endswith("}"):
            raise Unsupported(f"a multi-line flow mapping: {text!r}")
        found: dict[str, Any] = {}
        for part in _split_flow(text[1:-1]):
            key, _, value = part.partition(":")
            found[_unquote(key.strip())] = scalar(value)
        return found
    if text[0] == "'":
        if not text.endswith("'") or len(text) < 2:
            raise Unsupported(f"a multi-line quoted scalar: {text!r}")
        return text[1:-1].replace("''", "'")
    if text[0] == '"':
        if not text.endswith('"') or len(text) < 2:
            raise Unsupported(f"a multi-line quoted scalar: {text!r}")
        return (
            text[1:-1]
            .replace('\\"', '"')
            .replace("\\n", "\n")
            .replace("\\t", "\t")
            .replace("\\\\", "\\")
        )
    if text in ("true", "True", "TRUE"):
        return True
    if text in ("false", "False", "FALSE"):
        return False
    if text in ("null", "Null", "NULL", "~"):
        return None
    if re.fullmatch(r"-?[0-9]+", text):
        return int(text)
    return text


def _unquote(key: str) -> str:
    if len(key) >= 2 and key[0] == key[-1] and key[0] in "'\"":
        return key[1:-1]
    return key


class _Reader:
    def __init__(self, text: str) -> None:
        self.lines = text.replace("\r", "").replace("\t", "    ").split("\n")
        self.at = 0

    def _significant(self) -> int | None:
        """The index of the next line that is neither blank nor a comment."""
        at = self.at
        while at < len(self.lines):
            stripped = self.lines[at].strip()
            if stripped and not stripped.startswith("#"):
                return at
            at += 1
        return None

    @staticmethod
    def _indent(line: str) -> int:
        return len(line) - len(line.lstrip(" "))

    def block(self, deeper_than: int) -> Any:
        at = self._significant()
        if at is None:
            return None
        line = self.lines[at]
        indent = self._indent(line)
        if indent <= deeper_than:
            return None
        if line.strip() == "-" or line.strip().startswith("- "):
            return self.sequence(indent)
        return self.mapping(indent)

    def _value(self, rest: str, indent: int, sequence_ok: bool) -> Any:
        rest = rest.strip()
        if rest and rest[0] in "|>":
            return self._block_scalar(rest, indent)
        if _strip_comment(rest):
            return scalar(rest)
        at = self._significant()
        if at is None:
            return None
        line = self.lines[at]
        width = self._indent(line)
        if width > indent:
            return self.block(indent)
        if sequence_ok and width == indent and (line.strip() == "-" or line.strip().startswith("- ")):
            return self.sequence(indent)
        return None

    def mapping(self, indent: int) -> dict[str, Any]:
        found: dict[str, Any] = {}
        while (at := self._significant()) is not None:
            line = self.lines[at]
            width = self._indent(line)
            if width < indent:
                break
            if width > indent:
                raise Unsupported(f"line {at + 1}: unexpected indentation")
            body = line[indent:]
            if body == "-" or body.startswith("- "):
                break
            match = KEY.match(body)
            if not match:
                raise Unsupported(f"line {at + 1}: not a mapping entry: {body!r}")
            key = _unquote(match["key"].strip())
            if key in found:
                raise Unsupported(f"line {at + 1}: key {key!r} repeated")
            self.at = at + 1
            found[key] = self._value(body[match.end() :], indent, sequence_ok=True)
        return found

    def sequence(self, indent: int) -> list[Any]:
        found: list[Any] = []
        while (at := self._significant()) is not None:
            line = self.lines[at]
            width = self._indent(line)
            if width != indent or not (line.strip() == "-" or line.strip().startswith("- ")):
                if width > indent:
                    raise Unsupported(f"line {at + 1}: unexpected indentation")
                break
            item = line[indent + 1 :]
            content = item.lstrip(" ")
            column = indent + 1 + (len(item) - len(content))
            if not content:
                self.at = at + 1
                found.append(self.block(indent))
            elif KEY.match(content):
                self.lines[at] = " " * column + content
                self.at = at
                found.append(self.mapping(column))
            elif content[0] in "|>":
                self.at = at + 1
                found.append(self._block_scalar(content, indent))
            else:
                self.at = at + 1
                found.append(scalar(content))
        return found

    def _block_scalar(self, header: str, indent: int) -> str:
        style = _strip_comment(header)
        if style not in ("|", "|-", "|+", ">", ">-", ">+"):
            raise Unsupported(f"block scalar header {header!r}")
        collected: list[str] = []
        while self.at < len(self.lines):
            line = self.lines[self.at]
            if line.strip() and self._indent(line) <= indent:
                break
            collected.append(line)
            self.at += 1
        while collected and not collected[-1].strip():
            collected.pop()
        widths = [self._indent(line) for line in collected if line.strip()]
        cut = min(widths) if widths else 0
        lines = [line[cut:] for line in collected]
        if style[0] == "|":
            text = "\n".join(lines)
        else:
            text = ""
            for line in lines:
                if not line:
                    text += "\n"
                elif text and not text.endswith("\n"):
                    text += " " + line
                else:
                    text += line
        return text if style.endswith("-") else text + "\n"


def load(path: Path) -> dict[str, Any]:
    reader = _Reader(path.read_text())
    found = reader.block(-1)
    rest = reader._significant()
    if rest is not None:
        raise Unsupported(f"{path.name} line {rest + 1}: not read")
    if not isinstance(found, dict):
        raise Unsupported(f"{path.name}: not a mapping")
    return found


def workflows() -> dict[str, dict[str, Any]]:
    """Every workflow file, by its file name."""
    return {path.name: load(path) for path in sorted(WORKFLOWS.glob("*.y*ml"))}


def triggers(workflow: dict[str, Any]) -> dict[str, Any]:
    """The `on:` events, each with its settings (None when it has none)."""
    on = workflow.get("on")
    if isinstance(on, str):
        return {on: None}
    if isinstance(on, list):
        return {str(event): None for event in on}
    if isinstance(on, dict):
        return dict(on)
    return {}


def jobs(workflow: dict[str, Any]) -> dict[str, dict[str, Any]]:
    found = workflow.get("jobs") or {}
    assert isinstance(found, dict)
    return found


def needs(job: dict[str, Any]) -> list[str]:
    value = job.get("needs") or []
    return [value] if isinstance(value, str) else list(value)


# ----------------------------------------------------------------------------------------- expressions

TOKEN = re.compile(
    r"""\s*(?:(?P<num>-?[0-9]+(?:\.[0-9]+)?)|(?P<str>'(?:[^']|'')*')|(?P<op>==|!=|&&|\|\||<=|>=|[!()<>,.\[\]*])|(?P<name>[A-Za-z_][A-Za-z0-9_-]*))"""
)


def _tokens(text: str) -> list[tuple[str, str]]:
    found, at = [], 0
    text = text.strip()
    while at < len(text):
        match = TOKEN.match(text, at)
        if not match or match.end() == at:
            raise Unsupported(f"expression {text!r} at {at}")
        kind = match.lastgroup
        assert kind is not None
        found.append((kind, match[kind]))
        at = match.end()
        while at < len(text) and text[at].isspace():
            at += 1
    return found


def truthy(value: Any) -> bool:
    return value not in (None, False, "", 0)


def _string(value: Any) -> str:
    if value is None:
        return ""
    if value is True:
        return "true"
    if value is False:
        return "false"
    return str(value)


def _equal(left: Any, right: Any) -> bool:
    if isinstance(left, str) and isinstance(right, str):
        return left.lower() == right.lower()
    if type(left) is not type(right):

        def number(value: Any) -> float | None:
            if value is None:
                return 0.0
            if isinstance(value, bool):
                return float(value)
            if isinstance(value, (int, float)):
                return float(value)
            if isinstance(value, str):
                try:
                    return float(value) if value.strip() else 0.0
                except ValueError:
                    return None
            return None

        a, b = number(left), number(right)
        return a is not None and b is not None and a == b
    return bool(left == right)


class _Expression:
    def __init__(self, text: str, context: dict[str, Any]) -> None:
        self.tokens = _tokens(text)
        self.at = 0
        self.context = context

    def peek(self) -> tuple[str, str] | None:
        return self.tokens[self.at] if self.at < len(self.tokens) else None

    def take(self, value: str | None = None) -> tuple[str, str]:
        token = self.peek()
        if token is None or (value is not None and token[1] != value):
            raise Unsupported(f"expected {value!r}, found {token!r}")
        self.at += 1
        return token

    def run(self) -> Any:
        value = self.either()
        if self.peek() is not None:
            raise Unsupported(f"trailing {self.peek()!r}")
        return value

    def either(self) -> Any:
        value = self.both()
        while self.peek() == ("op", "||"):
            self.take()
            right = self.both()
            value = value if truthy(value) else right
        return value

    def both(self) -> Any:
        value = self.compare()
        while self.peek() == ("op", "&&"):
            self.take()
            right = self.compare()
            value = right if truthy(value) else value
        return value

    def compare(self) -> Any:
        value = self.unary()
        while self.peek() in (("op", "=="), ("op", "!=")):
            op = self.take()[1]
            right = self.unary()
            value = _equal(value, right) if op == "==" else not _equal(value, right)
        return value

    def unary(self) -> Any:
        if self.peek() == ("op", "!"):
            self.take()
            return not truthy(self.unary())
        return self.primary()

    def primary(self) -> Any:
        kind, text = self.take()
        if kind == "num":
            return float(text) if "." in text else int(text)
        if kind == "str":
            return text[1:-1].replace("''", "'")
        if (kind, text) == ("op", "("):
            inner = self.either()
            self.take(")")
            return inner
        if kind != "name":
            raise Unsupported(f"unexpected {text!r}")
        if text == "true":
            return True
        if text == "false":
            return False
        if text == "null":
            return None
        if self.peek() == ("op", "("):
            return self.call(text)
        value: Any = self.context.get(text, "")
        while self.peek() in (("op", "."), ("op", "[")):
            if self.take()[1] == ".":
                key = self.take()[1]
            else:
                key = _string(self.either())
                self.take("]")
            value = value.get(key, "") if isinstance(value, dict) else ""
        return value

    def call(self, name: str) -> Any:
        self.take("(")
        args: list[Any] = []
        while self.peek() != ("op", ")"):
            args.append(self.either())
            if self.peek() == ("op", ","):
                self.take()
        self.take(")")
        status = self.context.get("__status__", "success")
        lowered = name.lower()
        if lowered == "always":
            return True
        if lowered == "success":
            return status == "success"
        if lowered == "failure":
            return status == "failure"
        if lowered == "cancelled":
            return status == "cancelled"
        if lowered == "contains":
            haystack, needle = args
            if isinstance(haystack, list):
                return any(_equal(item, needle) for item in haystack)
            return _string(needle).lower() in _string(haystack).lower()
        if lowered == "startswith":
            return _string(args[0]).lower().startswith(_string(args[1]).lower())
        if lowered == "endswith":
            return _string(args[0]).lower().endswith(_string(args[1]).lower())
        if lowered == "format":
            text = _string(args[0])
            for index, arg in enumerate(args[1:]):
                text = text.replace("{" + str(index) + "}", _string(arg))
            return text
        raise Unsupported(f"function {name}()")


def evaluate(expression: str, context: dict[str, Any]) -> Any:
    """One expression, with or without its `${{ }}`."""
    text = expression.strip()
    if text.startswith("${{") and text.endswith("}}") and text.count("${{") == 1:
        text = text[3:-2]
    return _Expression(text, context).run()


INLINE = re.compile(r"\$\{\{(.*?)\}\}", re.DOTALL)


def interpolate(value: Any, context: dict[str, Any]) -> Any:
    """A workflow value with its `${{ }}` expanded: the bare value when it is one expression whole."""
    if not isinstance(value, str):
        return value
    whole = INLINE.fullmatch(value.strip())
    if whole:
        return evaluate(whole[1], context)
    return INLINE.sub(lambda match: _string(evaluate(match[1], context)), value)


def condition(job: dict[str, Any], context: dict[str, Any]) -> bool:
    """Whether a job with this `if:` runs: GitHub adds `success()` when no status function is named."""
    raw = job.get("if")
    if raw is None:
        return bool(context.get("__status__", "success") == "success")
    text = _string(raw).strip()
    if text.startswith("${{") and text.endswith("}}"):
        text = text[3:-2]
    if not re.search(r"\b(?:always|success|failure|cancelled)\s*\(", text):
        text = f"success() && ({text})"
    return truthy(evaluate(text, context))


def pull_request_context(
    workflow_name: str, number: int, branch: str, head_sha: str, run_id: int
) -> dict[str, Any]:
    """The `github` context of a `pull_request` (or `pull_request_target`) run of one PR push."""
    pull = {
        "number": number,
        "head": {"ref": branch, "sha": head_sha},
        "base": {"ref": "main", "sha": "b" * 40},
    }
    return {
        "github": {
            "event_name": "pull_request",
            "workflow": workflow_name,
            "ref": f"refs/pull/{number}/merge",
            "head_ref": branch,
            "base_ref": "main",
            "sha": head_sha,
            "run_id": run_id,
            "run_number": run_id,
            "run_attempt": 1,
            "repository": "vextrus/vextrus-cubit",
            "event": {
                "number": number,
                "pull_request": pull,
                "repository": {"default_branch": "main"},
            },
        }
    }
