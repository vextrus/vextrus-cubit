"""The engine: pure Python that reads drawings, recognises what they hold, renders sheets and
runs Checks.

It imports no Django and no Vextrus module (import-linter holds this), so it runs alike in the web
process, the worker, the real-drawing check's sandbox and a test (docs/architecture.md; ADR 0031).
"""
