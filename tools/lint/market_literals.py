"""The market-literal scan: markets are data, so no market is written in code (ADR 0038).

Scans `vextrus/`, `engine/` and `web/src/` and fails on:
- a **currency symbol** (any character Unicode classes as a currency sign, `৳`, `€`, `₹`…; `$` is
  left out, being syntax in templates, regular expressions and shells);
- a **currency code** (the ISO 4217 codes of the markets in view, as whole words: `BDT`, `KWD`…);
- a **locale tag** (`en-IN`, `bn_BD`);
- a **time zone** (an IANA zone such as `Asia/Dhaka`, or an offset such as `GMT+6`; `UTC` itself is
  how times are stored, never a market's);
- a **unit system's name** (`imperial`, `metric`);
- **server-side localisation** in Python (`localize`, `number_format`): figures are formatted only
  by the web's formatters, with the Project's Market (docs/architecture.md).

Outside the scan: tests (`tests/`, `__tests__/`, `vextrus/testing/`, `test_*.py`, `conftest.py`,
`*.test.ts`, `*.spec.ts`), the catalogues (`*.po`, `locales/`, `web/src/messages/`) and, by the
allowlist (`market_literals_allowlist.toml`), Market data: each entry names its files, optionally the
one literal it allows, and its reason. An entry with no reason, or matching no file, fails the scan.

Python's comments and docstrings are prose and are not scanned; its strings and names are. In
TypeScript, JavaScript and CSS, comments are blanked before scanning (a regular-expression literal
holding a quote or `//` may confuse this simple reader; it errs towards scanning more).

    uv run python -m tools.lint.market_literals
"""

import argparse
import io
import re
import sys
import token
import tokenize
import tomllib
import unicodedata
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

ROOTS = ("vextrus", "engine", "web/src")
ALLOWLIST = "tools/lint/market_literals_allowlist.toml"

_PY = {".py"}
_SCRIPT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
_CSS = {".css"}
_PLAIN = {".json", ".html"}
_SKIPPED_DIRS = {"node_modules", "__pycache__", "dist", ".venv", "tests", "__tests__", "locales"}
_SKIPPED_PREFIXES = ("vextrus/testing/", "web/src/messages/")

# The markets in view (ADR 0038; docs/research/global-markets-foundation.md), as ISO 4217 codes. CAD
# is left out: here it is a drawing, not Canada's dollar.
_CURRENCY_CODES = (
    "AED AUD BDT BHD CNY EGP EUR GBP IDR INR JOD JPY KWD LKR MYR NPR OMR PKR QAR SAR SGD THB TRY USD"
).split()
_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("currency code", re.compile(rf"\b(?:{'|'.join(_CURRENCY_CODES)})\b")),
    ("locale tag", re.compile(r"\b[a-z]{2,3}[-_][A-Z]{2}\b")),
    (
        "time zone",
        re.compile(
            r"\b(?:Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific)"
            r"/[A-Z][A-Za-z_]+(?:/[A-Z][A-Za-z_]+)?"
            r"|\b(?:GMT|UTC)[+-]\d{1,2}(?::?\d{2})?\b"
        ),
    ),
    ("unit system", re.compile(r"\b(?:imperial|metric)\b", re.IGNORECASE)),
)
_LOCALISATION = re.compile(r"\b(?:localize|localize_input|number_format)\b")


@dataclass(frozen=True)
class Finding:
    path: str
    line: int
    column: int
    kind: str
    text: str


@dataclass(frozen=True)
class Allow:
    path: str
    reason: str
    literal: str | None = None

    def allows(self, finding: Finding) -> bool:
        return PurePosixPath(finding.path).full_match(self.path) and self.literal in (None, finding.text)


class AllowlistError(ValueError):
    pass


def load_allowlist(path: Path) -> list[Allow]:
    entries = tomllib.loads(path.read_text(encoding="utf-8")).get("allow", [])
    allowed = []
    for entry in entries:
        if not str(entry.get("reason", "")).strip():
            raise AllowlistError(f"{path}: the entry for {entry.get('path')!r} gives no reason")
        if not str(entry.get("path", "")).strip():
            raise AllowlistError(f"{path}: an entry names no path")
        allowed.append(Allow(path=entry["path"], reason=entry["reason"], literal=entry.get("literal")))
    return allowed


def _is_exempt(relative: str) -> bool:
    parts = PurePosixPath(relative).parts
    name = parts[-1]
    return (
        relative.startswith(_SKIPPED_PREFIXES)
        or any(part in _SKIPPED_DIRS for part in parts[:-1])
        or name == "conftest.py"
        or name.startswith("test_")
        or re.search(r"\.(test|spec)\.[cm]?[jt]sx?$", name) is not None
    )


def _files(root: Path) -> Iterator[str]:
    """Every file under the scan's roots, as a path from `root`, whatever its kind."""
    for top in ROOTS:
        base = root / top
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            relative = path.relative_to(root).as_posix()
            if path.is_file() and not set(PurePosixPath(relative).parts) & {"node_modules", ".venv"}:
                yield relative


def _python_pieces(text: str) -> Iterator[tuple[int, int, str, bool]]:
    """(line, column, text, is_name) for each string and name; docstrings and comments left out."""
    string_types = {token.STRING, token.FSTRING_MIDDLE}
    string_types |= {getattr(token, "TSTRING_MIDDLE", token.STRING)}
    tokens = list(tokenize.generate_tokens(io.StringIO(text).readline))
    for index, current in enumerate(tokens):
        if current.type == token.NAME:
            yield current.start[0], current.start[1], current.string, True
        elif current.type in string_types:
            before = tokens[index - 1].type if index else token.NEWLINE
            after = tokens[index + 1].type if index + 1 < len(tokens) else token.NEWLINE
            starts_line = before in (token.NEWLINE, token.NL, token.INDENT, token.DEDENT, token.ENCODING)
            if (
                current.type == token.STRING
                and starts_line
                and after in (token.NEWLINE, token.ENDMARKER)
            ):
                continue  # a docstring, or a bare string statement: prose
            yield current.start[0], current.start[1], current.string, False


def _blank_comments(text: str, line_comments: bool) -> str:
    """The text with comments replaced by spaces (line breaks kept), strings left as they are."""
    out = list(text)
    i, quote = 0, ""
    while i < len(text):
        char = text[i]
        if quote:
            if char == "\\":
                i += 2
                continue
            if char == quote:
                quote = ""
        elif char in "'\"`":
            quote = char
        elif text.startswith("/*", i):
            end = text.find("*/", i + 2)
            end = len(text) if end < 0 else end + 2
            out[i:end] = [c if c == "\n" else " " for c in text[i:end]]
            i = end
            continue
        elif line_comments and text.startswith("//", i):
            end = text.find("\n", i)
            end = len(text) if end < 0 else end
            out[i:end] = [" "] * (end - i)
            i = end
            continue
        i += 1
    return "".join(out)


def _pieces(relative: str, text: str) -> Iterator[tuple[int, int, str, bool]]:
    suffix = PurePosixPath(relative).suffix
    if suffix in _PY:
        yield from _python_pieces(text)
        return
    if suffix in _SCRIPT:
        text = _blank_comments(text, line_comments=True)
    elif suffix in _CSS:
        text = _blank_comments(text, line_comments=False)
    elif suffix not in _PLAIN:
        return
    for number, line in enumerate(text.splitlines(), start=1):
        yield number, 0, line, False


def _findings_in(relative: str, text: str) -> Iterator[Finding]:
    python = relative.endswith(".py")
    for line, column, piece, is_name in _pieces(relative, text):
        hits: list[tuple[int, str, str]] = []
        for offset, char in enumerate(piece):
            if char != "$" and unicodedata.category(char) == "Sc":
                hits.append((offset, "currency symbol", char))
        for kind, pattern in _RULES:
            hits.extend((match.start(), kind, match.group()) for match in pattern.finditer(piece))
        if python and is_name:
            hits.extend(
                (match.start(), "server-side localisation", match.group())
                for match in _LOCALISATION.finditer(piece)
            )
        for offset, kind, found in sorted(hits):
            before = piece[:offset]
            row = line + before.count("\n")
            col = (offset - before.rfind("\n") - 1) if "\n" in before else column + offset
            yield Finding(relative, row, col + 1, kind, found)


def scan(root: Path, allowlist: Sequence[Allow]) -> list[Finding]:
    findings: list[Finding] = []
    for relative in _files(root):
        if _is_exempt(relative):
            continue
        text = (root / relative).read_text(encoding="utf-8", errors="replace")
        findings.extend(
            finding
            for finding in _findings_in(relative, text)
            if not any(entry.allows(finding) for entry in allowlist)
        )
    return findings


def stale_entries(root: Path, allowlist: Sequence[Allow]) -> list[Allow]:
    files = [PurePosixPath(relative) for relative in _files(root)]
    return [entry for entry in allowlist if not any(path.full_match(entry.path) for path in files)]


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--allowlist", type=Path)
    options = parser.parse_args(argv)
    allowlist = load_allowlist(options.allowlist or options.root / ALLOWLIST)
    findings = scan(options.root, allowlist)
    stale = stale_entries(options.root, allowlist)
    for finding in findings:
        print(f"{finding.path}:{finding.line}:{finding.column}: {finding.kind} {finding.text!r}")
    for entry in stale:
        print(f"{ALLOWLIST}: the entry for {entry.path!r} matches no file; remove it")
    if findings:
        print(
            f"{len(findings)} market literal(s). Markets are data (ADR 0038): take the value from the "
            f"Market, or, if this file is Market data, add an entry with its reason to {ALLOWLIST}."
        )
    return 1 if findings or stale else 0


if __name__ == "__main__":
    sys.exit(main())
