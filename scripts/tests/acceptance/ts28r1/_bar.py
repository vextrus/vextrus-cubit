"""The decision input the ledger reads (scripts/ledger.py docstring, `decide --from <file>`): one
`VERDICT: <word> at <head>` line per lens and one `FINDING <id> <score> <word> [<file>] [<tags>]` line
per finding. S28-R1's tags, in this order: `class=<c> boundary=<yes|no> observed=<yes|no>`."""

import pytest

from scripts import ledger

HEAD = "0123456789abcdef0123456789abcdef01234567"
# A web view component off every `[strict] paths` wall (scripts/factory/review_tiers.toml): a tagged
# finding here is on a trust boundary only when its lens says `boundary=yes`.
LAX = "web/src/components/badge.tsx"
# A product file (strict): an untagged 50-74 here blocks under the path bar.
STRICT = "vextrus/rates/table.py"


def decision(lens: str, *findings: str) -> ledger.Decision:
    """`scripts.ledger.decide` on one lens's verdict and the findings; a refusal fails the test."""
    text = f"VERDICT: {lens} at {HEAD}\n" + "".join(f"{line}\n" for line in findings)
    try:
        return ledger.decide(text.encode(), HEAD)
    except ledger.BadInput as error:
        pytest.fail(f"scripts.ledger.decide refused the line: {error}")
