"""The world of ticket S14-K1's acceptance tests: S14-W1's scratch governor (`ts14w1/_world.py`: this
tree's `scripts/` copied into `tmp_path/tree`, its own hot-file list, healthy readings behind the
`VEXTRUS_*` seams, failing `gh` and `claude` stubs first on PATH), with any `governor check` arguments
(`--running N` among them) and the machine readings and `claude agents` rows set per test.

The owner's ruling (6 Oct 2026 08:22Z): "from the next session there should be none like that [the cap
is 5 PRs in progress] and at concurrently we can run 16 cloud sessions that we should take full
leverage with 4-6 local sessions and raise the cap of reviewer cap also from the next session for
maximum performance."

Sizes are written as whole or half GiB, each boundary 0.4 GB or more from the floor whether the governor
reads "GB" as 1024^3 or 10^9 bytes.
"""

from __future__ import annotations

import json
import subprocess
import sys
import uuid
from typing import Any

from scripts.tests.acceptance.ts14w1._world import KB_PER_GB, World

CLOUD_CAP = 16
LOCAL_AGENTS = 6
REVIEW_SLOTS = 8
OWNS = "vextrus/projects/services/brand_new.py"


def agent_row(name: str, state: str, *, pid: int | None, kind: str = "background") -> dict[str, Any]:
    """One row of `claude agents --json --all` (f3's shape, scripts/factory/tests/acceptance)."""
    row: dict[str, Any] = {
        "id": name[:8],
        "cwd": "/work/" + name,
        "kind": kind,
        "startedAt": "2026-10-06T07:00:00Z",
        "sessionId": str(uuid.uuid5(uuid.NAMESPACE_URL, name)),
        "name": name,
        "state": state,
    }
    if pid is not None:
        row["pid"] = pid
    return row


def live_agents(count: int) -> list[dict[str, Any]]:
    """`count` local agents running: background rows with a pid."""
    return [agent_row(f"builder-{n}", "working", pid=4100 + n) for n in range(count)]


class Scale(World):
    """S14-W1's world, with `governor check <unit> <args...>` and settable readings."""

    def agents(self, rows: list[dict[str, Any]]) -> None:
        self.seams["agents"].write_text(json.dumps(rows))

    def machine(
        self, *, mem_gb: float = 20.0, swap_used_gb: float = 0.2, disk_gb: float = 100.0
    ) -> None:
        def kb(gb: float) -> int:
            return int(gb * KB_PER_GB)

        self.seams["meminfo"].write_text(
            f"MemTotal:       {kb(27)} kB\n"
            f"MemAvailable:   {kb(mem_gb)} kB\n"
            f"SwapTotal:      {kb(8)} kB\n"
            f"SwapFree:       {kb(8 - swap_used_gb)} kB\n"
        )
        self.seams["df"].write_text(f"Avail\n{kb(disk_gb)}\n")

    def run(self, unit: str, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, "-m", "scripts.factory.governor", "check", unit, *args],
            cwd=self.tree,
            env=self.env(),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )
