"""Bounds on a test's work, never its wall time: the engine's helpers, for the platform's tests
too (`engine.testing.bounds`: `peak_memory` and `calls`)."""

from engine.testing.bounds import Calls, Peak, calls, peak_memory

__all__ = ["Calls", "Peak", "calls", "peak_memory"]
