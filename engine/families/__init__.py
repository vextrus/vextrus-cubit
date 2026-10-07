"""The family packages (docs/plans/M1.md C4; ADR 0031 §5): one sub-package per Element family, each
with `manifest.py` (`MANIFEST`), `recognise.py`, `geometry.py` and `measure.py`, found at import time by
`registry`, so parallel family tickets never touch one shared file. `types` holds the contract."""
