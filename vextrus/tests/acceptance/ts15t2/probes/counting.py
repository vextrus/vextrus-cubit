"""A plugin for `test_seed_template.py`'s inner session (`-p`): for each test, the SQL statements its
set-up sent through Django's two aliases (`default`, `owner`), one `<node id>\t<count>` line appended to
the file `TS15T2_SETUP_QUERIES` names. Counted by Django's own `execute_wrapper`, at the database's door,
whatever made them."""

import os
from collections.abc import Callable, Generator
from contextlib import ExitStack
from pathlib import Path
from typing import Any

import pytest

ALIASES = ("default", "owner")


@pytest.hookimpl(wrapper=True)
def pytest_runtest_setup(item: pytest.Item) -> Generator[None, object, object]:
    from django.db import connections

    sent = [0]

    def counter(execute: Callable[..., Any], sql: str, params: Any, many: bool, context: Any) -> Any:
        sent[0] += 1
        return execute(sql, params, many, context)

    with ExitStack() as stack:
        for alias in ALIASES:
            stack.enter_context(connections[alias].execute_wrapper(counter))
        try:
            return (yield)
        finally:
            with Path(os.environ["TS15T2_SETUP_QUERIES"]).open("a") as out:
                out.write(f"{item.nodeid}\t{sent[0]}\n")
