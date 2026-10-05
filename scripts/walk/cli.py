"""The walk commands' argument parser: a usage error never echoes the command line (it may hold text)."""

import argparse
import sys
from typing import NoReturn


class QuietParser(argparse.ArgumentParser):
    """An ArgumentParser whose errors are fixed words and exit 2, never a value from argv."""

    def error(self, message: str) -> NoReturn:
        sys.stderr.write(f"{self.prog}: usage error (see --help)\n")
        raise SystemExit(2)
