"""Synthetic fixture generators, one file each (`dwg/<name>.py`, `pdf/<name>.py`), run at test time.

A synthetic DWG is never committed: each generator writes into pytest's temporary directory.
"""
