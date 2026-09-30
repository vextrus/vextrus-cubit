"""Every password-free sudoers rule a script under scripts/owner/ renders takes one plain argument, never
an option (issue #107; review round 1: keys-custody.sh kept the old `[0-9A-Za-z-]+`). A command in a rule
either carries an anchored argument pattern, which must match one run id, PR number or branch name and
refuse anything hyphen-led or a second argument, or is one of the named programs that check their own
arguments. Every non-comment line naming `NOPASSWD:` must be a rule this parser reads (review round 2:
an `echo`- or `printf`-written rule, or one spaced around `=`, went unchecked)."""

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
OWNER_SCRIPTS = REPO / "scripts/owner"
RULE = re.compile(r"^\S+\s+ALL\s*=\s*\([^)]*\)\s*NOPASSWD\s*:(.*)$")
NAMES_NOPASSWD = re.compile(r"NOPASSWD\s*:")
# The programs a rule may name with any arguments, because they check their own (ADR 0041, ticket 24s).
CHECK_THEIR_OWN = {"autonomy-setup.sh": {"$POSTER"}, "keys-custody.sh": {"$RUNNER"}}

PLAIN = ["20260929T101500Z-0123456789ab-beef", "run-1", "a", "7", "t107"]
REFUSED = ["--help", "--key", "-x", "-", "-1", "--", "-run-1", "--key x", "run-1 --key", "run-1 run-2"]
REFUSED += ["run-1 -x", "--help run-1", "", "a b", "a\n", "a\r"]


def rules(text: str) -> list[str]:
    """The rules a script writes (their command lists), continuation lines joined, comments left out.
    Fails on a non-comment line naming `NOPASSWD:` that is not a rule it can read."""
    joined = re.sub(r"\\\\\n\s*", " ", text)
    found = []
    for line in (line.strip() for line in joined.splitlines()):
        if line.startswith("#") or not NAMES_NOPASSWD.search(line):
            continue
        rule = RULE.match(line)
        assert rule, f"a password-free rule this check cannot read: {line}"
        found.append(rule[1])
    return found


def problems(name: str, text: str) -> list[str]:
    """What is wrong with each command of each rule the script writes."""
    found = []
    for rule in rules(text):
        for spec in rule.split(","):
            program, _, raw = spec.strip().partition(" ")
            pattern = raw.strip().replace("\\$", "$")
            if not pattern:
                if program not in CHECK_THEIR_OWN.get(name, set()):
                    found.append(f"{program} takes any arguments")
                continue
            if not (pattern.startswith("^") and pattern.endswith("$")):
                found.append(f"{program} {pattern}: not anchored")
                continue
            prefix = pattern[1 : pattern.index("[")] if "[" in pattern else ""
            # POSIX's `$` (sudo's) matches only at the end; Python's also before a final newline.
            compiled = re.compile(pattern[:-1] + r"\Z")
            said = f"{program} {pattern}"
            found += [f"{said} refuses {a!r}" for a in PLAIN if not compiled.search(prefix + a)]
            found += [f"{said} allows {a!r}" for a in REFUSED if compiled.search(prefix + a)]
    return found


SCRIPTS = sorted(OWNER_SCRIPTS.glob("*.sh"))


def test_the_scripts_that_install_rules_are_read() -> None:
    assert all(rules((OWNER_SCRIPTS / name).read_text()) for name in CHECK_THEIR_OWN)


@pytest.mark.parametrize("script", SCRIPTS, ids=lambda path: path.name)
def test_every_rule_takes_one_plain_argument_or_names_a_program_checking_its_own(script: Path) -> None:
    assert problems(script.name, script.read_text()) == []


@pytest.mark.parametrize(
    "text",
    [
        'echo "u ALL=(k) NOPASSWD: /bin/sh" > /etc/sudoers.d/x\n',
        "printf '%s\\n' 'u ALL=(k) NOPASSWD: /bin/sh' > /etc/sudoers.d/x\n",
    ],
    ids=["echo", "printf"],
)
def test_a_rule_written_by_a_command_is_refused_not_skipped(text: str) -> None:
    with pytest.raises(AssertionError, match="cannot read"):
        rules(text)


def test_a_rule_spaced_around_the_equals_sign_is_read_and_checked() -> None:
    assert problems("x.sh", "u ALL = (k) NOPASSWD: /bin/sh\n") == ["/bin/sh takes any arguments"]


def test_a_comment_naming_the_tag_is_left_alone() -> None:
    assert rules("# u ALL=(k) NOPASSWD: /bin/sh\nwarn 'a NOPASSWD line'\n") == []


def refusal_checks(script: Path) -> list[str]:
    """The script's self-check lines that prove the scorer or the poster refused an argument."""
    joined = re.sub(r"\\\n\s*", " ", script.read_text())
    refused = re.compile(r"check \"[^\"]*is refused the (?:scorer|poster)")
    return [line for line in joined.splitlines() if refused.search(line)]


def test_keys_custody_s_refusals_ask_the_policy() -> None:
    """vxrun has only its password-free rule, so a listing (`-n -l`) is its policy (review round 1)."""
    checks = refusal_checks(OWNER_SCRIPTS / "keys-custody.sh")
    assert any("scorer with a lone option" in line for line in checks), checks
    for line in checks:
        assert "-n -l -u" in line, line


def test_autonomy_setup_s_refusals_run_the_command_and_want_the_tool_s_own_refusal() -> None:
    """The owner keeps an all-commands password rule, which a listing reports as allowed (review
    round 2), and the scorer's own non-zero exit is not a refusal: each check runs the command with
    `-n` through `refused`, which wants exit 1 and the tool's own message."""
    text = (OWNER_SCRIPTS / "autonomy-setup.sh").read_text()
    checks = refusal_checks(OWNER_SCRIPTS / "autonomy-setup.sh")
    assert any("scorer with a lone option" in line for line in checks), checks
    for line in checks:
        assert re.search(r'" *"refused \$', line), line
        assert " -l" not in line, line
    body = text.split("\nrefused() {", 1)[1].split("\n}\n", 1)[0]
    assert " -l" not in body
    assert '-- sudo -n -u "$KEY_USER" "$@"' in body
    assert '[ "$code" = 1 ]' in body
    assert '"${said#sudo: }" != "$said"' in body
