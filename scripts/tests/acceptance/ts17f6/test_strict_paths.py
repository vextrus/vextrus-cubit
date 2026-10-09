"""S17-F6, the review bar: the strict paths are declared in one place, the review tiers' file.

The brief: "Strict paths are declared in `scripts/factory/review_tiers.toml` (a new table ...): security
walls (tenancy/RLS, auth, the guard), migrations, money (boq, rates), readers (engine readers)." Which
paths are strict is pinned by behaviour in test_bar.py; this pins where the list lives, so the ledger,
review.py and merge_ready read one list.

Seam (named by this ticket): the table `[strict]` with `paths`, a list of globs in the file's own glob
form (as `[docs_only]` and `[small]`)."""

import tomllib
from pathlib import Path

TIERS = Path(__file__).resolve().parents[4] / "scripts" / "factory" / "review_tiers.toml"


def test_the_strict_paths_are_a_table_of_review_tiers() -> None:
    data = tomllib.loads(TIERS.read_text())
    assert "strict" in data, "review_tiers.toml has no [strict] table"
    paths = data["strict"]["paths"]
    assert isinstance(paths, list)
    assert paths, "the [strict] table lists no path"
    assert all(isinstance(path, str) and path.strip() for path in paths)
