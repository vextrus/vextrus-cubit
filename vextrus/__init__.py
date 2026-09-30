"""Vextrus's Django modular monolith: twelve modules in one-way layers (docs/architecture.md).

Every Vextrus process runs its numerical libraries (numpy's OpenBLAS, and OpenMP or MKL if present) on
one thread: they read these variables once, when first loaded, which `django.setup` does, so they are
set here, before any module is imported. Left alone, OpenBLAS starts a thread per core, and each
thread's reserved memory counts against the `cad` worker's address-space cap: 1.21 GB of address
space at 24 cores, 0.27 GB with one thread (24, docs/research/m0-measurements.md). A value already set
in the environment is kept.
"""

import os

for _variable in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ.setdefault(_variable, "1")
