"""Ticket S15-W7: one banned-word check replaces the divergent copies (m0-screens 8 item 4).

docs/design/m0-screens.md 1.1, "Never shown to a QS or an MD (the design gate greps the DOM for them)",
and 8 item 4, "No word from 1.1's list in the DOM. *Automated*". Before this ticket the list was copied,
each copy different, into the screen tests of 20a (Members, Projects, the end-to-end walk), 20b and 22,
and the words lint (`tools/lint/words.py`) judged the catalogues by a sixth list of its own.

The seams this ticket names (no plan or contract gives them):
- the one source list: `web/src/test/never-shown.json`, a JSON array of 1.1's words as 1.1 writes them;
- the catalogue check: the words lint, `tools.lint.words.scan(root, allowlist)`, reading the list from
  `<root>/web/src/test/never-shown.json`, over every shipped catalogue and machine-words file;
- the DOM check the screen tests call: `web/src/test/never-shown.ts` (pinned by
  `web/src/acceptance/ts15w7/never-shown.node.test.ts`).
"""

import json
import re
import shutil
from pathlib import Path

import pytest

from tools.lint.words import ALLOWLIST, load_allowlist, scan

REPO = Path(__file__).resolve().parents[5]
SOURCE = "web/src/test/never-shown.json"
SPEC = REPO / "docs/design/m0-screens.md"
MSGID = "drawings.sheets.planted"
MACHINE = "web/src/messages/drawings/sheets/en.po"

# m0-screens 1.1's list, each word or phrase as it is written there. The rest of that list is not a
# word ("stack traces", "error codes", "a message code or catalogue key", "any path"); font file names
# with extensions are judged as a shape (test_a_font_file_name_with_its_extension_fails).
NEVER_SHOWN = [
    "handle", "entity", "SDF", "DXF", "LibreDWG", "ACadSharp", "ezdxf", "pdf.js", "WebGL", "buffer",
    "artefact", "render", "parse", "JSON", "sandbox", "worker", "job", "queue", "hash", "sha256",
    "tenant", "RLS", "API", "null", "undefined", "NaN", "UUID", "locale", "cell", "home region", "Rod",
    "model space",
]  # fmt: skip

# Words no other file may hold together: a file with four or more of them holds a copy of the list.
SIGNAL = [
    "LibreDWG", "ACadSharp", "ezdxf", "sha256", "SDF", "WebGL",
    "sandbox", "tenant", "UUID", "NaN", "RLS",
]  # fmt: skip
COPY_AT = 4


def entry(msgid: str, msgstr: str, comment: str = "a planted message") -> str:
    return f'#. {comment}\nmsgid "{msgid}"\nmsgstr "{msgstr}"\n\n'


def tree(tmp_path: Path, catalogue: str, *entries: str, source: list[str] | None = None) -> Path:
    """A web tree with one catalogue at `catalogue` and the repo's source list (or `source`)."""
    root = tmp_path / "repo"
    target = root / catalogue
    target.parent.mkdir(parents=True)
    target.write_text('msgid ""\nmsgstr ""\n"Language: en\\n"\n\n' + "".join(entries), encoding="utf-8")
    (root / SOURCE).parent.mkdir(parents=True, exist_ok=True)
    if source is not None:
        (root / SOURCE).write_text(json.dumps(source), encoding="utf-8")
    elif (REPO / SOURCE).exists():
        shutil.copyfile(REPO / SOURCE, root / SOURCE)
    return root


def flagged(root: Path, msgid: str = MSGID) -> list[str]:
    findings, _stale = scan(root, [])
    return [finding.text for finding in findings if finding.msgid == msgid]


def section_1_1() -> str:
    text = SPEC.read_text(encoding="utf-8")
    start = text.index("### 1.1 Words")
    return text[start : text.index("### 1.2", start)]


def shipped_catalogues() -> list[str]:
    web = REPO / "web/src"
    chrome = [p for p in web.glob("*/locales/en.po") if p.parent.parent.name != "dev"]
    return sorted(p.relative_to(REPO).as_posix() for p in chrome)


def machine_words_files() -> list[str]:
    return sorted(p.relative_to(REPO).as_posix() for p in (REPO / "web/src/messages").glob("**/en.po"))


def test_the_one_list_is_section_1_1s_list_word_for_word() -> None:
    section = section_1_1()
    start = section.index("- **Never shown to a QS")
    paragraph = section[start : section.index("\n- ", start + 1)]
    for word in NEVER_SHOWN:
        assert word in paragraph, f"{word!r} is not in m0-screens 1.1's list"
    words = json.loads((REPO / SOURCE).read_text(encoding="utf-8"))
    assert sorted(words) == sorted(NEVER_SHOWN)


@pytest.mark.parametrize("word", NEVER_SHOWN)
def test_each_word_of_the_list_in_a_machine_words_file_fails_the_words_lint(
    tmp_path: Path, word: str
) -> None:
    root = tree(tmp_path, MACHINE, entry(MSGID, f"The {word} could not be read."))
    assert flagged(root), f"{word!r} planted in {MACHINE} passed the words lint"


@pytest.mark.parametrize(
    ("planted", "word"),
    [("Job 3 has stopped.", "job"), ("Parse the file again.", "parse"), ("Tenant not found.", "tenant"),
     ("Locale is not set.", "locale"), ("Cell 4 is full.", "cell"), ("Null was given.", "null")],
)  # fmt: skip
def test_a_word_capitalised_at_the_start_of_a_sentence_fails(
    tmp_path: Path, planted: str, word: str
) -> None:
    root = tree(tmp_path, MACHINE, entry(MSGID, planted))
    assert flagged(root), f"{planted!r} ({word}) passed the words lint"


@pytest.mark.parametrize(
    "planted",
    ["Two jobs are waiting.", "No workers are free.", "Both tenants can see it.",
     "3 entities were drawn.", "Two cells are full.", "The UUIDs differ.", "Both handles are kept."],
)  # fmt: skip
def test_a_word_of_the_list_in_the_plural_fails(tmp_path: Path, planted: str) -> None:
    root = tree(tmp_path, MACHINE, entry(MSGID, planted))
    assert flagged(root), f"{planted!r} passed the words lint"


def test_a_font_file_name_with_its_extension_fails(tmp_path: Path) -> None:
    root = tree(tmp_path, MACHINE, entry(MSGID, "The lettering romans.shx is not on this computer."))
    assert flagged(root), "a font file name with its extension passed the words lint"


@pytest.mark.parametrize("catalogue", shipped_catalogues())
def test_a_planted_word_in_any_shipped_catalogue_fails(tmp_path: Path, catalogue: str) -> None:
    root = tree(tmp_path, catalogue, entry("Uw3rT9", "The tenant could not be found."))
    assert flagged(root, "Uw3rT9"), f"a planted word in {catalogue} passed the words lint"


@pytest.mark.parametrize("catalogue", machine_words_files())
def test_a_planted_word_in_any_machine_words_file_fails(tmp_path: Path, catalogue: str) -> None:
    root = tree(tmp_path, catalogue, entry(MSGID, "RLS kept this row from you."))
    assert flagged(root), f"a planted word in {catalogue} passed the words lint"


def test_a_word_added_to_the_one_list_is_judged_in_the_catalogues(tmp_path: Path) -> None:
    words = json.loads((REPO / SOURCE).read_text(encoding="utf-8"))
    planted = entry(MSGID, "The zorbleflux has stopped.")
    root = tree(tmp_path, MACHINE, planted, source=[*words, "zorbleflux"])
    assert flagged(root), "a word added to web/src/test/never-shown.json was not judged"


def test_the_qs_words_and_what_is_not_shown_pass(tmp_path: Path) -> None:
    root = tree(
        tmp_path,
        MACHINE,
        entry(
            MSGID,
            "Cancelled. Rapid progress on Production Road 7: the Rebar is laid out in the drawing, "
            "in Romans (AutoCAD lettering).",
            comment="the job's worker reads the tenant's sandbox; JSON, UUID and SDF are not shown",
        ),
        entry("platform.jobs.queued", "Waiting to be read"),
    )
    assert flagged(root) == []
    assert flagged(root, "platform.jobs.queued") == []


def test_the_repos_own_catalogues_pass_the_words_lint() -> None:
    findings, stale = scan(REPO, load_allowlist(REPO / ALLOWLIST))
    assert [(f.path, f.msgid, f.text) for f in findings] == []
    assert stale == []


def copies(paths: list[Path]) -> list[str]:
    held = []
    for path in paths:
        text = path.read_text(encoding="utf-8", errors="replace")
        if sum(1 for word in SIGNAL if word in text) >= COPY_AT:
            held.append(path.relative_to(REPO).as_posix())
    return sorted(held)


def test_the_words_lint_holds_no_list_of_its_own() -> None:
    lint = [p for p in (REPO / "tools/lint").glob("*") if p.suffix in {".py", ".toml"}]
    held = copies(lint)
    assert held == [], f"{held} holds a copy of the list (web/src/test/never-shown.json is the one list)"


def test_no_web_file_but_the_one_list_holds_a_copy_of_it() -> None:
    web = REPO / "web"
    paths = [
        p
        for folder in ("src", "e2e", "scripts", "eslint")
        for p in (web / folder).rglob("*")
        if p.is_file()
        and p.suffix in {".ts", ".tsx", ".mjs", ".js", ".json"}
        and p.relative_to(REPO).as_posix() != SOURCE
        and "acceptance/ts15w7" not in p.as_posix()
    ]
    held = copies(paths)
    assert held == [], f"{held} holds a copy of the list (web/src/test/never-shown.json is the one list)"


@pytest.mark.parametrize(
    "screen_test",
    ["web/src/members/members.test.tsx", "web/src/projects/projects.test.tsx",
     "web/e2e/screens-20a.walk.ts", "web/src/acceptance/t20b/drawing-set.test.tsx",
     "web/src/acceptance/t22/step1.test.tsx"],
)  # fmt: skip
def test_each_screen_test_that_greps_the_dom_judges_by_the_one_list(screen_test: str) -> None:
    text = (REPO / screen_test).read_text(encoding="utf-8")
    assert re.search(r"""from ['"][^'"]*\btest/never-shown['"]""", text), (
        f"{screen_test} does not import its DOM check from web/src/test/never-shown"
    )
