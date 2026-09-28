"""Message codes: what the machine says, as a code and named parameters, never prose."""

from pathlib import Path

import pytest

from engine.messages import MessageCode, collect_codes


def test_a_code_called_with_its_parameters_is_a_message() -> None:
    held = MessageCode("engine.decoders_agree.disagree", params=("handles", "reader"))

    assert held(handles=12, reader="libredwg") == {
        "code": "engine.decoders_agree.disagree",
        "params": {"handles": 12, "reader": "libredwg"},
    }


def test_a_code_without_parameters_is_a_message_with_none() -> None:
    assert MessageCode("platform.jobs.cancelled")() == {"code": "platform.jobs.cancelled", "params": {}}


@pytest.mark.parametrize("params", [{}, {"handles": 1, "sheet": "x"}, {"sheet": "x"}])
def test_a_message_must_carry_exactly_its_codes_parameters(params: dict[str, str | int]) -> None:
    held = MessageCode("engine.decoders_agree.disagree", params=("handles",))

    with pytest.raises(TypeError, match=r"engine\.decoders_agree\.disagree"):
        held(**params)


@pytest.mark.parametrize(
    "code", ["Engine.read.bad", "engine", "engine.read.", "engine..x", "engine.read.a-b"]
)
def test_a_code_is_dotted_lower_case_words(code: str) -> None:
    with pytest.raises(ValueError, match="code"):
        MessageCode(code)


def make_messages_package(root: Path, name: str, files: dict[str, str]) -> str:
    package = root / name / "messages"
    package.mkdir(parents=True)
    (root / name / "__init__.py").write_text("")
    (package / "__init__.py").write_text("")
    for filename, text in files.items():
        (package / filename).write_text("from engine.messages import MessageCode\n" + text)
    return f"{name}.messages"


def test_codes_are_collected_from_every_submodule_in_code_order(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    package = make_messages_package(
        tmp_path,
        "mod_collect",
        {
            "jobs.py": 'FAILED = MessageCode("mod_collect.jobs.failed", params=("reason",))\n',
            "auth.py": (
                'SIGNED_IN = MessageCode("mod_collect.auth.signed_in", event=True)\n'
                'REFUSED = MessageCode("mod_collect.auth.refused")\n'
            ),
        },
    )
    monkeypatch.syspath_prepend(str(tmp_path))

    codes = collect_codes(package)

    assert [held.code for held in codes] == [
        "mod_collect.auth.refused",
        "mod_collect.auth.signed_in",
        "mod_collect.jobs.failed",
    ]
    assert [held.code for held in codes if held.event] == ["mod_collect.auth.signed_in"]


def test_a_code_must_be_named_for_its_module_and_submodule(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    package = make_messages_package(
        tmp_path, "mod_prefix", {"jobs.py": 'X = MessageCode("mod_prefix.auth.failed")\n'}
    )
    monkeypatch.syspath_prepend(str(tmp_path))

    with pytest.raises(ValueError, match=r"mod_prefix\.jobs\."):
        collect_codes(package)


def test_one_code_declared_twice_is_refused(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    package = make_messages_package(
        tmp_path,
        "mod_twice",
        {
            "jobs.py": (
                'A = MessageCode("mod_twice.jobs.failed")\nB = MessageCode("mod_twice.jobs.failed")\n'
            )
        },
    )
    monkeypatch.syspath_prepend(str(tmp_path))

    with pytest.raises(ValueError, match="twice"):
        collect_codes(package)


def test_one_code_bound_to_two_names_is_collected_once(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    package = make_messages_package(
        tmp_path, "mod_alias", {"jobs.py": 'A = MessageCode("mod_alias.jobs.failed")\nB = A\n'}
    )
    monkeypatch.syspath_prepend(str(tmp_path))

    assert [held.code for held in collect_codes(package)] == ["mod_alias.jobs.failed"]
