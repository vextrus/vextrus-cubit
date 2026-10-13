"""CI's slowed-fake latency, read from `.github/workflows/web.yml` (never typed in a test): the one
`VITE_FAKE_API_LATENCY_MS` of the web job, set on a step that runs `npm test`."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
WEB_YML = ROOT / ".github" / "workflows" / "web.yml"
KEY = "VITE_FAKE_API_LATENCY_MS"
SETTING = re.compile(rf"^\s*{KEY}:\s*[\"']?(\d+)[\"']?\s*$")


def ci_latency() -> str:
    """The slowed pass's latency as web.yml sets it. More than one setting, or none, or one on a step
    that does not run `npm test`, fails here: verify's value has one source to follow."""
    lines = WEB_YML.read_text().splitlines()
    hits = [(i, match[1]) for i, line in enumerate(lines) if (match := SETTING.match(line))]
    assert len(hits) == 1, f"web.yml sets {KEY} {len(hits)} times, not once"
    index, value = hits[0]
    step_end = next(
        (i for i in range(index + 1, len(lines)) if lines[i].lstrip().startswith("- ")), len(lines)
    )
    step = lines[index:step_end]
    assert any(line.strip() == "run: npm test" for line in step), step
    return value
