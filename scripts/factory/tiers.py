"""The review's risk tier and the refuter's sample (S29-F7, replanned smaller by S30-F7; the owner's
rulings Q5, Q15 and Q21, 14 Oct 2026; amends ADR 0043): one reader that `scripts.factory.review` and
the landing (S29-F4) share.

- `risk_matches(paths)`: the given paths on the risk tier, in the order given; `is_risk(paths)`: any is.
  A path is ordinary only on the review bar's lax set (`scripts.ledger.on_strict_path` is false: a
  `[lax] paths` glob of the file `ledger.TIERS_FILE` names, matched as written, less its `[strict]
  paths` carve-outs) and on no `**/conftest.py`, no `[risk] paths` glob and no `[docs_only] never`
  glob (those two case ignored). Everything else is risk: there is no second ordinary list (S30-F7,
  issue #898: PR #896's `[ordinary]` folders gave access files one lens). The file is read for each
  call, and `on_strict_path` reads it again for each path: the bar's own fail-closed reader, kept
  rather than copied. A tiers file that cannot be read, or any of those four lists missing, empty or unusable,
  makes every given path risk: the tier fails closed. An empty change is not risk.
- `refuter_sampled(pr, head)`: the one ordinary head in five the refuter runs on, decided by code from
  the PR and its head (`int(sha256("<pr>:<head>"), 16) % 5 == 0`), so a rerun of the same head is
  sampled the same way.
"""

import hashlib
import tomllib
from collections.abc import Iterable

from scripts import ledger

RISK_TABLE = "risk"
DOCS_ONLY_TABLE = "docs_only"
# pytest loads a conftest.py from any folder it collects: a gate's own configuration, wherever it sits.
ALWAYS_RISK = ("**/conftest.py",)
SAMPLE_ONE_IN = 5


def never_globs() -> list[str] | None:
    """`[docs_only] never` of the tiers file as it is now; None when it cannot be read or the list is
    missing, empty or holds anything but non-blank strings."""
    try:
        tables = tomllib.loads(ledger.TIERS_FILE.read_bytes().decode())
    except OSError, ValueError:
        return None
    table = tables.get(DOCS_ONLY_TABLE)
    never = table.get("never") if isinstance(table, dict) else None
    if isinstance(never, list) and never and all(isinstance(g, str) and g.strip() for g in never):
        return never
    return None


def risk_matches(paths: Iterable[str]) -> list[str]:
    """The given paths on the risk tier, in the order given (every one when a list is unreadable)."""
    given = list(paths)
    risk_globs, never, lax = ledger.tier_globs(RISK_TABLE), never_globs(), ledger.lax_paths()
    if risk_globs is None or never is None or lax is None or ledger.strict_paths() is None:
        return given
    risk = [ledger.glob_regex(glob, ignore_case=True) for glob in [*risk_globs, *never, *ALWAYS_RISK]]

    def ordinary(path: str) -> bool:
        # The bar drops a location suffix (`x.tsx:12`) before it judges; the tier judges the path as
        # it is, so a lax glob must match the whole path too.
        return (
            not ledger.on_strict_path(path)
            and any(pattern.fullmatch(path) for pattern in lax)
            and not any(pattern.fullmatch(path) for pattern in risk)
        )

    return [path for path in given if not ordinary(path)]


def is_risk(paths: Iterable[str]) -> bool:
    """True when one of the paths is on the risk tier: one risk path makes a whole PR risk."""
    return bool(risk_matches(paths))


def refuter_sampled(pr: int, head: str) -> bool:
    """True on the heads the refuter runs on off the risk tier: about one in five, by the PR and head."""
    digest = hashlib.sha256(f"{pr}:{head}".encode()).hexdigest()
    return int(digest, 16) % SAMPLE_ONE_IN == 0
