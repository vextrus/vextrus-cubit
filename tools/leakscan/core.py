"""The leak scan's data: the corpus, its normalisation, the allowlist, the matcher and the stamps.

Contract: docs/specs/factory/contracts/leakscan-cli.md (sections 1 and 4). Nothing here ever formats a
corpus string, a scanned line or a matched file name into output, an exception message or a `repr`:
callers get counts, hashes and locations only.
"""

import hashlib
import json
import os
import re
import subprocess
import tempfile
import unicodedata
from collections.abc import Iterable
from pathlib import Path

DEFAULT_MAIN_CHECKOUT = "/home/riz/vextrus-cubit"
MIN_LENGTH = 8
CORPUS_FLOOR = 100
_LETTER_RUN = re.compile(r"[^\W\d_]{3}")
_HEX40 = re.compile(r"[0-9a-f]{40}")
_HEX64 = re.compile(r"[0-9a-f]{64}")
# A real-drawing run id (scripts/real_drawings/command.py), normalised: tool-made, not drawing text.
_RUN_ID = re.compile(r"\d{8}T\d{6}Z-[0-9A-F]{12}-[0-9A-F]{4}")
# A git object id (a commit sha, short or full, perhaps with a run id's hyphens), as one whitespace-free
# token: hex only, 7 or more hex characters, at least one digit and one letter A-F (so a drawing's long
# number, a phone number on a title block, or a word like `DEFACED` is never taken for one).
_OBJECT_ID = re.compile(r"(?=[0-9A-F-]*\d)(?=[0-9A-F-]*[A-F])[0-9A-F]+(?:-[0-9A-F]+)*")
# Slug boundaries: letter beside digit (either way) and lower to upper (camel case); separator runs.
_CAMEL = re.compile(r"(?<=[^\W\d_])(?=\d)|(?<=\d)(?=[^\W\d_])|(?<=[a-z])(?=[A-Z])")
_SEPARATORS = re.compile(r"[-_./\\+]+")


_UNREADABLE = (OSError, ValueError)  # UnicodeDecodeError is a ValueError


class CannotScan(Exception):
    """A scan that cannot run; `reason` is one of the contract's fixed words, never scanned text."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def main_checkout() -> Path:
    """The main checkout (`VEXTRUS_MAIN_CHECKOUT`, a test seam; the owner's path by default)."""
    return Path(os.environ.get("VEXTRUS_MAIN_CHECKOUT") or DEFAULT_MAIN_CHECKOUT)


def home() -> Path:
    """The folder holding `corpus` and `ok/` (`VEXTRUS_LEAKSCAN_HOME`, a test seam)."""
    configured = os.environ.get("VEXTRUS_LEAKSCAN_HOME")
    return Path(configured) if configured else main_checkout() / ".private/work/leakscan"


def allowlist_path() -> Path:
    """The committed allowlist (`VEXTRUS_LEAKSCAN_ALLOWLIST`, a test seam)."""
    configured = os.environ.get("VEXTRUS_LEAKSCAN_ALLOWLIST")
    return Path(configured) if configured else Path(__file__).with_name("allowlist.txt")


def in_cloud() -> bool:
    return os.environ.get("CLAUDE_CODE_REMOTE") == "true"


def normalise(text: str) -> str:
    """NFKC, whitespace runs collapsed to one space, trimmed, upper-cased (for build and scan alike)."""
    return " ".join(unicodedata.normalize("NFKC", text).split()).upper()


def keeps(normalised: str) -> bool:
    """A corpus string: 8 or more characters with a run of three letters; not a run id, and holding no
    git object id as a whole token (tool-made names: a public commit message or marker naming a sha
    would hit)."""
    return (
        len(normalised) >= MIN_LENGTH
        and _LETTER_RUN.search(normalised) is not None
        and _RUN_ID.fullmatch(normalised) is None
        and not any(_is_object_id(token) for token in normalised.split(" "))
    )


def _is_object_id(token: str) -> bool:
    return _OBJECT_ID.fullmatch(token) is not None and len(token.replace("-", "")) >= 7


def slug_forms(text: str) -> str:
    """`text` read as a slug: a space at each letter-digit and lower-to-upper boundary, each run of
    `-_./\\+` one space, then normalised (`zebra-quarry_7` and `ZebraQuarry7` read `ZEBRA QUARRY 7`)."""
    spaced = _CAMEL.sub(" ", unicodedata.normalize("NFKC", text))
    return normalise(_SEPARATORS.sub(" ", spaced))


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def allowlist() -> frozenset[str]:
    """The allowlisted hashes (one sha256 hex per line; anything else on a line is ignored)."""
    try:
        lines = allowlist_path().read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return frozenset()
    return frozenset(line.strip() for line in lines if _HEX64.fullmatch(line.strip()))


def add_to_allowlist(hashes: Iterable[str]) -> int:
    """Appends hashes (sorted, deduplicated with what is there); returns how many were new."""
    path = allowlist_path()
    current = set(allowlist())
    new = {value for value in hashes if _HEX64.fullmatch(value)} - current
    if new:
        path.write_text("".join(f"{value}\n" for value in sorted(current | new)), encoding="utf-8")
    return len(new)


def corpus_file() -> Path:
    return home() / "corpus"


def write_private(path: Path, data: bytes) -> None:
    """Writes `data` to `path` atomically, mode 0600 (a temporary file in the folder, then a rename)."""
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    handle, temporary = tempfile.mkstemp(dir=path.parent, prefix=".tmp-")
    try:
        os.fchmod(handle, 0o600)
        with os.fdopen(handle, "wb") as stream:
            stream.write(data)
        os.replace(temporary, path)
    except BaseException:
        Path(temporary).unlink(missing_ok=True)
        raise


def corpus_strings() -> int:
    """How many strings the current corpus holds (0 when there is none)."""
    try:
        return sum(1 for line in corpus_file().read_text(encoding="utf-8").splitlines() if keeps(line))
    except _UNREADABLE:
        return 0


def write_corpus(strings: Iterable[str]) -> tuple[int, str]:
    """Writes the corpus (one normalised string per line, sorted); returns its count and sha256."""
    kept = sorted({value for value in strings if keeps(value)})
    data = "".join(f"{value}\n" for value in kept).encode("utf-8")
    write_private(corpus_file(), data)
    return len(kept), hashlib.sha256(data).hexdigest()


class Corpus:
    """The loaded corpus: its hash, and a matcher keyed on each string's first 8 characters."""

    def __init__(self, data: bytes) -> None:
        self.sha256 = hashlib.sha256(data).hexdigest()
        allowed = allowlist()
        self._by_prefix: dict[str, list[str]] = {}
        self._by_slug: tuple[dict[str, list[tuple[str, str]]], list[tuple[str, str]]] | None = None
        self.strings = 0
        for value in data.decode("utf-8").splitlines():
            self.strings += keeps(value)
            if keeps(value) and digest(value) not in allowed:
                self._by_prefix.setdefault(value[:MIN_LENGTH], []).append(value)

    @classmethod
    def load(cls) -> Corpus:
        try:
            data = corpus_file().read_bytes()
        except FileNotFoundError:
            raise CannotScan("no-corpus") from None
        except OSError:
            raise CannotScan("corpus-unreadable") from None
        try:
            corpus = cls(data)
        except UnicodeDecodeError:
            raise CannotScan("corpus-unreadable") from None
        if corpus.strings == 0 or (
            corpus.strings < CORPUS_FLOOR and not os.environ.get("VEXTRUS_LEAKSCAN_HOME")
        ):
            # An empty or tiny corpus makes every scan clean: refused, never trusted. (The test
            # seam allows small invented corpora.)
            raise CannotScan("corpus-unreadable")
        return corpus

    def found(self, text: str) -> set[str]:
        """The corpus strings `text` contains, after normalisation. Never print what this returns."""
        line = normalise(text)
        found: set[str] = set()
        prefixes = self._by_prefix
        for start in range(len(line) - MIN_LENGTH + 1):
            candidates = prefixes.get(line[start : start + MIN_LENGTH])
            if candidates is not None:
                for value in candidates:
                    if line.startswith(value, start):
                        found.add(value)
        return found

    def count(self, text: str) -> int:
        return len(self.found(text))

    def found_slug(self, text: str) -> set[str]:
        """The corpus strings whose own slug form, two or more words, lies inside the slug form of one
        whitespace-free run of `text` (so `kestrel-block-c1` meets `KESTREL BLOCK C1` and `plot_12_row`
        meets `PLOT-12 ROW`), as the corpus holds them. A one-word slug form (`WORD.` reads `WORD`) and
        a match across the text's own spaces are respellings, not slugs. Never print what this
        returns."""
        if self._by_slug is None:
            # Built on first use: a slug form may be shorter than 8 characters (`A--B` reads `A B`).
            keyed: dict[str, list[tuple[str, str]]] = {}
            short: list[tuple[str, str]] = []
            for values in self._by_prefix.values():
                for value in values:
                    slug = slug_forms(value)
                    if " " not in slug:
                        continue
                    if len(slug) >= MIN_LENGTH:
                        keyed.setdefault(slug[:MIN_LENGTH], []).append((slug, value))
                    else:
                        short.append((slug, value))
            self._by_slug = (keyed, short)
        keyed, short = self._by_slug
        found: set[str] = set()
        for run in text.split():
            line = slug_forms(run)
            found |= {value for slug, value in short if slug in line}
            for start in range(len(line) - MIN_LENGTH + 1):
                candidates = keyed.get(line[start : start + MIN_LENGTH])
                if candidates is not None:
                    for slug, value in candidates:
                        if line.startswith(slug, start):
                            found.add(value)
        return found


# ---------------------------------------------------------------------------------------------- stamps


def git(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    """Runs git read-only in `repo`; its output is for this process only, never printed."""
    return subprocess.run(
        ["git", *args],
        cwd=repo,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )


def is_ancestor(repo: Path, base: str, tip: str) -> bool:
    return git(repo, "merge-base", "--is-ancestor", base, tip).returncode == 0


def stamp_path(name: str) -> Path:
    return home() / "ok" / name


def write_stamp(name: str, corpus_sha256: str, scanned: str) -> None:
    """The stamp `ok/<name>`: exactly `{"corpus": ..., "range": ...}` (contract section 4)."""
    data = json.dumps({"corpus": corpus_sha256, "range": scanned}).encode("utf-8")
    write_private(stamp_path(name), data)


def stamp_valid(name: str, repo: Path) -> bool:
    """The contract's validity rules 1-3 (section 4), checked as the guard checks them."""
    if not (_HEX40.fullmatch(name) or _HEX64.fullmatch(name)):
        return False
    path = stamp_path(name)
    try:
        if path.is_symlink() or not path.is_file():
            return False
        stamp = json.loads(path.read_text(encoding="utf-8"))
        current = hashlib.sha256(corpus_file().read_bytes()).hexdigest()
    except _UNREADABLE:
        return False
    if not isinstance(stamp, dict) or sorted(stamp) != ["corpus", "range"]:
        return False
    corpus, scanned = stamp["corpus"], stamp["range"]
    if not isinstance(corpus, str) or not isinstance(scanned, str) or corpus != current:
        return False
    if _HEX64.fullmatch(name):
        return scanned == f"sha256:{name}"
    match = re.fullmatch(r"([0-9a-f]{40})\.\.([0-9a-f]{40})", scanned)
    if match is None or match[2] != name:
        return False
    return is_ancestor(repo, match[1], "refs/remotes/origin/main") and is_ancestor(repo, match[1], name)
