"""The poster (scripts/owner/post-status) with a fake GitHub and a fake signer, on invented runs: it
reads only the run's summary and metadata, posts only on the PR's head, and carries counts, the verdict
and the owner's reason, never a title or number from an export. No test raises privilege, names the
key user, reads a key or calls GitHub."""

import base64
import getpass
import importlib.util
import json
from importlib.machinery import SourceFileLoader
from pathlib import Path
from typing import Any

import pytest

from scripts.real_drawings.command import run
from scripts.real_drawings.diff import MEASURES
from scripts.real_drawings.tests.world import FAKE_EXPORT, invented, make_world

REPO = Path(__file__).resolve().parents[3]
_loader = SourceFileLoader("post_status", str(REPO / "scripts" / "owner" / "post-status"))
_spec = importlib.util.spec_from_loader("post_status", _loader)
assert _spec is not None
post_status: Any = importlib.util.module_from_spec(_spec)
_loader.exec_module(post_status)

RUN = "20260928T101500Z-0123456789ab-beef"
HEAD = "0123456789ab" + "c" * 28


class FakeGitHub:
    def __init__(self, head: str = HEAD) -> None:
        self.head = head
        self.calls: list[tuple[str, str, str, dict[str, Any] | None]] = []

    def __call__(self, method: str, path: str, token: str, body: dict[str, Any] | None) -> Any:
        self.calls.append((method, path, token, body))
        if path.endswith("/access_tokens"):
            return {"token": "installation-token"}
        if "/pulls/" in path:
            return {"head": {"sha": self.head}}
        if path.endswith("/status"):
            return {"state": "pending", "sha": self.head, "statuses": []}
        return {}

    def posted(self) -> list[dict[str, Any]]:
        return [
            body for method, path, _, body in self.calls if "/statuses/" in path and body is not None
        ]


def config(tmp_path: Path, drop: Path) -> Path:
    path = tmp_path / "post-status.toml"
    path.write_text(
        f'repository = "invented/repo"\napp_id = 1\ninstallation_id = 2\nkey_user = "invented-user"\n'
        f'key = "{tmp_path / "no-key.pem"}"\ndrop = "{drop}"\ninstalled = "/nowhere"\n'
        f'design_gate_items = 11\nwriter = "{getpass.getuser()}"\n'
    )
    return path


ZERO = {"gained": 0, "lost": 0, "changed": 0}


def counts(**changed: dict[str, int]) -> dict[str, dict[str, int]]:
    return {m: ZERO | changed.get(m, {}) for m in MEASURES}


def write_run(drop: Path, summary: dict[str, Any] | None = None, **metadata: Any) -> Path:
    folder = drop / RUN
    folder.mkdir(parents=True)
    (folder / "metadata.json").write_text(
        json.dumps({"run_id": RUN, "pr": 57, "commit": HEAD} | metadata)
    )
    summary = summary or {"run_id": RUN, "verdict": "accepted", "reason": "", "measures": counts()}
    (folder / "summary.json").write_text(json.dumps(summary))
    return folder


def unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def post(tmp_path: Path, argv: list[str], github: FakeGitHub) -> int:
    code: int = post_status.main(
        argv,
        config_path=config(tmp_path, tmp_path / "drop"),
        transport=github,
        sign=lambda data: b"signed",
    )
    return code


def test_the_posters_measures_are_the_checks() -> None:
    assert set(MEASURES) == post_status.MEASURES


def test_a_run_is_posted_on_the_prs_head_with_its_counts(tmp_path: Path) -> None:
    summary = {
        "run_id": RUN,
        "verdict": "accepted",
        "reason": "",
        "measures": counts(sheets={"changed": 2}, views={"gained": 3}),
    }
    write_run(tmp_path / "drop", summary)
    github = FakeGitHub()

    assert post(tmp_path, ["real-drawings", RUN], github) == 0

    assert [(m, p) for m, p, _, _ in github.calls] == [
        ("POST", "/app/installations/2/access_tokens"),
        ("GET", "/repos/invented/repo/pulls/57"),
        ("POST", f"/repos/invented/repo/statuses/{HEAD}"),
    ]
    assert github.calls[1][2] == "installation-token"
    assert github.posted() == [
        {
            "state": "success",
            "context": "real-drawings",
            "description": "accepted: 3 gained, 0 lost, 2 changed",
        }
    ]


def test_the_app_token_is_a_jwt_the_signer_signs(tmp_path: Path) -> None:
    write_run(tmp_path / "drop")
    github = FakeGitHub()

    post(tmp_path, ["real-drawings", RUN], github)

    header, payload, signature = github.calls[0][2].split(".")
    assert json.loads(unb64(payload))["iss"] == "1"
    assert signature == "c2lnbmVk"  # base64url of the fake signer's b"signed"
    assert json.loads(unb64(header)) == {"alg": "RS256", "typ": "JWT"}


def test_a_rejected_run_posts_failure_with_the_reason(tmp_path: Path) -> None:
    summary = {
        "run_id": RUN,
        "verdict": "rejected",
        "reason": "two sheets lost",
        "measures": counts(sheets={"lost": 2}),
    }
    write_run(tmp_path / "drop", summary)
    github = FakeGitHub()

    post(tmp_path, ["real-drawings", RUN], github)

    assert github.posted()[0]["state"] == "failure"
    assert github.posted()[0]["description"] == "rejected: 0 gained, 2 lost, 0 changed; two sheets lost"


def test_nothing_is_posted_when_the_prs_head_has_moved(tmp_path: Path) -> None:
    write_run(tmp_path / "drop")
    github = FakeGitHub(head="f" * 40)

    assert post(tmp_path, ["real-drawings", RUN], github) == 2
    assert github.posted() == []


@pytest.mark.parametrize(
    "summary",
    [
        {"run_id": RUN, "verdict": "accepted", "reason": "", "measures": counts(), "title": "Invented"},
        {"run_id": RUN, "verdict": "accepted", "reason": "", "measures": counts() | {"X-101": ZERO}},
        {
            "run_id": RUN,
            "verdict": "accepted",
            "reason": "",
            "measures": counts(sheets={"changed": "X-101"}),  # type: ignore[dict-item]
        },
        {"run_id": RUN, "verdict": "accepted", "reason": "", "measures": counts(sheets={"lost": 1})},
        {"run_id": RUN, "verdict": "maybe", "reason": "", "measures": counts()},
        {"run_id": "another", "verdict": "accepted", "reason": "", "measures": counts()},
    ],
    ids=[
        "extra key",
        "unknown measure",
        "text as a count",
        "lost without reason",
        "verdict",
        "other run",
    ],
)
def test_a_summary_carrying_anything_but_counts_verdict_and_reason_is_refused(
    tmp_path: Path, summary: dict[str, Any]
) -> None:
    write_run(tmp_path / "drop", summary)
    github = FakeGitHub()

    assert post(tmp_path, ["real-drawings", RUN], github) == 2
    assert github.calls == []


def test_only_a_run_id_names_a_run_folder(tmp_path: Path) -> None:
    outside = "../elsewhere"
    folder = write_run(tmp_path / "elsewhere-parent")  # a complete run, outside the drop folder
    folder.rename(tmp_path / "elsewhere")
    (tmp_path / "drop").mkdir()
    for name in ("metadata.json", "summary.json"):
        text = (tmp_path / "elsewhere" / name).read_text()
        (tmp_path / "elsewhere" / name).write_text(text.replace(RUN, outside))
    github = FakeGitHub()

    assert post(tmp_path, ["real-drawings", outside], github) == 2
    assert github.calls == []


def test_a_linked_summary_is_not_read(tmp_path: Path) -> None:
    folder = write_run(tmp_path / "drop")
    elsewhere = tmp_path / "elsewhere.json"
    elsewhere.write_text((folder / "summary.json").read_text())
    (folder / "summary.json").unlink()
    (folder / "summary.json").symlink_to(elsewhere)
    github = FakeGitHub()

    assert post(tmp_path, ["real-drawings", RUN], github) == 2
    assert github.calls == []


def test_a_run_of_a_branch_or_main_is_never_posted(tmp_path: Path) -> None:
    write_run(tmp_path / "drop", pr=None)
    github = FakeGitHub()

    assert post(tmp_path, ["real-drawings", RUN], github) == 2
    assert github.calls == []


def test_the_status_carries_counts_only_never_a_title_or_number_from_the_export(tmp_path: Path) -> None:
    world = make_world(tmp_path / "machine")
    head = world.pr(57, {FAKE_EXPORT: invented(title="Zebra Crossing Plan", number="QX-977")})
    world.answers = ["y", ""]
    run("57", no_post=False, m=world.machine())
    (run_id,) = world.posted
    github = FakeGitHub(head=head)

    code = post_status.main(
        ["real-drawings", run_id],
        config_path=config(tmp_path, world.drop),
        transport=github,
        sign=lambda data: b"signed",
    )

    assert code == 0
    (status,) = github.posted()
    assert status == {
        "state": "success",
        "context": "real-drawings",
        "description": "accepted: 0 gained, 0 lost, 2 changed",
    }


def test_the_design_gate_posts_the_items_passed_and_failed_and_nothing_else(tmp_path: Path) -> None:
    github = FakeGitHub()

    code = post(tmp_path, ["design-gate", "57", HEAD, "--passed", "1-9,11", "--failed", "10"], github)

    assert code == 0
    assert github.posted() == [
        {"state": "failure", "context": "design-gate", "description": "passed 1-9, 11; failed 10"}
    ]


def test_a_design_gate_with_every_item_passed_is_success(tmp_path: Path) -> None:
    github = FakeGitHub()

    post(tmp_path, ["design-gate", "57", HEAD, "--passed", "1-11"], github)

    assert github.posted() == [
        {"state": "success", "context": "design-gate", "description": "passed 1-11"}
    ]


@pytest.mark.parametrize(
    ("passed", "failed"),
    [("1-9", "10"), ("1-11", "10"), ("1-12", ""), ("1-9,11", "ten")],
    ids=["an item missing", "passed and failed", "an unknown item", "not a number"],
)
def test_a_design_gate_result_that_does_not_account_for_each_item_once_is_refused(
    tmp_path: Path, passed: str, failed: str
) -> None:
    github = FakeGitHub()

    assert (
        post(tmp_path, ["design-gate", "57", HEAD, "--passed", passed, "--failed", failed], github) == 2
    )
    assert github.calls == []


def test_an_item_not_applicable_is_posted_as_such_and_the_gate_can_pass(tmp_path: Path) -> None:
    github = FakeGitHub()

    argv = ["design-gate", "57", HEAD, "--passed", "1-10", "--not-applicable", "11"]
    assert post(tmp_path, argv, github) == 0

    assert github.posted() == [
        {"state": "success", "context": "design-gate", "description": "passed 1-10; not applicable 11"}
    ]


def test_a_failed_item_still_fails_the_gate_beside_items_not_applicable(tmp_path: Path) -> None:
    github = FakeGitHub()

    argv = ["design-gate", "57", HEAD, "--passed", "1-8", "--failed", "10", "--not-applicable", "9,11"]
    post(tmp_path, argv, github)

    assert github.posted() == [
        {
            "state": "failure",
            "context": "design-gate",
            "description": "passed 1-8; failed 10; not applicable 9, 11",
        }
    ]


@pytest.mark.parametrize(
    ("passed", "failed", "not_applicable"),
    [
        ("1-10", "", "10-11"),  # 10 both passed and not applicable
        ("1-9", "11", "11"),  # 11 both failed and not applicable, and 10 missing
        ("1-9", "", "11"),  # 10 missing
        ("1-10", "", "12"),  # no item 12
        ("1-10", "", "the sheet"),  # words, not item numbers
    ],
)
def test_each_item_must_be_passed_failed_or_not_applicable_exactly_once(
    tmp_path: Path, passed: str, failed: str, not_applicable: str
) -> None:
    github = FakeGitHub()
    argv = ["design-gate", "57", HEAD, "--passed", passed, "--failed", failed]

    assert post(tmp_path, [*argv, "--not-applicable", not_applicable], github) == 2
    assert github.calls == []


def test_the_design_gate_is_posted_only_on_the_prs_head(tmp_path: Path) -> None:
    github = FakeGitHub(head="f" * 40)

    assert post(tmp_path, ["design-gate", "57", HEAD, "--passed", "1-11"], github) == 2
    assert github.posted() == []


# Ticket 24s: `head` prints the commit GitHub holds, and posts nothing.


@pytest.mark.parametrize(
    ("ref", "path"),
    [("57", "/repos/invented/repo/pulls/57"), ("main", "/repos/invented/repo/commits/main/status")],
)
def test_head_prints_the_commit_github_holds_and_posts_nothing(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], ref: str, path: str
) -> None:
    github = FakeGitHub()

    code = post_status.main(
        ["head", ref], config_path=config(tmp_path, tmp_path), transport=github, sign=lambda d: b"s"
    )

    assert code == 0
    assert capsys.readouterr().out.strip() == HEAD
    assert [(m, p) for m, p, _, _ in github.calls][1:] == [("GET", path)]
    assert github.posted() == []


@pytest.mark.parametrize("ref", ["../x", "a..b", "feature/x", "x y", ""])
def test_head_refuses_a_ref_that_is_not_main_a_branch_or_a_pr(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], ref: str
) -> None:
    github = FakeGitHub()

    code = post_status.main(
        ["head", ref], config_path=config(tmp_path, tmp_path), transport=github, sign=lambda d: b"s"
    )

    assert code == 2
    assert "nothing posted" in capsys.readouterr().err
    assert github.calls == []


def test_head_refuses_an_answer_that_is_not_a_commit(tmp_path: Path) -> None:
    github = FakeGitHub(head="not-a-commit")

    code = post_status.main(
        ["head", "main"], config_path=config(tmp_path, tmp_path), transport=github, sign=lambda d: b"s"
    )

    assert code == 2


# Fix round 1 of 24s, F7 (50): the poster posted a run folder the pipeline's user did not write.


def test_once_the_pipelines_user_exists_only_its_runs_are_posted(tmp_path: Path) -> None:
    world = make_world(tmp_path / "world")
    world.pr(57, {"README.md": "a change the engine never reads\n"})
    run("57", no_post=False, m=world.machine(), accept_if_clean=True)
    (run_id,) = world.posted
    github = FakeGitHub(head=json.loads((world.drop / run_id / "metadata.json").read_text())["commit"])
    path = config(tmp_path, world.drop)

    written = path.read_text()
    # Another user that exists: root, or `nobody` when the tests themselves run as root (cloud sessions).
    other = "root" if getpass.getuser() != "root" else "nobody"
    path.write_text(written.replace(f'writer = "{getpass.getuser()}"', f'writer = "{other}"'))
    refused = post_status.main(
        ["real-drawings", run_id], config_path=path, transport=github, sign=lambda d: b"s"
    )
    assert refused == 2
    assert github.posted() == []

    path.write_text(written)
    assert (
        post_status.main(
            ["real-drawings", run_id], config_path=path, transport=github, sign=lambda d: b"s"
        )
        == 0
    )
    assert len(github.posted()) == 1


def test_the_settings_name_the_pipelines_user_as_the_writer() -> None:
    import tomllib

    settings = tomllib.loads((REPO / "scripts" / "owner" / "post-status.toml").read_text())
    assert settings["writer"] == "vxrun"


def test_settings_naming_no_pipelines_user_post_nothing(tmp_path: Path) -> None:
    """Fix round 1's refuter (45): without `writer` in the settings, no ownership check ran at all."""
    world = make_world(tmp_path / "world")
    world.pr(57, {"README.md": "a change the engine never reads\n"})
    run("57", no_post=False, m=world.machine(), accept_if_clean=True)
    (run_id,) = world.posted
    github = FakeGitHub(head=json.loads((world.drop / run_id / "metadata.json").read_text())["commit"])
    path = config(tmp_path, world.drop)
    path.write_text("\n".join(line for line in path.read_text().splitlines() if "writer" not in line))

    code = post_status.main(
        ["real-drawings", run_id], config_path=path, transport=github, sign=lambda d: b"s"
    )
    assert code == 2
    assert github.posted() == []
