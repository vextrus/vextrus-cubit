"""The family packages (docs/plans/M1.md C4; ADR 0031 §5): one sub-package per family
(`engine/families/<key>/` with `manifest.py`, `recognise.py`, `geometry.py`, `measure.py`), the types
they speak (`types.py`) and the registry that finds them at import (`registry.py`).

Look the registry up on its module at call time (`registry.families()`), never `from ... import
families`: tests replace it.
"""
