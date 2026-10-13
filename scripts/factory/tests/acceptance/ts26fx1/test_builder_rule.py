"""Ticket S26-FX1, item 5 (the owner's Q-R6): the builder's contract carries the rule that it answers a
status message with a `Factory-Status:` commit."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[5]


def test_the_builder_contract_names_the_factory_status_reply() -> None:
    text = (REPO / ".claude" / "agents" / "builder.md").read_text()
    assert "Factory-Status:" in text, "FX1 builder.md: no Factory-Status: rule"
