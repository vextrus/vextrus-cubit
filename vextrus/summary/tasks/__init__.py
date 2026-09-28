"""`summary`'s jobs: one submodule per ticket, imported by listing this package, so
Procrastinate's autodiscovery (it imports `vextrus.summary.tasks`) finds every task.
"""

from engine.collect import submodules

submodules(__name__)
