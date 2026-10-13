"""Ticket S25-W3's acceptance tests, the workflow half: `/real-set-walk` walks the role items after the
QS critics, and gives an item still NOT_WALKED one retry, changing no model or effort.

G1 walk A (a492e91a) left M0-FL1, M0-FL10 and M0-FL11 NOT_WALKED, which fails the one PASS rule like a
FAIL (docs/specs/factory.md 5). Those items need other roles' sign-ins (M0-FL1 Vextrus staff, M0-FL10
the MD, the Vextrus Engineer and a Guest, M0-FL11 a second Developer's user), and every page shares one
browser profile, so a second sign-in during the QS critics' walk would replace the QS's cookie: the role
items are walked by a stage that starts only after both QS critics ended. After the walk, an item the
merge rule still leaves NOT_WALKED (the workflow's own rule: PASS if one says PASS and none FAIL) gets
one targeted retry before Triage, and only one.

The tests run `.claude/workflows/real-set-walk.js` itself under node with the workflow runtime's
globals stubbed (`agent`, `parallel`, `pipeline`, `phase`, `log`, `args`, `budget`, `workflow`): each
agent call is recorded with its brief, its options and when it started and ended. No agent runs, no
browser, no network; every value is synthetic. The stage's label and agent type are the builder's: the
role stage is found as an agent call that starts after both critics ended and names the three items.
"""

import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[5]
WORKFLOW = ROOT / ".claude" / "workflows" / "real-set-walk.js"
SHA = "5" * 40
SIGN_IN = ".private/work/factory/g1.sign-in"
ROLE_ITEMS = ("M0-FL1", "M0-FL10", "M0-FL11")
ALL_ITEMS = tuple(f"M0-FL{n}" for n in (*range(1, 12), 13))
QS_ITEMS = ("M0-FL5", "M0-FL7", "M0-FL8", "M0-FL9")

# The harness: the workflow body runs as the runtime runs it (an async function; `export const meta`
# taken off), every global stubbed. Each non-stage agent call (the role stage, a retry) answers from the
# scenario's next status map, item by item for the items its brief names, else NOT_WALKED; after
# twelve such calls the harness stops (a workflow that never stops retrying).
HARNESS = r"""
import { readFileSync } from "node:fs";
const [, , workflowPath, scenarioJson] = process.argv;
const scenario = JSON.parse(scenarioJson);
const source = readFileSync(workflowPath, "utf8").replace(/^export\s+const\s+meta\b/m, "const meta");
const calls = [];
let tick = 0;
let others = 0;
const named = (prompt) => [...new Set((prompt.match(/M0-FL\d+(?!\d)/g) || []))];
const walked = (statuses, prompt, evidence) => {
  const items = named(prompt).map((item) => ({ item, status: statuses[item] || "NOT_WALKED" }));
  const first = items.length ? items[0].item : "M0-FL2";
  return {
    items,
    findings: [{ item: first, defect_class: "synthetic", screen: "synthetic", delta: null,
      severity: "POLISH", misleading: false, evidence }],
  };
};
async function agent(prompt, opts = {}) {
  const call = { prompt: String(prompt), label: opts.label ?? null, phase: opts.phase ?? null,
    agentType: opts.agentType ?? null, model: opts.model ?? null, effort: opts.effort ?? null,
    started: ++tick, ended: null, kind: null };
  calls.push(call);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  let result;
  if (call.label === "walk.json" || call.phase === "Check") {
    call.kind = "check";
    result = { exists: true, web: "http://127.0.0.1:5999", api: "http://127.0.0.1:8999" };
  } else if (call.label === "ux-critic") {
    call.kind = "ux";
    const status = (item) => (scenario.ux_unwalked.includes(item) ? "NOT_WALKED" : "PASS");
    result = { items: scenario.all.map((item) => ({ item, status: status(item) })), findings: [] };
  } else if (call.label === "qs-critic") {
    call.kind = "qs";
    const status = (item) => (scenario.qs_items.includes(item) ? "PASS" : "NOT_WALKED");
    result = { items: scenario.all.map((item) => ({ item, status: status(item) })), findings: [] };
  } else if (call.label === "triage" || call.phase === "Triage") {
    call.kind = "triage";
    result = { findings: 0, issues_drafted: 0, dedup_comments: 0, merged: 0, refused: false };
  } else if (call.label === "verdict" || call.phase === "Verdict") {
    call.kind = "verdict";
    result = { leak_hits: 0, verdict_exit: 0, result: "PASS", public_rescan_hits: 0 };
  } else {
    const index = others++;
    call.kind = "other";
    if (index >= 12) throw new Error("harness: more than twelve stage calls, a retry that never stops");
    const statuses = scenario.others[index] || {};
    const evidence = `.private/work/walks/${scenario.sha}/evidence/s25w3-stage-${index}/`;
    result = walked(statuses, call.prompt, evidence);
  }
  call.ended = ++tick;
  return result;
}
async function parallel(thunks) {
  return Promise.all(thunks.map(async (thunk) => {
    try { return await thunk(); } catch { return null; }
  }));
}
async function pipeline(items, ...stages) {
  return Promise.all(items.map(async (item, index) => {
    let value = item;
    try {
      for (const stage of stages) value = await stage(value, item, index);
      return value;
    } catch { return null; }
  }));
}
const budget = { total: null, spent: () => 0, remaining: () => Infinity };
const workflow = async () => { throw new Error("harness: no nested workflow"); };
const AsyncFunction = (async () => {}).constructor;
const names = ["agent", "parallel", "pipeline", "phase", "log", "args", "budget", "workflow"];
const body = new AsyncFunction(...names, source);
let error = null;
try {
  await body(agent, parallel, pipeline, () => {}, () => {}, scenario.sha, budget, workflow);
} catch (thrown) {
  error = String(thrown && thrown.message || thrown);
}
process.stdout.write(JSON.stringify({ calls, error }));
"""


def _run(
    tmp_path: Path, *, ux_unwalked: tuple[str, ...], others: list[dict[str, str]]
) -> list[dict[str, Any]]:
    node = shutil.which("node")
    assert node is not None, "node is not on PATH: the workflow cannot be run"
    harness = tmp_path / "harness.mjs"
    harness.write_text(HARNESS, encoding="utf-8")
    scenario = {
        "sha": SHA,
        "all": list(ALL_ITEMS),
        "ux_unwalked": list(ux_unwalked),
        "qs_items": list(QS_ITEMS),
        "others": others,
    }
    done = subprocess.run(
        [node, str(harness), str(WORKFLOW), json.dumps(scenario)],
        capture_output=True,
        text=True,
        check=False,
        cwd=tmp_path,
    )
    assert done.returncode == 0, f"the harness failed: {done.stderr[-2000:]}"
    out = json.loads(done.stdout)
    assert out["error"] is None, f".claude/workflows/real-set-walk.js threw: {out['error']}"
    calls: list[dict[str, Any]] = out["calls"]
    return calls


def _names(prompt: str, item: str) -> bool:
    return re.search(rf"{re.escape(item)}(?!\d)", prompt) is not None


def _one(calls: list[dict[str, Any]], kind: str) -> dict[str, Any]:
    found = [call for call in calls if call["kind"] == kind]
    assert len(found) == 1, f".claude/workflows/real-set-walk.js made {len(found)} {kind} calls, not 1"
    return found[0]


def _stages(calls: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The agent calls that are none of main's five (Check, the two critics, Triage, Verdict)."""
    return [call for call in calls if call["kind"] == "other"]


def _role_stage(calls: list[dict[str, Any]]) -> dict[str, Any]:
    critics_ended = max(_one(calls, kind)["ended"] for kind in ("ux", "qs"))
    triage = _one(calls, "triage")
    role = [
        call
        for call in _stages(calls)
        if call["started"] > critics_ended
        and call["ended"] < triage["started"]
        and all(_names(call["prompt"], item) for item in ROLE_ITEMS)
    ]
    assert role, (
        ".claude/workflows/real-set-walk.js has no agent call after both QS critics ended,"
        " before Triage, that walks M0-FL1, M0-FL10 and M0-FL11"
    )
    return role[0]


ALL_PASS = dict.fromkeys(ALL_ITEMS, "PASS")


def test_a_role_stage_walks_fl1_fl10_and_fl11_after_both_qs_critics_ended(tmp_path: Path) -> None:
    calls = _run(tmp_path, ux_unwalked=ROLE_ITEMS, others=[ALL_PASS])
    role = _role_stage(calls)
    assert SIGN_IN in role["prompt"], (
        ".claude/workflows/real-set-walk.js's role stage does not name the sign-in data " + SIGN_IN
    )


def test_the_role_stage_runs_even_when_the_ux_critic_passed_the_role_items(tmp_path: Path) -> None:
    calls = _run(tmp_path, ux_unwalked=(), others=[ALL_PASS])
    _role_stage(calls)


def test_the_role_stages_report_reaches_triage(tmp_path: Path) -> None:
    calls = _run(tmp_path, ux_unwalked=ROLE_ITEMS, others=[ALL_PASS])
    role = _role_stage(calls)
    index = _stages(calls).index(role)
    evidence = f"evidence/s25w3-stage-{index}/"
    assert evidence in _one(calls, "triage")["prompt"], (
        ".claude/workflows/real-set-walk.js drops the role stage's report before Triage"
    )


def test_nothing_left_not_walked_gets_no_retry(tmp_path: Path) -> None:
    # The qs-critic lists its non-burden items NOT_WALKED, the ux-critic passes them: merged, nothing is
    # NOT_WALKED, so the role stage is the only extra call.
    calls = _run(tmp_path, ux_unwalked=ROLE_ITEMS, others=[ALL_PASS, ALL_PASS])
    _role_stage(calls)
    stages = _stages(calls)
    assert len(stages) == 1, (
        f".claude/workflows/real-set-walk.js made {len(stages)} extra walk calls"
        " with nothing NOT_WALKED, not 1"
    )


def test_an_item_still_not_walked_gets_one_targeted_retry_before_triage(tmp_path: Path) -> None:
    role_answer = {**ALL_PASS, "M0-FL10": "NOT_WALKED"}
    calls = _run(tmp_path, ux_unwalked=(*ROLE_ITEMS, "M0-FL3"), others=[role_answer, ALL_PASS])
    role = _role_stage(calls)
    triage = _one(calls, "triage")
    retries = [call for call in _stages(calls) if call is not role]
    assert len(retries) == 1, (
        f".claude/workflows/real-set-walk.js made {len(retries)} retries"
        " of the items still NOT_WALKED, not 1"
    )
    retry = retries[0]
    assert retry["started"] > role["ended"], "the retry starts before the role stage ended"
    assert retry["ended"] < triage["started"], "the retry ends after Triage started"
    for item in ("M0-FL3", "M0-FL10"):
        assert _names(retry["prompt"], item), f"the retry does not name {item}, still NOT_WALKED"
    for item in ("M0-FL1", "M0-FL11"):
        assert not _names(retry["prompt"], item), f"the retry names {item}, already walked"
    assert "evidence/s25w3-stage-1/" in triage["prompt"], "the retry's report does not reach Triage"


def test_an_item_not_walked_after_its_retry_is_not_retried_again(tmp_path: Path) -> None:
    role_answer = {**ALL_PASS, "M0-FL10": "NOT_WALKED"}
    calls = _run(tmp_path, ux_unwalked=ROLE_ITEMS, others=[role_answer, {}, ALL_PASS, ALL_PASS])
    _role_stage(calls)
    stages = _stages(calls)
    assert len(stages) == 2, (
        f".claude/workflows/real-set-walk.js made {len(stages)} extra walk calls for one item that stays"
        " NOT_WALKED: the role stage and one retry, 2"
    )
    _one(calls, "triage")


def test_the_role_stage_and_retry_change_no_stages_model_or_effort(tmp_path: Path) -> None:
    role_answer = {**ALL_PASS, "M0-FL10": "NOT_WALKED"}
    calls = _run(tmp_path, ux_unwalked=ROLE_ITEMS, others=[role_answer, ALL_PASS])
    _role_stage(calls)
    expected = {
        "check": ("opus", "low"),
        "ux": ("opus", None),
        "qs": ("opus", None),
        "triage": ("opus", None),
        "verdict": ("opus", "low"),
    }
    for kind, (model, effort) in expected.items():
        call = _one(calls, kind)
        ran = (call["model"], call["effort"])
        assert ran == (model, effort), f"{kind} runs on {ran}, not {(model, effort)}"
    for call in _stages(calls):
        assert call["model"] == "opus", f"a new stage names model {call['model']}, not opus"
