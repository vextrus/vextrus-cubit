"""The review's risk tier and the refuter's sample (S29-F7; the owner's rulings Q5, Q15 and Q21, 14 Oct
2026; amends ADR 0043): one reader that `scripts.factory.review` and the landing (S29-F4) share.

- `risk_matches(paths)`: the given paths on the risk tier (a `[risk] paths` glob of
  `scripts/factory/review_tiers.toml`, case ignored), in the order given; `is_risk(paths)`: any is.
  The file is read for each call (the ledger's reader). A tiers file that cannot be read, or holds no
  usable `[risk] paths`, makes every given path risk: the tier fails closed. An empty change is not risk.
- `refuter_sampled(pr, head)`: the one ordinary head in five the refuter runs on, decided by code from
  the PR and its head (`int(sha256("<pr>:<head>"), 16) % 5 == 0`), so a rerun of the same head is
  sampled the same way.
"""

import hashlib
from collections.abc import Iterable

from scripts import ledger

RISK_TABLE = "risk"
SAMPLE_ONE_IN = 5


def risk_matches(paths: Iterable[str]) -> list[str]:
    """The given paths on the risk tier, in the order given (every one when the list is unreadable)."""
    given = list(paths)
    globs = ledger.tier_globs(RISK_TABLE)
    if globs is None:
        return given
    patterns = [ledger.glob_regex(glob, ignore_case=True) for glob in globs]
    return [path for path in given if any(pattern.fullmatch(path) for pattern in patterns)]


def is_risk(paths: Iterable[str]) -> bool:
    """True when one of the paths is on the risk tier: one risk path makes a whole PR risk."""
    return bool(risk_matches(paths))


def refuter_sampled(pr: int, head: str) -> bool:
    """True on the heads the refuter runs on off the risk tier: about one in five, by the PR and head."""
    digest = hashlib.sha256(f"{pr}:{head}".encode()).hexdigest()
    return int(digest, 16) % SAMPLE_ONE_IN == 0
