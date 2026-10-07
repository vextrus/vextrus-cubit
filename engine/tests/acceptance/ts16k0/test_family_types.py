"""S16-K0: the family package contract's types and its registry (docs/plans/M1.md C4; the session-16
contract: "`engine/families/types.py`: C4 verbatim (...), all frozen dataclasses"; "`registry.py`:
`families() -> tuple[ModuleType, ...]` discovered from sub-packages at import (...). With no family
package: empty.")."""

import dataclasses
import enum
import importlib
import typing
from pathlib import Path

import pytest

C4_NAMES = (
    "Manifest",
    "FactSpec",
    "ElementCandidate",
    "Recognised",
    "JudgementRequest",
    "ConventionProposal",
    "QuestionRaised",
    "ElementFacts",
    "OwnedSolid",
    "Primitive",
    "LineDraft",
    "RuleSetData",
    "ViewArtefact",
    "ConfirmedFacts",
    "ProjectSetup",
    "ProfileParts",
)

MANIFEST_FIELDS = (
    "key",
    "part",
    "step",
    "identity_rule",
    "ifc_class",
    "ifc_predefined_type",
    "classification",
    "facts",
    "rule_codes",
    "jev_nodes",
    "conventions",
    "n_rule",
    "stage",
    "milestone",
)

PRIMITIVE_KINDS = {"prism", "cylinder", "sloped_prism"}


def types() -> typing.Any:
    return importlib.import_module("engine.families.types")


@pytest.mark.parametrize("name", C4_NAMES)
def test_each_c4_type_is_a_frozen_dataclass(name: str) -> None:
    held = getattr(types(), name)

    assert dataclasses.is_dataclass(held), f"{name} is not a dataclass"
    params: typing.Any = getattr(held, "__dataclass_params__", None)
    assert getattr(params, "frozen", False), f"{name} is not frozen"


def test_the_manifest_has_c4_s_fields_in_order_and_milestone_defaults_to_m1() -> None:
    fields = dataclasses.fields(types().Manifest)

    assert tuple(field.name for field in fields) == MANIFEST_FIELDS
    [milestone] = [field for field in fields if field.name == "milestone"]
    assert milestone.default == "M1"


def test_recognised_holds_candidates_judgements_conventions_and_questions() -> None:
    names = {field.name for field in dataclasses.fields(types().Recognised)}

    assert names >= {"candidates", "judgements", "conventions", "questions"}


def _kinds(annotation: typing.Any) -> set[str]:
    if isinstance(annotation, type) and issubclass(annotation, enum.Enum):
        return {str(member.value) for member in annotation}
    return {str(arg) for arg in typing.get_args(annotation)}


def test_a_primitive_is_a_prism_a_cylinder_or_a_sloped_prism_only() -> None:
    hints = typing.get_type_hints(types().Primitive)

    assert "kind" in hints, "Primitive has no kind"
    assert _kinds(hints["kind"]) == PRIMITIVE_KINDS


def _family_packages() -> set[str]:
    """The family packages on disk: each folder of engine/families with a manifest.py."""
    root = Path(importlib.import_module("engine.families").__file__ or "").parent
    return {path.parent.name for path in root.glob("*/manifest.py")}


def test_the_registry_discovers_exactly_the_family_packages_on_disk() -> None:
    """With K0 alone there is none, so `families()` is `()`; each family ticket adds its own folder."""
    registry = importlib.import_module("engine.families.registry")

    found = registry.families()

    assert isinstance(found, tuple)
    assert {module.__name__.split(".")[2] for module in found} == _family_packages()
