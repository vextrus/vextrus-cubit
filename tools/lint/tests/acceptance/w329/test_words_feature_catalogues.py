"""Ticket W329's acceptance tests: the words lint (`tools/lint/words.py`) reads every feature
catalogue (`web/src/<feature>/locales/en.po`, `web/lingui.config.ts`'s `src/{name}/locales/{locale}`)
as well as the machine's (`web/src/messages/**/en.po`), never the development harness's
(`web/src/dev/`, development builds only); a positional argument that only selects is not a positional
placeholder; and a verb after a singular argument is not read as a plural.

Seams, all existing names (the ticket's section 3): `catalogues(root)`, `scan(root, allowlist)`,
`main(argv)` and the rule names. Every msgid and msgstr here is invented.
"""

from pathlib import Path

import pytest

from tools.lint.words import (
    ADD_AGAIN,
    ASK_MD,
    COUNT,
    ENGINE_TERM,
    POSITIONAL,
    REINFORCEMENT,
    Allow,
    catalogues,
    main,
    scan,
)

REPO = Path(__file__).resolve().parents[5]
MESSAGES = "web/src/messages/drawings/sheets/en.po"
TAKEOFF = "web/src/takeoff/locales/en.po"
FEATURES = ("app", "auth", "drawing-set", "format", "members", "projects", "sheet", "takeoff", "ui")


def write_catalogue(root: Path, *pairs: tuple[str, str], path: str) -> None:
    """A catalogue as Lingui writes it (as `tools/lint/tests/test_words.py` does)."""
    body = 'msgid ""\nmsgstr ""\n"Language: en\\n"\n\n'
    body += "".join(f'#. a comment\nmsgid "{msgid}"\nmsgstr "{msgstr}"\n\n' for msgid, msgstr in pairs)
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body, encoding="utf-8")


CONTROL = ("step1.control", "The cache is old.")
"""A finding beside a string that must pass, so a catalogue that is not read cannot pass vacuously."""


def control(path: str) -> tuple[str, str, str, str]:
    return (path, "step1.control", ENGINE_TERM, "cache")


def found(root: Path, allow: list[Allow] | None = None) -> list[tuple[str, str, str, str]]:
    findings, _stale = scan(root, allow or [])
    return [(f.path, f.msgid, f.rule, f.text) for f in findings]


@pytest.mark.parametrize("folder", FEATURES)
def test_a_feature_catalogue_is_read(tmp_path: Path, folder: str) -> None:
    path = f"web/src/{folder}/locales/en.po"
    write_catalogue(tmp_path, ("step1.trial", "The job stopped half way."), path=path)

    assert found(tmp_path) == [(path, "step1.trial", ENGINE_TERM, "job")]


EVERY_RULE = [
    ("It was not kept. Add it again.", ADD_AGAIN, "Add it again"),
    ("You cannot settle it. Ask your MD.", ASK_MD, "Ask your MD"),
    ("The reinforcement is listed.", REINFORCEMENT, "reinforcement"),
    ("{0} is open already.", POSITIONAL, "{0}"),
    ("{storeys} storeys read.", COUNT, "{storeys} storeys"),
    ("{n} to go.", COUNT, "{n}"),
]


@pytest.mark.parametrize(("msgstr", "rule", "text"), EVERY_RULE)
def test_every_rule_reaches_step_1_s_catalogue(
    tmp_path: Path, msgstr: str, rule: str, text: str
) -> None:
    write_catalogue(tmp_path, ("step1.trial", msgstr), path=TAKEOFF)

    assert found(tmp_path) == [(TAKEOFF, "step1.trial", rule, text)]


def test_the_output_names_the_file_the_msgstr_line_and_the_msgid(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write_catalogue(tmp_path, ("step1.trial", "The job stopped half way."), path=TAKEOFF)
    lines = (tmp_path / TAKEOFF).read_text(encoding="utf-8").splitlines()
    msgstr_line = lines.index('msgstr "The job stopped half way."') + 1
    (tmp_path / "allow.toml").write_text("", encoding="utf-8")

    code = main(["--root", str(tmp_path), "--allowlist", str(tmp_path / "allow.toml")])

    out = capsys.readouterr().out.splitlines()
    assert code == 1
    assert any(
        line.startswith(f"{TAKEOFF}:{msgstr_line}: step1.trial: engine term 'job'") for line in out
    ), out


def test_the_development_harness_is_not_read(tmp_path: Path) -> None:
    write_catalogue(
        tmp_path,
        ("dev.tokens", "Tokens"),
        ("dev.specimen", "Add a specimen with python -m engine.render."),
        path="web/src/dev/locales/en.po",
    )

    assert found(tmp_path) == []


def test_the_machine_s_catalogues_are_still_read_beside_the_features(tmp_path: Path) -> None:
    write_catalogue(tmp_path, ("drawings.sheets.trial", "The worker stopped."), path=MESSAGES)
    write_catalogue(tmp_path, ("step1.trial", "The queue is long."), path=TAKEOFF)

    assert found(tmp_path) == [
        (MESSAGES, "drawings.sheets.trial", ENGINE_TERM, "worker"),
        (TAKEOFF, "step1.trial", ENGINE_TERM, "queue"),
    ]


def test_catalogues_are_the_machine_s_and_the_shipped_features_sorted(tmp_path: Path) -> None:
    wanted = [
        "web/src/messages/a/en.po",
        "web/src/takeoff/locales/en.po",
        "web/src/ui/locales/en.po",
    ]
    for path in [*wanted, "web/src/dev/locales/en.po"]:
        write_catalogue(tmp_path, ("x.y", "Fine words."), path=path)
    (tmp_path / "web/src/takeoff/locales/en.js").write_text("export const messages = {}\n", "utf-8")

    assert catalogues(tmp_path) == [tmp_path / path for path in wanted]


SELECTS_ONLY = [
    "{0, plural, one {# storey} other {# storeys}}",
    "{0, select, upper {Upper roof} other {Roof}}",
]
SHOWN = ["{0} is open already.", "{0, number} to go."]


@pytest.mark.parametrize("path", [MESSAGES, TAKEOFF])
@pytest.mark.parametrize("msgstr", SELECTS_ONLY)
def test_a_positional_argument_that_only_selects_is_not_a_placeholder(
    tmp_path: Path, path: str, msgstr: str
) -> None:
    write_catalogue(tmp_path, ("step1.trial", msgstr), CONTROL, path=path)

    assert found(tmp_path) == [control(path)]


@pytest.mark.parametrize("path", [MESSAGES, TAKEOFF])
@pytest.mark.parametrize("msgstr", SHOWN)
def test_a_positional_argument_that_is_shown_is_still_a_placeholder(
    tmp_path: Path, path: str, msgstr: str
) -> None:
    write_catalogue(tmp_path, ("step1.trial", msgstr), path=path)

    assert found(tmp_path) == [(path, "step1.trial", POSITIONAL, "{0}")]


VERBS = [
    "{owner} creates the storeys.",
    "{plan} belongs to the lower range.",
    "{drawing} carries no schedule.",
    "{Title} agrees with the register.",
    "{developer} ends on {date}.",
    "{kind} and confirms the plan.",
]


@pytest.mark.parametrize("path", [MESSAGES, TAKEOFF])
@pytest.mark.parametrize("msgstr", VERBS)
def test_a_verb_after_a_singular_argument_is_not_a_plural(
    tmp_path: Path, path: str, msgstr: str
) -> None:
    write_catalogue(tmp_path, ("step1.trial", msgstr), CONTROL, path=path)

    assert found(tmp_path) == [control(path)]


PLURALS = [
    ("{storeys} storeys read.", "{storeys} storeys"),
    ("{drawn} drawn plans.", "{drawn} drawn plans"),
    ("{storeys} Storeys read.", "{storeys} Storeys"),
]


@pytest.mark.parametrize(("msgstr", "text"), PLURALS)
def test_a_plural_noun_after_an_argument_is_still_a_count(
    tmp_path: Path, msgstr: str, text: str
) -> None:
    write_catalogue(tmp_path, ("step1.trial", msgstr), path=TAKEOFF)

    assert found(tmp_path) == [(TAKEOFF, "step1.trial", COUNT, text)]


def test_one_allowlist_entry_lets_off_its_msgid_in_every_catalogue(tmp_path: Path) -> None:
    msgid = "No Developer has you yet. Ask your MD to invite you."
    for path in ("web/src/auth/locales/en.po", "web/src/projects/locales/en.po"):
        write_catalogue(tmp_path, (msgid, msgid), path=path)
    entry = Allow(msgid, ASK_MD, "an act an MD can do: inviting a member")

    assert scan(tmp_path, [entry]) == ([], [])


def test_the_repository_reads_every_shipped_catalogue_and_passes() -> None:
    read = [path.relative_to(REPO).as_posix() for path in catalogues(REPO)]

    for path in (
        "web/src/takeoff/locales/en.po",
        "web/src/ui/locales/en.po",
        "web/src/drawing-set/locales/en.po",
    ):
        assert path in read
    assert any(path.startswith("web/src/messages/") for path in read)
    assert not any(path.startswith("web/src/dev/") for path in read)
    assert main(["--root", str(REPO)]) == 0
