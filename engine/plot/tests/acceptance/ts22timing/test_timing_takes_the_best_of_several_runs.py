"""Every timing comparison in `engine/plot/tests` takes the best (least) of at least five runs of each
side, through the one shared helper `engine.plot.tests.timing.best_of(call, *, runs=5, clock=...)`.

The structural tests read the sources of `engine/plot/tests/*.py` (the acceptance folders aside) and
name each offending test; the behavioural tests drive the helper with a fake clock, no wall clock.
"""

import ast
from collections.abc import Callable
from importlib import import_module
from pathlib import Path

TESTS = Path(__file__).resolve().parents[2]
HELPER = "timing.py"
CLOCKS = frozenset(
    {"monotonic", "monotonic_ns", "perf_counter", "perf_counter_ns", "time", "time_ns", "process_time"}
)
LEAST_RUNS = 5

# The timing tests on main (51507b85): each compares two timed sides ...
COMPARED = {
    "test_title_read_shared_budget.py": (
        "test_a_page_of_many_scattered_titles_costs_about_one_read",
        "test_a_page_of_many_short_items_and_scattered_titles_costs_about_one_read",
        "test_a_page_of_short_lines_each_starting_every_title_costs_about_one_read",
        "test_a_page_whose_first_candidates_read_is_cheap_and_the_rest_dear_costs_about_one_read",
        "test_32_candidates_of_2000_word_titles_one_held_whole_stays_within_the_bound",
        "test_chain_reads_charge_each_line_they_visit_holding_a_titles_first_word_mid_line",
    ),
    "test_title_named.py": ("test_a_page_whose_reads_all_walk_near_their_budget_stays_fast",),
}
# ... or one timed side against a fixed bound.
BOUNDED = {
    "test_reads_title.py": (
        "test_a_page_of_items_repeating_the_titles_first_word_is_read_fast",
        "test_a_title_of_one_word_repeated_over_a_page_of_it_stops_at_its_budget",
        "test_a_long_title_over_a_large_page_is_answered_fast_and_never_alike_unread",
        "test_a_long_title_cut_short_of_its_chain_says_it_was_cut",
        "test_a_long_title_held_whole_by_one_item_still_reads_alike",
        "test_a_title_over_three_lines_still_reads_alike_on_a_page_of_its_words",
    ),
}


def _sources() -> list[Path]:
    return sorted(p for p in TESTS.glob("*.py") if p.name != HELPER)


def _top_level(tree: ast.Module) -> list[tuple[str, ast.AST]]:
    """Each top-level function or class with its name, and the module's other statements as one."""
    named: list[tuple[str, ast.AST]] = []
    rest: list[ast.stmt] = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            named.append((node.name, node))
        else:
            rest.append(node)
    named.append(("<module>", ast.Module(body=rest, type_ignores=[])))
    return named


def _time_aliases(tree: ast.Module) -> set[str]:
    return {
        alias.asname or alias.name
        for node in ast.walk(tree)
        if isinstance(node, ast.Import)
        for alias in node.names
        if alias.name == "time"
    }


def _reads_the_clock(node: ast.AST, aliases: set[str]) -> bool:
    for sub in ast.walk(node):
        if (
            isinstance(sub, ast.ImportFrom)
            and sub.module == "time"
            and any(alias.name in CLOCKS for alias in sub.names)
        ):
            return True
        if (
            isinstance(sub, ast.Attribute)
            and sub.attr in CLOCKS
            and isinstance(sub.value, ast.Name)
            and sub.value.id in aliases | {"time"}
        ):
            return True
    return False


def _called(node: ast.AST, name: str) -> list[ast.Call]:
    calls = []
    for sub in ast.walk(node):
        if isinstance(sub, ast.Call):
            func = sub.func
            if (isinstance(func, ast.Name) and func.id == name) or (
                isinstance(func, ast.Attribute) and func.attr == name
            ):
                calls.append(sub)
    return calls


def _functions(path: Path) -> dict[str, ast.AST]:
    return {
        node.name: node
        for node in ast.parse(path.read_text()).body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }


def _best_of_calls(name: str, functions: dict[str, ast.AST], seen: frozenset[str] = frozenset()) -> int:
    """The best_of calls a test makes, itself or through its own file's helpers (each call counted)."""
    if name not in functions or name in seen:
        return 0
    node = functions[name]
    total = len(_called(node, "best_of"))
    for sub in ast.walk(node):
        if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Name) and sub.func.id in functions:
            total += _best_of_calls(sub.func.id, functions, seen | {name})
    return total


def test_no_test_in_engine_plot_tests_reads_the_clock_itself() -> None:
    """Only the shared helper reads a clock; a test or a file's own helper that does fails, named."""
    offenders = []
    for path in _sources():
        tree = ast.parse(path.read_text())
        aliases = _time_aliases(tree)
        offenders += [
            f"{path.name}::{name}" for name, node in _top_level(tree) if _reads_the_clock(node, aliases)
        ]
    assert not offenders, f"reads the clock itself, not through best_of: {offenders}"


def test_no_test_times_a_side_once_through_timed() -> None:
    """A side timed once (`_timed(...)`) is the defect; each side is the best of several runs."""
    offenders = [
        f"{path.name}::{name}"
        for path in _sources()
        for name, node in _top_level(ast.parse(path.read_text()))
        if _called(node, "_timed")
    ]
    assert not offenders, f"times a side once through _timed: {offenders}"


def test_no_test_asks_best_of_for_fewer_than_five_runs() -> None:
    offenders = []
    for path in _sources():
        for name, node in _top_level(ast.parse(path.read_text())):
            for call in _called(node, "best_of"):
                for keyword in call.keywords:
                    if keyword.arg != "runs":
                        continue
                    value = keyword.value
                    if not (isinstance(value, ast.Constant) and isinstance(value.value, int)):
                        offenders.append(f"{path.name}::{name} runs={ast.unparse(value)}")
                    elif value.value < LEAST_RUNS:
                        offenders.append(f"{path.name}::{name} runs={value.value}")
    assert not offenders, f"asks best_of for fewer than {LEAST_RUNS} runs: {offenders}"


def test_each_timing_test_that_compares_two_sides_takes_the_best_of_each() -> None:
    """The seven tests comparing two timed sides (`page_reads < 4 * one + 0.05`) still exist and time
    each side through best_of (in the test or through a helper of its file)."""
    short = []
    for file, names in COMPARED.items():
        functions = _functions(TESTS / file)
        for name in names:
            calls = _best_of_calls(name, functions) if name in functions else -1
            if calls < 2:
                short.append(f"{file}::{name} best_of calls={calls}")
    assert not short, f"does not time both sides through best_of: {short}"


def test_each_timing_test_against_a_fixed_bound_takes_the_best_of_its_side() -> None:
    short = []
    for file, names in BOUNDED.items():
        functions = _functions(TESTS / file)
        for name in names:
            calls = _best_of_calls(name, functions) if name in functions else -1
            if calls < 1:
                short.append(f"{file}::{name} best_of calls={calls}")
    assert not short, f"does not time its side through best_of: {short}"


def _best_of() -> Callable[..., float]:
    """The shared helper: ModuleNotFoundError until it is built."""
    best_of: Callable[..., float] = import_module("engine.plot.tests.timing").best_of
    return best_of


class _FakeClock:
    """Each read returns the next reading, and records it beside the timed call's runs."""

    def __init__(self, readings: list[float], log: list[str]) -> None:
        self._readings = iter(readings)
        self._log = log

    def __call__(self) -> float:
        self._log.append("clock")
        return next(self._readings)


def _counted(log: list[str]) -> Callable[[], object]:
    def call() -> object:
        log.append("call")
        return None

    return call


def test_best_of_returns_the_least_of_n_runs_of_the_clock() -> None:
    best_of = _best_of()

    log: list[str] = []
    # Runs of 5, 2, 9, 0.5 and 3 ticks: the least is 0.5.
    readings = [0.0, 5.0, 10.0, 12.0, 20.0, 29.0, 30.0, 30.5, 40.0, 43.0]
    took = best_of(_counted(log), runs=5, clock=_FakeClock(readings, log))

    assert took == 0.5
    assert log == ["clock", "call", "clock"] * 5


def test_best_of_honours_more_runs_than_five() -> None:
    best_of = _best_of()

    log: list[str] = []
    readings = [float(x) for k in range(8) for x in (10 * k, 10 * k + 8 - k)]
    took = best_of(_counted(log), runs=8, clock=_FakeClock(readings, log))

    assert took == 1.0
    assert log.count("call") == 8


def test_best_of_runs_at_least_five_times_by_default() -> None:
    best_of = _best_of()

    log: list[str] = []
    readings = [float(x) for k in range(100) for x in (10 * k, 10 * k + 7)]
    took = best_of(_counted(log), clock=_FakeClock(readings, log))

    assert took == 7.0
    assert log.count("call") >= LEAST_RUNS
    assert log.count("clock") == 2 * log.count("call")


def test_a_regression_slowing_every_run_still_shows_through_best_of() -> None:
    """The least of the runs drops one slow (noisy) run but keeps a slowdown every run shares."""
    best_of = _best_of()

    noisy = [0.0, 1.0, 10.0, 18.0, 20.0, 21.0, 30.0, 31.0, 40.0, 41.0]
    slow = [0.0, 10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0]

    assert best_of(_counted([]), runs=5, clock=_FakeClock(noisy, [])) == 1.0
    assert best_of(_counted([]), runs=5, clock=_FakeClock(slow, [])) == 10.0
