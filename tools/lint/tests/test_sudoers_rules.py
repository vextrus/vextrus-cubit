"""Every password-free sudoers rule a script under scripts/owner/ renders takes one plain argument, never
an option (issue #107; review round 1: keys-custody.sh kept the old `[0-9A-Za-z-]+`). A command in a rule
either carries an anchored argument pattern, which must match one run id, PR number or branch name and
refuse anything hyphen-led or a second argument, or is one of the named programs that check their own
arguments."""

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
OWNER_SCRIPTS = REPO / "scripts/owner"
RULE = re.compile(r"^\S+ ALL=\(\S+\) NOPASSWD:(.*)$")
# The programs a rule may name with any arguments, because they check their own (ADR 0041, ticket 24s).
CHECK_THEIR_OWN = {"autonomy-setup.sh": {"$POSTER"}, "keys-custody.sh": {"$RUNNER"}}

PLAIN = ["20260929T101500Z-0123456789ab-beef", "run-1", "a", "7", "t107"]
REFUSED = ["--help", "--key", "-x", "-", "-1", "--", "-run-1", "--key x", "run-1 --key", "run-1 run-2"]
REFUSED += ["run-1 -x", "--help run-1", "", "a b", "a\n", "a\r"]


def rules(script: Path) -> list[str]:
    """The rule lines the script writes, continuation lines joined, comments left out."""
    joined = re.sub(r"\\\\\n\s*", " ", script.read_text())
    return [found[1] for line in joined.splitlines() if (found := RULE.match(line.strip()))]


def commands(script: Path) -> list[tuple[str, str | None]]:
    """Each command a rule names: the program and its argument pattern (None when it has none)."""
    found: list[tuple[str, str | None]] = []
    for rule in rules(script):
        for spec in rule.split(","):
            program, _, pattern = spec.strip().partition(" ")
            found.append((program, pattern.strip().replace("\\$", "$") or None))
    return found


SCRIPTS = sorted(path for path in OWNER_SCRIPTS.glob("*.sh") if rules(path))


def test_the_scripts_that_install_rules_are_found() -> None:
    assert {path.name for path in SCRIPTS} >= {"autonomy-setup.sh", "keys-custody.sh"}


@pytest.mark.parametrize("script", SCRIPTS, ids=lambda path: path.name)
def test_every_rule_takes_one_plain_argument_or_names_a_program_checking_its_own(script: Path) -> None:
    for program, pattern in commands(script):
        if pattern is None:
            assert program in CHECK_THEIR_OWN.get(script.name, set()), f"{program} takes any arguments"
            continue
        assert pattern.startswith("^"), f"{program} {pattern}: not anchored"
        assert pattern.endswith("$"), f"{program} {pattern}: not anchored"
        prefix = pattern[1 : pattern.index("[")] if "[" in pattern else ""
        # POSIX's `$` (sudo's) matches only at the end; Python's also before a final newline.
        compiled = re.compile(pattern[:-1] + r"\Z")
        for argument in PLAIN:
            assert compiled.search(prefix + argument), f"{program} {pattern} refuses {argument!r}"
        for argument in REFUSED:
            assert not compiled.search(prefix + argument), f"{program} {pattern} allows {argument!r}"


def refusal_checks(script: Path) -> list[str]:
    """The script's self-check lines that prove the scorer or the poster refused an argument."""
    joined = re.sub(r"\\\n\s*", " ", script.read_text())
    refused = re.compile(r"check \"[^\"]*is refused the (?:scorer|poster)")
    return [line for line in joined.splitlines() if refused.search(line)]


@pytest.mark.parametrize("script", ["autonomy-setup.sh", "keys-custody.sh"])
def test_the_self_checks_refusals_ask_the_policy_not_the_program_s_exit_code(script: str) -> None:
    """The scorer answers non-zero for a run that is not there, so `! <run it>` cannot tell its own
    refusal from the policy's; `-n -l <command>` asks the policy and runs nothing (review round 1)."""
    checks = refusal_checks(OWNER_SCRIPTS / script)
    scorer = [line for line in checks if "refused the scorer" in line]
    assert any("lone option" in line for line in scorer), scorer
    for line in checks:
        assert "-n -l -u" in line or "$(permitted " in line, line
