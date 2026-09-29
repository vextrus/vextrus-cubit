"""The words lint: no engine term, wrong re-add, wrong MD, "reinforcement", positional placeholder
or unpluralised count in the English a QS reads (docs/design/m0-screens.md 1.1)."""

from pathlib import Path

import pytest

from tools.lint.words import (
    ADD_AGAIN,
    ALLOWLIST,
    ASK_MD,
    COUNT,
    ENGINE_TERM,
    POSITIONAL,
    REINFORCEMENT,
    Allow,
    AllowlistError,
    load_allowlist,
    main,
    parse,
    scan,
)

REPO = Path(__file__).resolve().parents[3]
CATALOGUE = "web/src/messages/drawings/sheets/en.po"


def write_catalogue(root: Path, *pairs: tuple[str, str], path: str = CATALOGUE) -> None:
    body = 'msgid ""\nmsgstr ""\n"Language: en\\n"\n\n'
    body += "".join(f'#. a comment\nmsgid "{msgid}"\nmsgstr "{msgstr}"\n\n' for msgid, msgstr in pairs)
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body, encoding="utf-8")


def found(root: Path, allow: list[Allow] | None = None) -> list[tuple[str, str, str]]:
    findings, _stale = scan(root, allow or [])
    return [(f.msgid, f.rule, f.text) for f in findings]


FAILING = [
    ("The drawing could not be read: the process stopped.", ENGINE_TERM, "process"),
    ("Two stages remain.", ENGINE_TERM, "stages"),
    ("It stopped with exit code 3.", ENGINE_TERM, "exit code"),
    ("The second Reader stopped.", ENGINE_TERM, "Reader"),
    ("The dumper failed.", ENGINE_TERM, "dumper"),
    ("It ran outside its sandbox.", ENGINE_TERM, "sandbox"),
    ("Two decoders agree.", ENGINE_TERM, "decoders"),
    ("The parser gave up.", ENGINE_TERM, "parser"),
    ("3 candidates found.", ENGINE_TERM, "candidates"),
    ("The regex matched.", ENGINE_TERM, "regex"),
    ("The artefact is kept.", ENGINE_TERM, "artefact"),
    ("The job failed.", ENGINE_TERM, "job"),
    ("No worker is running.", ENGINE_TERM, "worker"),
    ("It waits in the queue.", ENGINE_TERM, "queue"),
    ("The cache is stale.", ENGINE_TERM, "cache"),
    ("Your token has ended.", ENGINE_TERM, "token"),
    ("The API refused it.", ENGINE_TERM, "API"),
    ("A timeout stopped it.", ENGINE_TERM, "timeout"),
    ("Fit the viewport.", ENGINE_TERM, "viewport"),
    ("Laid out in model space.", ENGINE_TERM, "model space"),
    ("On paper space.", ENGINE_TERM, "paper space"),
    ("It could not be read. Add it again.", ADD_AGAIN, "Add it again"),
    ("None was kept. Add them again.", ADD_AGAIN, "Add them again"),
    ("You cannot confirm it. Ask your MD.", ASK_MD, "Ask your MD"),
    ("The reinforcement is counted.", REINFORCEMENT, "reinforcement"),
    ("{0} is already here.", POSITIONAL, "{0}"),
    ("{count} found.", COUNT, "{count}"),
    ("{n} left.", COUNT, "{n}"),
    ("{sheet_count} read.", COUNT, "{sheet_count}"),
    ("{sheets} sheets found.", COUNT, "{sheets} sheets"),
    ("On {pages} of {drawn} drawn pages.", COUNT, "{drawn} drawn pages"),
]


@pytest.mark.parametrize(("msgstr", "rule", "text"), FAILING)
def test_each_rule_finds_its_class(tmp_path: Path, msgstr: str, rule: str, text: str) -> None:
    write_catalogue(tmp_path, ("drawings.sheets.sample", msgstr))

    assert found(tmp_path) == [("drawings.sheets.sample", rule, text)]


PASSING = [
    "Reading sheet {position} of {total}",  # a place, not a count of a noun
    "{sheets, plural, one {# sheet found} other {# sheets found}}",
    "{count, plural, one {# item} other {# items}} left",
    "Processing time ran out.",  # "processing" is not "process"
    "The jobsite is kept.",  # whole words only
    "{file} is already in this Drawing Set. Nothing was added.",
    "Page {page} shows sheet {sheet}.",  # a verb after a singular argument
    "Save it from AutoCAD as a 2018 DWG, then add the new file.",
    "Ask the QS who invited you.",
    "The Rebar is counted.",
    "{role, select, stage {Your role} other {You}} can open it.",  # keys and names are not words
    "Laid out in the drawing.",
    "Quote a '{0}' literally.",  # ICU quoting: not a placeholder
]


@pytest.mark.parametrize("msgstr", PASSING)
def test_the_qs_s_words_pass(tmp_path: Path, msgstr: str) -> None:
    write_catalogue(tmp_path, ("drawings.sheets.sample", msgstr))

    assert found(tmp_path) == []


def test_only_msgstrs_are_read_never_msgids_or_comments(tmp_path: Path) -> None:
    write_catalogue(tmp_path, ("engine.read.sandbox_job_worker", "Drawings cannot be read here."))

    assert found(tmp_path) == []


def test_continuation_lines_are_joined(tmp_path: Path) -> None:
    target = tmp_path / CATALOGUE
    target.parent.mkdir(parents=True)
    target.write_text(
        'msgid "drawings.sheets.long"\nmsgstr ""\n"The second "\n"reader stopped."\n', encoding="utf-8"
    )

    assert found(tmp_path) == [("drawings.sheets.long", ENGINE_TERM, "reader")]


def test_parse_keeps_words_and_arguments_apart() -> None:
    words, arguments = parse("{n, plural, one {# sheet} other {# sheets}} in {file}, by {actor}.")

    assert "plural" not in words
    assert "file" not in words
    assert [(a.name, a.kind) for a in arguments] == [("n", "plural"), ("file", ""), ("actor", "")]


def test_an_allowlist_entry_lets_off_only_its_msgid_rule_and_term(tmp_path: Path) -> None:
    write_catalogue(
        tmp_path,
        ("drawings.files.read", "Read. Two readers agree, in a job."),
        ("drawings.files.held", "Held: the two readers disagree."),
    )
    allow = [Allow("drawings.files.read", ENGINE_TERM, "4.5 verbatim", term="readers")]

    assert found(tmp_path, allow) == [
        ("drawings.files.read", ENGINE_TERM, "job"),
        ("drawings.files.held", ENGINE_TERM, "readers"),
    ]


def test_an_entry_that_lets_nothing_off_is_stale(tmp_path: Path) -> None:
    write_catalogue(tmp_path, ("drawings.files.read", "Read."))
    entry = Allow("drawings.files.read", ENGINE_TERM, "once needed", term="readers")

    assert scan(tmp_path, [entry]) == ([], [entry])


@pytest.mark.parametrize(
    ("text", "problem"),
    [
        ('[[allow]]\nmsgid = "a.b"\nrule = "engine term"\n', "gives no reason"),
        ('[[allow]]\nmsgid = "a.b"\nrule = "anything"\nreason = "x"\n', "names no rule"),
        ('[[allow]]\nrule = "engine term"\nreason = "x"\n', "names no msgid"),
    ],
)
def test_an_allowlist_entry_needs_a_msgid_a_rule_and_a_reason(
    tmp_path: Path, text: str, problem: str
) -> None:
    path = tmp_path / "allow.toml"
    path.write_text(text, encoding="utf-8")

    with pytest.raises(AllowlistError, match=problem):
        load_allowlist(path)


def test_main_fails_on_a_finding_and_names_it(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write_catalogue(tmp_path, ("drawings.sheets.sample", "The job failed."))
    (tmp_path / "allow.toml").write_text("", encoding="utf-8")

    assert main(["--root", str(tmp_path), "--allowlist", str(tmp_path / "allow.toml")]) == 1
    assert "drawings.sheets.sample: engine term 'job'" in capsys.readouterr().out


def test_the_repository_s_catalogues_pass_with_every_allowlist_entry_used() -> None:
    allowlist = load_allowlist(REPO / ALLOWLIST)

    findings, stale = scan(REPO, allowlist)

    assert findings == []
    assert stale == []
    assert main(["--root", str(REPO)]) == 0
