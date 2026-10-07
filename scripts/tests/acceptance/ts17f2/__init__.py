"""Ticket S17-F2 (verify parallel): verify runs pytest on a bounded worker count, `tools/lint/tests`
serially in its own run (#585), the cheap checks concurrently, and the governor's `pytest` cost scales
with the worker count."""
