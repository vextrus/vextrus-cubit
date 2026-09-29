"""The words lint: the English a QS or an MD reads says nothing the design gate keeps failing on.

Reads every `web/src/messages/**/en.po` and fails on a msgstr that holds:
- an **engine term** (m0-screens 1.1: never shown to a QS or an MD): process, stage, exit code,
  reader, dumper, sandbox, decoder, parser, candidate, regex, artefact, job, worker, queue, cache,
  token, API, timeout, viewport, model space, paper space; as whole words, any case, plurals too;
- **"add it again"** (or "add them again"): m0-screens 4.5 refuses the same file added again ("… is
  already in this Drawing Set … Nothing was added"), so the words may say it only where the file was
  not kept, or where the QS is told to change it first;
- **"ask your MD"** unless the msgid is allowlisted as an act an MD can do (an MD cannot change a
  Takeoff: m0-screens 1.4);
- **"reinforcement"**: the word is Rebar (CONTEXT.md);
- a **positional placeholder** (`{0}`): every argument is named, so a translator knows what it is;
- a **count without a plural**: a plain argument named as a count (`{count}`, `{n}`, `{…_count}`),
  or a plain argument followed by a plural noun (`{sheets} sheets`, `{drawn} drawn pages`), which
  reads "1 sheets"; use `{sheets, plural, one {# sheet} other {# sheets}}`.

Only the msgstr's own words are read: argument names, `select` and `plural` keys are not words.
The allowlist (`words_allowlist.toml`) names a msgid, the rule it is let off and a reason; an entry
with no reason, or one that no longer lets anything off, fails the lint.

    uv run python -m tools.lint.words
"""

import argparse
import re
import sys
import tomllib
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from pathlib import Path

CATALOGUES = "web/src/messages"
ALLOWLIST = "tools/lint/words_allowlist.toml"

ENGINE_TERM = "engine term"
ADD_AGAIN = "add it again"
ASK_MD = "ask your MD"
REINFORCEMENT = "reinforcement"
POSITIONAL = "positional placeholder"
COUNT = "count without a plural"
RULES = (ENGINE_TERM, ADD_AGAIN, ASK_MD, REINFORCEMENT, POSITIONAL, COUNT)

_ENGINE_TERMS = re.compile(
    r"\b(?:process(?:es)?|stages?|exit codes?|readers?|dumpers?|sandbox(?:es)?|decoders?|parsers?"
    r"|candidates?|regex(?:es)?|artefacts?|jobs?|workers?|queues?|caches?|tokens?|APIs?|timeouts?"
    r"|viewports?|model spaces?|paper spaces?)\b",
    re.IGNORECASE,
)
_ADD_AGAIN = re.compile(r"\badd (?:it|them) again\b", re.IGNORECASE)
_ASK_MD = re.compile(r"\bask your MD\b", re.IGNORECASE)
_REINFORCEMENT = re.compile(r"\breinforc(?:ement|ing|ed)s?\b", re.IGNORECASE)
_COUNT_NAME = re.compile(r"^(?:n|count|\w+_count)$")
_PLURAL_AFTER = re.compile(r"^\s+(?:[a-z]+\s+)?([a-z]+s)\b")
_NOT_PLURAL = {
    "is", "was", "has", "does", "its", "this", "as", "us", "thus", "yes", "plus", "across", "less",
    "unless", "always", "whereas", "perhaps", "his", "series", "gas", "shows", "reads", "says",
    "needs", "looks", "holds", "keeps", "uses", "names", "matches", "stays", "starts", "stops",
}  # fmt: skip
"""Words ending in s that are not a plural noun (the verbs a singular argument takes among them)."""


@dataclass(frozen=True)
class Argument:
    name: str
    kind: str
    """"" for a plain `{name}`, else its type (`plural`, `select`, `number`…)."""
    after: str
    """The literal words that follow it, up to the next argument."""


@dataclass(frozen=True)
class Message:
    path: str
    line: int
    msgid: str
    msgstr: str


@dataclass(frozen=True)
class Finding:
    path: str
    line: int
    msgid: str
    rule: str
    text: str


@dataclass(frozen=True)
class Allow:
    msgid: str
    rule: str
    reason: str
    term: str | None = None

    def allows(self, finding: Finding) -> bool:
        return (
            self.msgid == finding.msgid
            and self.rule == finding.rule
            and self.term in (None, finding.text.lower())
        )


class AllowlistError(ValueError):
    pass


def load_allowlist(path: Path) -> list[Allow]:
    entries = tomllib.loads(path.read_text(encoding="utf-8")).get("allow", [])
    allowed = []
    for entry in entries:
        msgid = str(entry.get("msgid", "")).strip()
        if not msgid:
            raise AllowlistError(f"{path}: an entry names no msgid")
        if not str(entry.get("reason", "")).strip():
            raise AllowlistError(f"{path}: the entry for {msgid!r} gives no reason")
        if entry.get("rule") not in RULES:
            raise AllowlistError(f"{path}: the entry for {msgid!r} names no rule of {RULES}")
        term = entry.get("term")
        allowed.append(
            Allow(msgid, entry["rule"], entry["reason"], term.lower() if term is not None else None)
        )
    return allowed


def _unquote(text: str) -> str:
    body = text.strip()
    if not (body.startswith('"') and body.endswith('"')):
        raise ValueError(f"not a quoted PO string: {text!r}")
    return re.sub(r"\\(.)", lambda m: {"n": "\n", "t": "\t"}.get(m.group(1), m.group(1)), body[1:-1])


def messages(path: Path, relative: str) -> Iterator[Message]:
    """Each msgid and its msgstr (continuation lines joined), with the msgstr's line."""
    msgid: str | None = None
    msgstr: str | None = None
    line = 0
    field = ""
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        text = raw.strip()
        if text.startswith("msgid "):
            if msgid and msgstr is not None:
                yield Message(relative, line, msgid, msgstr)
            msgid, msgstr, field = _unquote(text[6:]), None, "msgid"
        elif text.startswith("msgstr "):
            msgstr, line, field = _unquote(text[7:]), number, "msgstr"
        elif text.startswith('"') and field == "msgid" and msgid is not None:
            msgid += _unquote(text)
        elif text.startswith('"') and field == "msgstr" and msgstr is not None:
            msgstr += _unquote(text)
        elif not text or text.startswith("#"):
            field = ""
    if msgid and msgstr is not None:
        yield Message(relative, line, msgid, msgstr)


def _read_icu(text: str, start: int, words: list[str], arguments: list[Argument]) -> int:
    """Reads ICU message text from `start` to its closing brace (or the end); literal words go to
    `words`, arguments to `arguments`. Returns the index after the closing brace."""
    i = start
    literal: list[str] = []
    while i < len(text):
        char = text[i]
        if char == "}":
            words.append("".join(literal))
            return i + 1
        if char == "'" and i + 1 < len(text) and text[i + 1] in "{}'":
            end = text.find("'", i + 1)
            end = len(text) if end < 0 else end
            literal.append(text[i + 1 : end] if text[i + 1] != "'" else "'")
            i = end + 1
            continue
        if char != "{":
            literal.append(char)
            i += 1
            continue
        words.append("".join(literal))
        literal = []
        close = i + 1
        while close < len(text) and text[close] not in ",}":
            close += 1
        name = text[i + 1 : close].strip()
        kind = ""
        if close < len(text) and text[close] == ",":
            rest = text[close + 1 :]
            kind_match = re.match(r"\s*(\w+)\s*(,?)", rest)
            kind = kind_match.group(1) if kind_match else "?"
            i = close + 1 + (kind_match.end() if kind_match else 0)
            if kind in ("plural", "select", "selectordinal"):
                # Pairs of `key {text}` until the argument's closing brace.
                while i < len(text):
                    key = re.match(r"\s*(offset:\s*\d+\s*)?(=?[\w-]+)\s*\{", text[i:])
                    if not key:
                        break
                    i = _read_icu(text, i + key.end(), words, arguments)
                closing = text.find("}", i)
                i = len(text) if closing < 0 else closing + 1
            else:
                closing = text.find("}", i)
                i = len(text) if closing < 0 else closing + 1
        else:
            i = close + 1
        following = re.match(r"[^{}]*", text[i:])
        arguments.append(Argument(name, kind, following.group() if following else ""))
    words.append("".join(literal))
    return i


def parse(msgstr: str) -> tuple[str, list[Argument]]:
    """The msgstr's own words (joined, each piece on its own line) and its arguments."""
    words: list[str] = []
    arguments: list[Argument] = []
    i = 0
    while i < len(msgstr):
        i = _read_icu(msgstr, i, words, arguments)
        if i < len(msgstr) and msgstr[i - 1] == "}":
            words.append("}")  # a stray closing brace: keep going
    return "\n".join(words), arguments


def findings_in(message: Message) -> Iterator[Finding]:
    words, arguments = parse(message.msgstr)

    def hit(rule: str, text: str) -> Finding:
        return Finding(message.path, message.line, message.msgid, rule, text)

    for rule, pattern in (
        (ENGINE_TERM, _ENGINE_TERMS),
        (ADD_AGAIN, _ADD_AGAIN),
        (ASK_MD, _ASK_MD),
        (REINFORCEMENT, _REINFORCEMENT),
    ):
        for match in pattern.finditer(words):
            yield hit(rule, match.group())
    for argument in arguments:
        if argument.name.isdigit():
            yield hit(POSITIONAL, f"{{{argument.name}}}")
        if argument.kind:
            continue
        if _COUNT_NAME.match(argument.name):
            yield hit(COUNT, f"{{{argument.name}}}")
            continue
        plural = _PLURAL_AFTER.match(argument.after)
        if plural and plural.group(1).lower() not in _NOT_PLURAL:
            yield hit(COUNT, f"{{{argument.name}}}{plural.group()}")


def catalogues(root: Path) -> list[Path]:
    return sorted((root / CATALOGUES).glob("**/en.po"))


def scan(root: Path, allowlist: Sequence[Allow]) -> tuple[list[Finding], list[Allow]]:
    """The findings the allowlist does not let off, and the entries that let nothing off."""
    findings: list[Finding] = []
    used: set[Allow] = set()
    for path in catalogues(root):
        for message in messages(path, path.relative_to(root).as_posix()):
            for finding in findings_in(message):
                allowing = [entry for entry in allowlist if entry.allows(finding)]
                used.update(allowing)
                if not allowing:
                    findings.append(finding)
    return findings, [entry for entry in allowlist if entry not in used]


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--allowlist", type=Path)
    options = parser.parse_args(argv)
    allowlist = load_allowlist(options.allowlist or options.root / ALLOWLIST)
    findings, stale = scan(options.root, allowlist)
    for finding in findings:
        print(f"{finding.path}:{finding.line}: {finding.msgid}: {finding.rule} {finding.text!r}")
    for entry in stale:
        print(f"{ALLOWLIST}: the entry for {entry.msgid!r} ({entry.rule}) lets nothing off; remove it")
    if findings:
        print(
            f"{len(findings)} word(s) a QS should not read (docs/design/m0-screens.md 1.1). Say it in "
            f"the QS's words, or, if m0-screens itself says it, add an entry with its reason to "
            f"{ALLOWLIST}."
        )
    return 1 if findings or stale else 0


if __name__ == "__main__":
    sys.exit(main())
