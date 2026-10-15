"""The review's risk tier and the refuter's sample (S29-F7; the owner's rulings Q5, Q15 and Q21, 14 Oct
2026; amends ADR 0043): one reader that `scripts.factory.review` and the landing (S29-F4) share.

- `risk_matches(paths)`: the given paths on the risk tier, in the order given; `is_risk(paths)`: any is.
  A path is risk when it matches a `[risk] paths` glob of `scripts/factory/review_tiers.toml` (case
  ignored) or matches no `[ordinary] paths` glob (case kept): risk is the default, and only plain
  product work outside the risk modules is ordinary (lesson (e); PR #884 rounds 1 and 2 each found a
  gate file the risk list missed). The file is read for each call (the ledger's reader). A tiers file
  that cannot be read, or holds no usable `[risk]` or `[ordinary] paths`, makes every given path risk:
  the tier fails closed. An empty change is not risk.
- `refuter_sampled(pr, head)`: the one ordinary head in five the refuter runs on, decided by code from
  the PR and its head (`int(sha256("<pr>:<head>"), 16) % 5 == 0`), so a rerun of the same head is
  sampled the same way.
"""

import hashlib
from collections.abc import Iterable

from scripts import ledger

RISK_TABLE = "risk"
ORDINARY_TABLE = "ordinary"
SAMPLE_ONE_IN = 5


def risk_matches(paths: Iterable[str]) -> list[str]:
    """The given paths on the risk tier, in the order given (every one when a list is unreadable)."""
    given = list(paths)
    risk_globs, ordinary_globs = ledger.tier_globs(RISK_TABLE), ledger.tier_globs(ORDINARY_TABLE)
    if risk_globs is None or ordinary_globs is None:
        return given
    risk = [ledger.glob_regex(glob, ignore_case=True) for glob in risk_globs]
    ordinary = [ledger.glob_regex(glob) for glob in ordinary_globs]
    return [
        path
        for path in given
        if any(pattern.fullmatch(path) for pattern in risk)
        or not any(pattern.fullmatch(path) for pattern in ordinary)
    ]


def is_risk(paths: Iterable[str]) -> bool:
    """True when one of the paths is on the risk tier: one risk path makes a whole PR risk."""
    return bool(risk_matches(paths))


def refuter_sampled(pr: int, head: str) -> bool:
    """True on the heads the refuter runs on off the risk tier: about one in five, by the PR and head."""
    digest = hashlib.sha256(f"{pr}:{head}".encode()).hexdigest()
    return int(digest, 16) % SAMPLE_ONE_IN == 0
